'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertCircle,
  Download,
  Users,
  Calendar,
  DollarSign,
  ArrowRight,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  TrendingUp
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ImportSummary {
  totalPeriods: number
  periods: string[]
  totalEmployees: number
  totalRemunerations: number
  totalAbsences: number
  byPeriod: {
    periode: string
    employees: number
    remunerations: number
    absences: number
  }[]
}

export default function MultiPeriodImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [company, setCompany] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [processedPeriods, setProcessedPeriods] = useState<string[]>([])
  const [currentProcessingPeriod, setCurrentProcessingPeriod] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkUserAndCompany()
  }, [])

  const checkUserAndCompany = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        router.push('/login')
        return
      }

      setUser(currentUser)

      let { data: existingCompany } = await supabase
        .from('etablissements')
        .select('*')
        .eq('user_id', currentUser.id)
        .single()

      if (!existingCompany) {
        const companyCode = `${currentUser.id.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
        const companyName = currentUser.user_metadata?.company_name || 'Mon Entreprise'
        
        const { data: newCompany } = await supabase
          .from('etablissements')
          .insert({
            nom: companyName,
            code_entreprise: companyCode,
            siret: currentUser.user_metadata?.siret || null,
            user_id: currentUser.id,
            effectif_total: 0,
            subscription_plan: 'starter',
            subscription_status: 'active',
            ai_features_enabled: false
          })
          .select()
          .single()

        existingCompany = newCompany
      }

      setCompany(existingCompany)
    } catch (error) {
      console.error('Setup error:', error)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setFile(file)
      setImportStatus('idle')
      setErrorMessage(null)
      setImportSummary(null)
      analyzeFile(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1
  })

  const analyzeFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      
      const summary: ImportSummary = {
        totalPeriods: 0,
        periods: [],
        totalEmployees: 0,
        totalRemunerations: 0,
        totalAbsences: 0,
        byPeriod: []
      }
      
      // Analyze EMPLOYES sheet
      if (wb.Sheets['EMPLOYES']) {
        const employees = XLSX.utils.sheet_to_json(wb.Sheets['EMPLOYES'])
        const periodMap = new Map<string, number>()
        
        employees.forEach((emp: any) => {
          const periode = emp.periode || new Date().toISOString().slice(0, 7)
          periodMap.set(periode, (periodMap.get(periode) || 0) + 1)
        })
        
        summary.totalEmployees = employees.length
        summary.periods = Array.from(periodMap.keys()).sort()
        summary.totalPeriods = summary.periods.length
        
        summary.periods.forEach(p => {
          let periodData = summary.byPeriod.find(bp => bp.periode === p)
          if (!periodData) {
            periodData = { periode: p, employees: 0, remunerations: 0, absences: 0 }
            summary.byPeriod.push(periodData)
          }
          periodData.employees = periodMap.get(p) || 0
        })
      }
      
      // Analyze REMUNERATION sheet
      if (wb.Sheets['REMUNERATION']) {
        const remunerations = XLSX.utils.sheet_to_json(wb.Sheets['REMUNERATION'])
        summary.totalRemunerations = remunerations.length
        
        remunerations.forEach((rem: any) => {
          const periode = rem.mois_paie || new Date().toISOString().slice(0, 7)
          let periodData = summary.byPeriod.find(bp => bp.periode === periode)
          if (!periodData) {
            periodData = { periode, employees: 0, remunerations: 0, absences: 0 }
            summary.byPeriod.push(periodData)
          }
          periodData.remunerations++
        })
      }
      
      // Analyze ABSENCES sheet
      if (wb.Sheets['ABSENCES']) {
        const absences = XLSX.utils.sheet_to_json(wb.Sheets['ABSENCES'])
        summary.totalAbsences = absences.length
        
        absences.forEach((abs: any) => {
          const periode = abs.periode_reference || new Date().toISOString().slice(0, 7)
          let periodData = summary.byPeriod.find(bp => bp.periode === periode)
          if (!periodData) {
            periodData = { periode, employees: 0, remunerations: 0, absences: 0 }
            summary.byPeriod.push(periodData)
          }
          periodData.absences++
        })
      }
      
      summary.byPeriod.sort((a, b) => a.periode.localeCompare(b.periode))
      setImportSummary(summary)
      
    } catch (error) {
      console.error('File analysis error:', error)
    }
  }

  const processImport = async () => {
    if (!file || !company) {
      setErrorMessage('Entreprise non trouvée. Veuillez rafraîchir la page.')
      return
    }
    
    setIsProcessing(true)
    setImportStatus('processing')
    setErrorMessage(null)
    setProcessedPeriods([])
    
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      
      // Check required sheets
      if (!wb.Sheets['EMPLOYES']) {
        throw new Error('Feuille "EMPLOYES" non trouvée')
      }
      
      const employees = XLSX.utils.sheet_to_json(wb.Sheets['EMPLOYES'])
      const remunerations = wb.Sheets['REMUNERATION'] 
        ? XLSX.utils.sheet_to_json(wb.Sheets['REMUNERATION']) 
        : []
      const absences = wb.Sheets['ABSENCES'] 
        ? XLSX.utils.sheet_to_json(wb.Sheets['ABSENCES']) 
        : []
      
      // Helper function to format dates
      const formatDate = (date: any) => {
        if (!date) return null
        if (date instanceof Date) return date.toISOString().split('T')[0]
        if (typeof date === 'number') {
          const excelDate = new Date((date - 25569) * 86400 * 1000)
          return excelDate.toISOString().split('T')[0]
        }
        if (typeof date === 'string') {
          const parsed = new Date(date)
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0]
          }
        }
        return date
      }
      
      // Group data by period
      const dataByPeriod = new Map<string, {
        employees: any[]
        remunerations: any[]
        absences: any[]
      }>()
      
      // Process employees by period
      employees.forEach((emp: any) => {
        const periode = emp.periode || new Date().toISOString().slice(0, 7)
        if (!dataByPeriod.has(periode)) {
          dataByPeriod.set(periode, { employees: [], remunerations: [], absences: [] })
        }
        dataByPeriod.get(periode)!.employees.push(emp)
      })
      
      // Process remunerations by period
      remunerations.forEach((rem: any) => {
        const periode = rem.mois_paie || new Date().toISOString().slice(0, 7)
        if (!dataByPeriod.has(periode)) {
          dataByPeriod.set(periode, { employees: [], remunerations: [], absences: [] })
        }
        dataByPeriod.get(periode)!.remunerations.push(rem)
      })
      
      // Process absences by period
      absences.forEach((abs: any) => {
        const periode = abs.periode_reference || new Date().toISOString().slice(0, 7)
        if (!dataByPeriod.has(periode)) {
          dataByPeriod.set(periode, { employees: [], remunerations: [], absences: [] })
        }
        dataByPeriod.get(periode)!.absences.push(abs)
      })
      
      // Sort periods chronologically
      const sortedPeriods = Array.from(dataByPeriod.keys()).sort()
      
      // Process each period
      for (const periode of sortedPeriods) {
        setCurrentProcessingPeriod(periode)
        const periodData = dataByPeriod.get(periode)!
        
        // Format periode as date
        const periodeDate = `${periode}-01`
        
        // Process employees for this period
        for (const emp of periodData.employees) {
          const employeeData = {
            etablissement_id: company.id,
            matricule: emp.matricule?.toString() || `EMP${Date.now()}`,
            nom: emp.nom || 'INCONNU',
            prenom: emp.prenom || 'Inconnu',
            sexe: emp.sexe || 'A',
            date_naissance: formatDate(emp.date_naissance),
            date_entree: formatDate(emp.date_entree) || periodeDate,
            date_sortie: formatDate(emp.date_sortie),
            type_contrat: emp.type_contrat || 'CDI',
            temps_travail: parseFloat(emp.temps_travail) || 1.0,
            intitule_poste: emp.intitule_poste || 'Non spécifié',
            salaire_base_mensuel: parseFloat(emp.salaire_base_mensuel) || 0,
            statut_emploi: emp.statut_emploi || 'Actif',
            code_cost_center: emp.code_cost_center,
            code_site: emp.code_site,
            manager_matricule: emp.manager_matricule,
            periode: periodeDate,
            statut_periode: emp.statut_periode || 'Actif'
          }
          
          await supabase
            .from('employes')
            .upsert(employeeData, { 
              onConflict: 'etablissement_id,matricule,periode',
              ignoreDuplicates: false 
            })
        }
        
        // Process remunerations for this period
        for (const rem of periodData.remunerations) {
          // Get employee ID
          const { data: employee } = await supabase
            .from('employes')
            .select('id')
            .eq('etablissement_id', company.id)
            .eq('matricule', rem.matricule)
            .eq('periode', periodeDate)
            .single()
          
          if (employee) {
            const remunerationData = {
              etablissement_id: company.id,
              employe_id: employee.id,
              matricule: rem.matricule,
              mois_paie: periodeDate,
              type_contrat: rem.type_contrat || 'CDI',
              etp_paie: parseFloat(rem.etp_paie) || 1.0,
              salaire_de_base: parseFloat(rem.salaire_de_base) || 0,
              primes_fixes: parseFloat(rem.primes_fixes) || 0,
              primes_variables: parseFloat(rem.primes_variables) || 0,
              heures_supp_payees: parseFloat(rem.heures_supp_payees) || 0,
              avantages_nature: parseFloat(rem.avantages_nature) || 0,
              autres_elements_bruts: parseFloat(rem.autres_elements_bruts) || 0,
              cotisations_sociales: parseFloat(rem.cotisations_sociales) || 0,
              taxes_sur_salaire: parseFloat(rem.taxes_sur_salaire) || 0,
              mutuelle_employeur: parseFloat(rem.mutuelle_employeur) || 0,
              prevoyance_employeur: parseFloat(rem.prevoyance_employeur) || 0,
              indemnites_rupture: parseFloat(rem.indemnites_rupture) || 0,
              litige_rh: parseFloat(rem.litige_rh) || 0,
              remboursement_transport: parseFloat(rem.remboursement_transport) || 0,
              absences_remunerees: parseFloat(rem.absences_remunerees) || 0,
              stock_cp_jours: parseFloat(rem.stock_cp_jours) || 0,
              stock_rtt_jours: parseFloat(rem.stock_rtt_jours) || 0,
              valeur_cp_provisionnee: parseFloat(rem.valeur_cp_provisionnee) || 0,
              valeur_rtt_provisionnee: parseFloat(rem.valeur_rtt_provisionnee) || 0,
              code_cost_center: rem.code_cost_center,
              code_site: rem.code_site,
              fonction_categorie: rem.fonction_categorie,
              commentaire_paie: rem.commentaire_paie
            }
            
            await supabase
              .from('remunerations')
              .upsert(remunerationData, {
                onConflict: 'etablissement_id,matricule,mois_paie'
              })
          }
        }
        
        // Process absences for this period
        for (const abs of periodData.absences) {
          // Get employee ID
          const { data: employee } = await supabase
            .from('employes')
            .select('id')
            .eq('etablissement_id', company.id)
            .eq('matricule', abs.matricule)
            .eq('periode', periodeDate)
            .single()
          
          if (employee) {
            const absenceData = {
              etablissement_id: company.id,
              employe_id: employee.id,
              matricule: abs.matricule,
              type_absence: abs.type_absence || 'Non spécifié',
              date_debut: formatDate(abs.date_debut) || periodeDate,
              date_fin: formatDate(abs.date_fin) || periodeDate,
              nb_jours_ouvres: parseInt(abs.nb_jours_ouvres) || 1,
              motif: abs.motif,
              justificatif_fourni: abs.justificatif_fourni === 'OUI' || abs.justificatif_fourni === true,
              impact_paie: abs.impact_paie !== 'NON' && abs.impact_paie !== false,
              cout_absence: parseFloat(abs.cout_absence) || 0,
              statut: abs.statut || 'Validé',
              periode_reference: periodeDate
            }
            
            await supabase
              .from('absences')
              .insert(absenceData)
          }
        }
        
        // Calculate snapshot for this period
        await supabase.rpc('calculate_monthly_snapshot', {
          p_etablissement_id: company.id,
          p_periode: periodeDate
        })
        
        setProcessedPeriods(prev => [...prev, periode])
      }
      
      setImportStatus('success')
      setCurrentProcessingPeriod(null)
      
      // Redirect after success
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
      
    } catch (error: any) {
      console.error('Import error:', error)
      setImportStatus('error')
      setErrorMessage(error.message || 'Échec de l\'import')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    
    // EMPLOYES sheet with periode column
    const employeesData = [
      ['matricule', 'nom', 'prenom', 'sexe', 'date_naissance', 'date_entree', 'date_sortie', 'type_contrat', 'temps_travail', 'intitule_poste', 'salaire_base_mensuel', 'code_cost_center', 'code_site', 'manager_matricule', 'statut_emploi', 'periode', 'statut_periode'],
      ['E001', 'MARTIN', 'Sophie', 'F', '1985-06-15', '2020-03-01', '', 'CDI', '1', 'Directrice RH', '5500', 'CC001', 'PAR', '', 'Actif', '2024-01', 'Actif'],
      ['E001', 'MARTIN', 'Sophie', 'F', '1985-06-15', '2020-03-01', '', 'CDI', '1', 'Directrice RH', '5500', 'CC001', 'PAR', '', 'Actif', '2024-02', 'Actif'],
      ['E001', 'MARTIN', 'Sophie', 'F', '1985-06-15', '2020-03-01', '', 'CDI', '1', 'Directrice RH', '5600', 'CC001', 'PAR', '', 'Actif', '2024-03', 'Actif'],
      ['E002', 'DUBOIS', 'Pierre', 'M', '1990-02-20', '2021-01-15', '', 'CDI', '1', 'Responsable Paie', '4200', 'CC001', 'PAR', 'E001', 'Actif', '2024-01', 'Actif'],
      ['E002', 'DUBOIS', 'Pierre', 'M', '1990-02-20', '2021-01-15', '', 'CDI', '1', 'Responsable Paie', '4200', 'CC001', 'PAR', 'E001', 'Actif', '2024-02', 'Actif'],
      ['E002', 'DUBOIS', 'Pierre', 'M', '1990-02-20', '2021-01-15', '2024-03-31', 'CDI', '1', 'Responsable Paie', '4200', 'CC001', 'PAR', 'E001', 'Actif', '2024-03', 'Sortant'],
      ['E003', 'MOREAU', 'Julie', 'F', '1988-11-30', '2019-09-01', '', 'CDI', '0.8', 'Chargée RH', '3500', 'CC001', 'PAR', 'E001', 'Actif', '2024-01', 'Actif'],
      ['E003', 'MOREAU', 'Julie', 'F', '1988-11-30', '2019-09-01', '', 'CDI', '0.8', 'Chargée RH', '3500', 'CC001', 'PAR', 'E001', 'Actif', '2024-02', 'Actif'],
      ['E003', 'MOREAU', 'Julie', 'F', '1988-11-30', '2019-09-01', '', 'CDI', '0.8', 'Chargée RH', '3500', 'CC001', 'PAR', 'E001', 'Actif', '2024-03', 'Actif'],
      ['E004', 'PETIT', 'Thomas', 'M', '1995-04-10', '2024-02-01', '', 'CDD', '1', 'Assistant RH', '2500', 'CC001', 'PAR', 'E002', 'Actif', '2024-02', 'Entrant'],
      ['E004', 'PETIT', 'Thomas', 'M', '1995-04-10', '2024-02-01', '', 'CDD', '1', 'Assistant RH', '2500', 'CC001', 'PAR', 'E001', 'Actif', '2024-03', 'Actif']
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(employeesData)
    XLSX.utils.book_append_sheet(wb, ws1, 'EMPLOYES')
    
    // REMUNERATION sheet (mois_paie already exists)
    const remunerationData = [
      ['matricule', 'mois_paie', 'type_contrat', 'etp_paie', 'salaire_de_base', 'primes_fixes', 'primes_variables', 'heures_supp_payees', 'avantages_nature', 'autres_elements_bruts', 'cotisations_sociales', 'taxes_sur_salaire', 'mutuelle_employeur', 'prevoyance_employeur', 'stock_cp_jours', 'stock_rtt_jours', 'valeur_cp_provisionnee', 'valeur_rtt_provisionnee'],
      ['E001', '2024-01', 'CDI', '1', '5500', '500', '800', '0', '150', '0', '1800', '220', '55', '65', '20', '8', '2500', '800'],
      ['E001', '2024-02', 'CDI', '1', '5500', '500', '600', '0', '150', '0', '1800', '220', '55', '65', '21', '8', '2600', '800'],
      ['E001', '2024-03', 'CDI', '1', '5600', '500', '1000', '0', '150', '0', '1850', '224', '56', '65', '22', '7', '2700', '700'],
      ['E002', '2024-01', 'CDI', '1', '4200', '300', '400', '150', '100', '0', '1400', '168', '45', '50', '15', '5', '1800', '500'],
      ['E002', '2024-02', 'CDI', '1', '4200', '300', '300', '0', '100', '0', '1400', '168', '45', '50', '16', '5', '1900', '500'],
      ['E002', '2024-03', 'CDI', '1', '4200', '300', '500', '0', '100', '0', '1400', '168', '45', '50', '0', '0', '0', '0'],
      ['E003', '2024-01', 'CDI', '0.8', '2800', '200', '0', '0', '80', '0', '900', '112', '35', '40', '18', '6', '1600', '480'],
      ['E003', '2024-02', 'CDI', '0.8', '2800', '200', '0', '0', '80', '0', '900', '112', '35', '40', '19', '6', '1700', '480'],
      ['E003', '2024-03', 'CDI', '0.8', '2800', '200', '200', '0', '80', '0', '900', '112', '35', '40', '20', '5', '1800', '400'],
      ['E004', '2024-02', 'CDD', '1', '2500', '0', '0', '200', '80', '0', '800', '100', '30', '35', '0', '0', '0', '0'],
      ['E004', '2024-03', 'CDD', '1', '2500', '0', '0', '150', '80', '0', '800', '100', '30', '35', '2', '0', '200', '0']
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(remunerationData)
    XLSX.utils.book_append_sheet(wb, ws2, 'REMUNERATION')
    
    // ABSENCES sheet with periode_reference
    const absencesData = [
      ['matricule', 'type_absence', 'date_debut', 'date_fin', 'nb_jours_ouvres', 'periode_reference'],
      ['E001', 'Congés_payés', '2024-01-15', '2024-01-19', '5', '2024-01'],
      ['E002', 'Maladie_courte', '2024-01-10', '2024-01-12', '3', '2024-01'],
      ['E003', 'RTT', '2024-02-20', '2024-02-21', '2', '2024-02'],
      ['E001', 'Formation', '2024-02-05', '2024-02-07', '3', '2024-02'],
      ['E002', 'Congés_payés', '2024-03-11', '2024-03-15', '5', '2024-03'],
      ['E003', 'Maladie_courte', '2024-03-25', '2024-03-26', '2', '2024-03']
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(absencesData)
    XLSX.utils.book_append_sheet(wb, ws3, 'ABSENCES')
    
    const fileName = `rh_quantum_multi_period_template.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #22d3ee 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '8px'
        }}>
          Import Multi-Périodes
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '18px' }}>
          Importez plusieurs mois de données en une seule fois
        </p>
      </div>

      {/* Info Box */}
      <div style={{
        background: 'rgba(139, 92, 246, 0.1)',
        borderRadius: '16px',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Info size={20} color="#a78bfa" style={{ marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
              Nouveau : Import Multi-Périodes
            </h3>
            <p style={{ fontSize: '14px', color: '#e5e7eb', marginBottom: '12px' }}>
              Vous pouvez maintenant importer plusieurs mois de données historiques en une seule fois.
            </p>
            <ul style={{ fontSize: '13px', color: '#9ca3af', paddingLeft: '20px', margin: 0 }}>
              <li>Ajoutez une colonne "periode" (format: YYYY-MM) dans l'onglet EMPLOYES</li>
              <li>Utilisez "mois_paie" dans REMUNERATION</li>
              <li>Ajoutez "periode_reference" dans ABSENCES</li>
              <li>Le système calculera automatiquement les évolutions et tendances</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Download Template */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '24px',
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
            Template Multi-Périodes
          </h3>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
            Téléchargez le nouveau modèle avec support multi-périodes
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
          }}
        >
          <Download size={20} />
          Télécharger Template Multi-Périodes
        </button>
      </div>

      {/* Upload Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '32px',
        marginBottom: '32px'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>
          Importez votre fichier
        </h3>
        
        <div
          {...getRootProps()}
          style={{
            border: '2px dashed',
            borderColor: isDragActive ? '#8b5cf6' : 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            background: isDragActive ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            cursor: 'pointer'
          }}
        >
          <input {...getInputProps()} />
          
          {file ? (
            <div>
              <FileSpreadsheet size={48} color="#8b5cf6" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>{file.name}</p>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
                {(file.size / 1024).toFixed(2)} KB
              </p>
              
              {importSummary && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600' }}>Analyse du fichier</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailsExpanded(!detailsExpanded)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer'
                      }}
                    >
                      {detailsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div>
                      <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Périodes</p>
                      <p style={{ fontSize: '18px', fontWeight: '600' }}>{importSummary.totalPeriods}</p>
                    </div>
                    <div>
                      <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Employés</p>
                      <p style={{ fontSize: '18px', fontWeight: '600' }}>{importSummary.totalEmployees}</p>
                    </div>
                    <div>
                      <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Rémunérations</p>
                      <p style={{ fontSize: '18px', fontWeight: '600' }}>{importSummary.totalRemunerations}</p>
                    </div>
                    <div>
                      <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Absences</p>
                      <p style={{ fontSize: '18px', fontWeight: '600' }}>{importSummary.totalAbsences}</p>
                    </div>
                  </div>
                  
                  {detailsExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
                        Détail par période :
                      </p>
                      {importSummary.byPeriod.map((period, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px',
                          background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}>
                          <span style={{ fontWeight: '500' }}>{period.periode}</span>
                          <span style={{ color: '#9ca3af' }}>
                            {period.employees} emp. / {period.remunerations} rém. / {period.absences} abs.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {importStatus === 'idle' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    processImport()
                  }}
                  style={{
                    padding: '12px 32px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Démarrer l'Import
                </button>
              )}
            </div>
          ) : (
            <div>
              <Upload size={48} color="#9ca3af" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: '20px', fontWeight: '500', marginBottom: '8px' }}>
                Glissez-déposez votre fichier Excel
              </p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                ou cliquez pour parcourir
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Import Status */}
      {importStatus === 'processing' && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Loader2 size={32} color="#8b5cf6" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                Import en cours...
              </p>
              {currentProcessingPeriod && (
                <p style={{ color: '#a78bfa', fontSize: '14px' }}>
                  Traitement de la période : {currentProcessingPeriod}
                </p>
              )}
            </div>
          </div>
          
          {processedPeriods.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>
                Périodes traitées :
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {processedPeriods.map((period, index) => (
                  <span key={index} style={{
                    padding: '4px 12px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle size={14} />
                    {period}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {importStatus === 'success' && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
            Import Multi-Périodes Réussi!
          </p>
          <p style={{ color: '#10b981', marginBottom: '16px' }}>
            {processedPeriods.length} périodes importées avec succès
          </p>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
            Redirection vers le tableau de bord...
          </p>
        </div>
      )}

      {importStatus === 'error' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <XCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>Erreur d'Import</p>
          <p style={{ color: '#ef4444' }}>{errorMessage}</p>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}