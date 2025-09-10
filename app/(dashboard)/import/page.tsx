'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import React from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Download,
  Building2,
  ArrowRight,
  X,
  Database,
  Server,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Zap,
  Activity,
  FileCheck,
  BookOpen,
  ChevronRight,
  AlertTriangle,
  FileX,
  ShieldAlert,
  Clock,
  Users
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface Company {
  id: string
  nom: string
  code_entreprise?: string
  user_id: string
  subscription_plan: string
  ai_features_enabled?: boolean
  max_establishments: number
  max_employees: number
}

interface Establishment {
  id: string
  entreprise_id: string
  nom: string
  code_etablissement: string
  is_default: boolean
  is_headquarters: boolean
  statut: string
}

interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  totalRows: number
  validRows: number
  summary: {
    criticalErrors: number
    formatErrors: number
    referenceErrors: number
    qualityScore: number
  }
}

interface ValidationError {
  sheet: string
  row: number
  field: string
  value: any
  message: string
  type: 'missing' | 'format' | 'reference' | 'warning'
  suggestion?: string
  severity: 'critical' | 'medium' | 'low'
}

interface FileError {
  type: 'missing_sheets' | 'sheet_error' | 'general_error'
  message: string
  details?: string
  missing?: string[]
  found?: string[]
  sheet?: string
  expectedStructure?: string[]
}

interface ImportProgress {
  phase: 'validation' | 'processing' | 'completion'
  step: string
  current: number
  total: number
  percentage: number
  message: string
}

interface ProcessedData {
  employees: any[]
  remunerations: any[]
  absences: any[]
  referentiel_organisation: any[]
  referentiel_absences: any[]
  metadata: {
    periods: string[]
    totalEmployees: number
    sheetsFound: string[]
    dataQuality: {
      completeness: number
      consistency: number
      accuracy: number
    }
  }
}

// ==========================================
// CONSTANTS
// ==========================================

const REQUIRED_SHEETS = ['EMPLOYES', 'REMUNERATION', 'ABSENCES', 'REFERENTIEL_ORGANISATION', 'REFERENTIEL_ABSENCES']
const CONTRACT_TYPES = ['CDI', 'CDD', 'Alternance', 'Stage', 'Intérim', 'Freelance', 'Apprentissage']
const EMPLOYMENT_STATUS = ['Actif', 'Inactif', 'Suspendu']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const formatDateToISO = (date: any): string | null => {
  if (!date) return null
  
  try {
    if (typeof date === 'number' && date > 59) {
      const excelDate = new Date((date - 25569) * 86400 * 1000)
      if (!isNaN(excelDate.getTime())) {
        return excelDate.toISOString().split('T')[0]
      }
    }
    
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
    
    if (typeof date === 'string') {
      const dateStr = date.trim()
      
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/')
        const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0]
        }
      }
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr
      }
    }
  } catch (err) {
    console.warn('Date parsing error:', err)
  }
  
  return null
}

const normalizePeriod = (period: any): string => {
  if (!period) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  
  const periodStr = String(period).trim()
  
  if (/^\d{4}-\d{1,2}$/.test(periodStr)) {
    const [year, month] = periodStr.split('-')
    return `${year}-${month.padStart(2, '0')}-01`
  }
  
  if (/^\d{1,2}\/\d{4}$/.test(periodStr)) {
    const [month, year] = periodStr.split('/')
    return `${year}-${month.padStart(2, '0')}-01`
  }
  
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

const sanitizeString = (str: any, maxLength: number = 255): string => {
  if (!str) return ''
  return String(str).trim().substring(0, maxLength)
}

const sanitizeNumber = (val: any, min: number = 0): number => {
  const num = parseFloat(val)
  if (isNaN(num)) return min
  return Math.max(min, num)
}

// ==========================================
// VALIDATION ENGINE
// ==========================================

const validateData = (data: ProcessedData): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const { employees, remunerations, absences, referentiel_organisation, referentiel_absences } = data

  // Validate EMPLOYES
  employees.forEach((emp, index) => {
    const row = index + 2
    
    if (!emp.matricule) {
      errors.push({
        sheet: 'EMPLOYES', row, field: 'matricule', value: emp.matricule,
        message: 'Matricule obligatoire', type: 'missing', severity: 'critical',
        suggestion: 'Ajoutez un identifiant unique (ex: E001, EMP123)'
      })
    }
    
    if (!emp.periode) {
      errors.push({
        sheet: 'EMPLOYES', row, field: 'periode', value: emp.periode,
        message: 'Période obligatoire', type: 'missing', severity: 'critical',
        suggestion: 'Format: YYYY-MM (ex: 2025-05)'
      })
    }
    
    if (!formatDateToISO(emp.date_entree)) {
      errors.push({
        sheet: 'EMPLOYES', row, field: 'date_entree', value: emp.date_entree,
        message: 'Date d\'entrée obligatoire', type: 'format', severity: 'critical',
        suggestion: 'Format: JJ/MM/AAAA (ex: 15/03/2025)'
      })
    }
    
    if (!emp.intitule_poste || String(emp.intitule_poste).trim() === '') {
      errors.push({
        sheet: 'EMPLOYES', row, field: 'intitule_poste', value: emp.intitule_poste,
        message: 'Intitulé du poste obligatoire', type: 'missing', severity: 'critical',
        suggestion: 'Précisez la fonction (ex: Développeur, Manager)'
      })
    }
    
    if (emp.type_contrat && !CONTRACT_TYPES.includes(emp.type_contrat)) {
      errors.push({
        sheet: 'EMPLOYES', row, field: 'type_contrat', value: emp.type_contrat,
        message: 'Type de contrat non reconnu', type: 'format', severity: 'medium',
        suggestion: `Valeurs autorisées: ${CONTRACT_TYPES.join(', ')}`
      })
    }
    
    if (emp.temps_travail) {
      const workTime = parseFloat(emp.temps_travail)
      if (isNaN(workTime) || workTime <= 0 || workTime > 1) {
        errors.push({
          sheet: 'EMPLOYES', row, field: 'temps_travail', value: emp.temps_travail,
          message: 'Temps de travail invalide', type: 'format', severity: 'medium',
          suggestion: 'Valeur entre 0.1 et 1.0 (ex: 1=100%, 0.8=80%)'
        })
      }
    }
  })

  // Validate REMUNERATION
  remunerations.forEach((rem, index) => {
    const row = index + 2
    
    if (!rem.matricule) {
      errors.push({
        sheet: 'REMUNERATION', row, field: 'matricule', value: rem.matricule,
        message: 'Matricule obligatoire', type: 'missing', severity: 'critical',
        suggestion: 'Doit correspondre à un matricule de EMPLOYES'
      })
    }
    
    if (!rem.mois_paie) {
      errors.push({
        sheet: 'REMUNERATION', row, field: 'mois_paie', value: rem.mois_paie,
        message: 'Mois de paie obligatoire', type: 'missing', severity: 'critical',
        suggestion: 'Format: YYYY-MM (ex: 2025-05)'
      })
    }
  })

  // Validate ABSENCES
  absences.forEach((abs, index) => {
    const row = index + 2
    
    if (!abs.matricule) {
      errors.push({
        sheet: 'ABSENCES', row, field: 'matricule', value: abs.matricule,
        message: 'Matricule obligatoire', type: 'missing', severity: 'critical'
      })
    }
    
    if (!abs.type_absence) {
      errors.push({
        sheet: 'ABSENCES', row, field: 'type_absence', value: abs.type_absence,
        message: 'Type d\'absence obligatoire', type: 'missing', severity: 'critical'
      })
    }
    
    if (!formatDateToISO(abs.date_debut)) {
      errors.push({
        sheet: 'ABSENCES', row, field: 'date_debut', value: abs.date_debut,
        message: 'Date de début obligatoire', type: 'format', severity: 'critical',
        suggestion: 'Format: JJ/MM/AAAA'
      })
    }
    
    if (!formatDateToISO(abs.date_fin)) {
      errors.push({
        sheet: 'ABSENCES', row, field: 'date_fin', value: abs.date_fin,
        message: 'Date de fin obligatoire', type: 'format', severity: 'critical',
        suggestion: 'Format: JJ/MM/AAAA'
      })
    }
  })

  // Cross-reference validations
  const employeeMatricules = new Set(employees.map(e => e.matricule).filter(Boolean))
  const absenceTypes = new Set(referentiel_absences.map(a => a.type_absence).filter(Boolean))

  remunerations.forEach((rem, index) => {
    if (rem.matricule && !employeeMatricules.has(rem.matricule)) {
      errors.push({
        sheet: 'REMUNERATION', row: index + 2, field: 'matricule', value: rem.matricule,
        message: 'Matricule non trouvé dans EMPLOYES', type: 'reference', severity: 'critical'
      })
    }
  })

  absences.forEach((abs, index) => {
    if (abs.matricule && !employeeMatricules.has(abs.matricule)) {
      errors.push({
        sheet: 'ABSENCES', row: index + 2, field: 'matricule', value: abs.matricule,
        message: 'Matricule non trouvé dans EMPLOYES', type: 'reference', severity: 'critical'
      })
    }
    if (abs.type_absence && !absenceTypes.has(abs.type_absence)) {
      errors.push({
        sheet: 'ABSENCES', row: index + 2, field: 'type_absence', value: abs.type_absence,
        message: 'Type absence non défini dans REFERENTIEL_ABSENCES', type: 'reference', severity: 'medium'
      })
    }
  })

  const totalRows = employees.length + remunerations.length + absences.length
  const criticalErrors = errors.filter(e => e.severity === 'critical').length
  const validRows = totalRows - errors.length
  const qualityScore = Math.max(0, Math.min(100, 100 - (criticalErrors * 5) - (errors.length * 2) - (warnings.length * 0.5)))

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalRows,
    validRows,
    summary: {
      criticalErrors,
      formatErrors: errors.filter(e => e.type === 'format').length,
      referenceErrors: errors.filter(e => e.type === 'reference').length,
      qualityScore: Math.round(qualityScore)
    }
  }
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function OptimizedImportPage() {
  // State management
  const [file, setFile] = useState<File | null>(null)
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'validating' | 'processing' | 'success' | 'error'>('idle')
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: 'validation',
    step: '',
    current: 0,
    total: 0,
    percentage: 0,
    message: ''
  })
  const [error, setError] = useState<string | FileError | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null)
  const [user, setUser] = useState<any>(null)
  const [showDocumentation, setShowDocumentation] = useState(false)
  
  // Refs
  const startTimeRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Hooks
  const supabase = createClient()
  const router = useRouter()

  // ==========================================
  // INITIALIZATION
  // ==========================================

  useEffect(() => {
    initializeUser()
  }, [])

  const initializeUser = async () => {
    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !currentUser) {
        router.push('/auth/login')
        return
      }
      
      setUser(currentUser)

      let { data: companyData, error: companyError } = await supabase
        .from('entreprises')
        .select(`*, etablissements (*)`)
        .eq('user_id', currentUser.id)
        .single()

      if (companyError) {
        if (companyError.code === 'PGRST116') {
          const companyCode = `${currentUser.id.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`
          const companyName = currentUser.user_metadata?.company_name || 'Mon Entreprise'
          
          const { data: newEstablishmentId, error: createError } = await supabase.rpc('setup_new_company', {
            p_user_id: currentUser.id,
            p_company_name: companyName,
            p_company_code: companyCode
          })

          if (createError) throw createError

          const { data: newCompanyData, error: fetchError } = await supabase
            .from('entreprises')
            .select(`*, etablissements (*)`)
            .eq('user_id', currentUser.id)
            .single()

          if (fetchError) throw fetchError
          companyData = newCompanyData
        } else {
          throw companyError
        }
      }

      if (companyData) {
        setCompany(companyData as Company)
        const establishmentsData = companyData.etablissements || []
        setEstablishments(establishmentsData)
        
        const defaultEstablishment = establishmentsData.find((e: any) => e.is_headquarters) ||
                                    establishmentsData.find((e: any) => e.is_default) ||
                                    establishmentsData[0]
        if (defaultEstablishment) {
          setSelectedEstablishment(defaultEstablishment as Establishment)
        }
      }
    } catch (error) {
      console.error('Initialization error:', error)
      setError(`Erreur d'initialisation: ${error}`)
    }
  }

  // ==========================================
  // FILE HANDLING
  // ==========================================

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const droppedFile = acceptedFiles[0]
    if (droppedFile) {
      if (droppedFile.size > MAX_FILE_SIZE) {
        setError(`Fichier trop volumineux. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
        return
      }
      
      setFile(droppedFile)
      setImportStatus('idle')
      setError(null)
      setValidationResult(null)
      setProcessedData(null)
      analyzeFile(droppedFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE
  })

  // ==========================================
  // FILE ANALYSIS
  // ==========================================

  const analyzeFile = async (file: File) => {
    try {
      setImportStatus('validating')
      setImportProgress({
        phase: 'validation',
        step: 'Lecture du fichier...',
        current: 0,
        total: 100,
        percentage: 10,
        message: 'Analyse du contenu Excel'
      })

      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { 
        type: 'array', 
        cellDates: true,
        cellNF: true,
        raw: false
      })
      
      const foundSheets = wb.SheetNames
      const missingSheets = REQUIRED_SHEETS.filter(sheet => !foundSheets.includes(sheet))
      
      if (missingSheets.length > 0) {
        setError({
          type: 'missing_sheets',
          missing: missingSheets,
          found: foundSheets,
          message: `Structure incomplète : ${missingSheets.length} onglet(s) manquant(s)`,
          expectedStructure: REQUIRED_SHEETS
        })
        setImportStatus('error')
        return
      }

      setImportProgress({
        phase: 'validation',
        step: 'Extraction des données...',
        current: 30,
        total: 100,
        percentage: 30,
        message: 'Lecture des 5 onglets requis'
      })

      let employees = []
      let remunerations = []
      let absences = []
      let referentiel_organisation = []
      let referentiel_absences = []

      try {
        employees = XLSX.utils.sheet_to_json(wb.Sheets['EMPLOYES'], { defval: null, raw: false })
        if (employees.length === 0) {
          throw new Error('Aucun employé trouvé')
        }
        
        remunerations = XLSX.utils.sheet_to_json(wb.Sheets['REMUNERATION'], { defval: null, raw: false })
        absences = XLSX.utils.sheet_to_json(wb.Sheets['ABSENCES'], { defval: null, raw: false })
        referentiel_organisation = XLSX.utils.sheet_to_json(wb.Sheets['REFERENTIEL_ORGANISATION'], { defval: null, raw: false })
        referentiel_absences = XLSX.utils.sheet_to_json(wb.Sheets['REFERENTIEL_ABSENCES'], { defval: null, raw: false })
      } catch (err) {
  setError({
    type: 'sheet_error',
    message: 'Erreur lors de la lecture des données',
    details: err instanceof Error ? err.message : String(err)
  })
  setImportStatus('error')
  return
}

      setImportProgress({
        phase: 'validation',
        step: 'Validation des données...',
        current: 70,
        total: 100,
        percentage: 70,
        message: 'Vérification de la conformité'
      })

      const periods = [...new Set([
        ...employees.map((e: any) => normalizePeriod(e.periode)),
        ...remunerations.map((r: any) => normalizePeriod(r.mois_paie))
      ])].filter(Boolean).sort()

      const completenessScore = Math.round((employees.filter((e: any) => e.matricule && e.periode && e.intitule_poste).length / employees.length) * 100)
const consistencyScore = Math.round((remunerations.filter((r: any) => r.matricule && r.mois_paie).length / Math.max(remunerations.length, 1)) * 100)

      const processedData: ProcessedData = {
        employees,
        remunerations,
        absences,
        referentiel_organisation,
        referentiel_absences,
        metadata: {
          periods,
          totalEmployees: employees.length,
          sheetsFound: foundSheets,
          dataQuality: {
            completeness: completenessScore,
            consistency: consistencyScore,
            accuracy: Math.round((completenessScore + consistencyScore) / 2)
          }
        }
      }

      setProcessedData(processedData)

      const validationResult = validateData(processedData)
      setValidationResult(validationResult)

      setImportProgress({
        phase: 'validation',
        step: 'Analyse terminée',
        current: 100,
        total: 100,
        percentage: 100,
        message: validationResult.isValid ? 
          `Fichier valide - Qualité: ${validationResult.summary.qualityScore}%` : 
          `${validationResult.errors.length} erreur(s) détectée(s)`
      })

      setImportStatus('idle')
    } catch (error) {
  console.error('File analysis error:', error)
  setError({
    type: 'general_error',
    message: 'Erreur lors de l\'analyse du fichier',
    details: error instanceof Error ? error.message : String(error)
  })
  setImportStatus('error')
}
  }

  // ==========================================
  // IMPORT PROCESS
  // ==========================================

  const processImport = async () => {
    if (!processedData || !selectedEstablishment || !user || !validationResult?.isValid) {
      setError('Données invalides pour l\'import')
      return
    }

    try {
      setImportStatus('processing')
      setError(null)
      startTimeRef.current = Date.now()
      abortControllerRef.current = new AbortController()
      
      const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const { employees, remunerations, absences, referentiel_organisation, referentiel_absences, metadata } = processedData

      // Phase 1: Initialize batch
      setImportProgress({
        phase: 'processing',
        step: 'Initialisation',
        current: 0,
        total: 6,
        percentage: 10,
        message: 'Création du batch d\'import'
      })

      const { error: batchError } = await supabase
        .from('import_batches')
        .insert({
          id: batchId,
          etablissement_id: selectedEstablishment.id,
          file_name: file?.name,
          file_size_bytes: file?.size,
          status: 'processing',
          user_id: user.id,
          periods_imported: metadata.periods
        })

      if (batchError) throw batchError

      // Phase 2: Setup referentials
      setImportProgress({
        phase: 'processing',
        step: 'Configuration référentiels',
        current: 1,
        total: 6,
        percentage: 20,
        message: 'Import des référentiels'
      })

      if (referentiel_organisation.length > 0) {
        const orgData = referentiel_organisation.map((org: any) => ({
          etablissement_id: selectedEstablishment.id,
          code_site: sanitizeString(org.code_site, 20),
          nom_site: sanitizeString(org.nom_site, 255),
          siret_site: sanitizeString(org.siret_site || org.siret, 14),
          code_cost_center: sanitizeString(org.code_cost_center, 20),
          nom_cost_center: sanitizeString(org.nom_cost_center, 255)
        }))

        const { error: orgError } = await supabase
          .from('referentiel_organisation')
          .upsert(orgData, {
            onConflict: 'etablissement_id,code_site,code_cost_center',
            ignoreDuplicates: false
          })

        if (orgError) throw orgError
      }

      if (referentiel_absences.length > 0) {
        const absData = referentiel_absences.map((abs: any) => ({
          etablissement_id: selectedEstablishment.id,
          type_absence: sanitizeString(abs.type_absence, 100),
          famille: sanitizeString(abs.famille, 50),
          indemnise: abs.indemnise === 'OUI' || abs.indemnise === true,
          taux_indemnisation: sanitizeNumber(abs.taux_indemnisation, 0),
          comptabilise_absenteisme: abs.comptabilise_absenteisme !== 'NON' && abs.comptabilise_absenteisme !== false
        }))

        const { error: absError } = await supabase
          .from('referentiel_absences')
          .upsert(absData, {
            onConflict: 'etablissement_id,type_absence',
            ignoreDuplicates: false
          })

        if (absError) throw absError
      }

      // Phase 3: Import employees
      setImportProgress({
        phase: 'processing',
        step: 'Import des employés',
        current: 2,
        total: 6,
        percentage: 40,
        message: `Traitement de ${employees.length} employés`
      })

      const employeeData = employees.map((emp: any) => ({
        etablissement_id: selectedEstablishment.id,
        matricule: sanitizeString(emp.matricule, 50),
        periode: normalizePeriod(emp.periode),
        sexe: ['M', 'F', 'A'].includes(emp.sexe) ? emp.sexe : null,
        date_naissance: formatDateToISO(emp.date_naissance),
        date_entree: formatDateToISO(emp.date_entree) || normalizePeriod(emp.periode),
        date_sortie: formatDateToISO(emp.date_sortie),
        type_contrat: CONTRACT_TYPES.includes(emp.type_contrat) ? emp.type_contrat : 'CDI',
        temps_travail: sanitizeNumber(emp.temps_travail, 0.1),
        intitule_poste: sanitizeString(emp.intitule_poste, 255),
        code_cost_center: sanitizeString(emp.code_cost_center, 20),
        code_site: sanitizeString(emp.code_site, 20),
        manager_matricule: sanitizeString(emp.manager_matricule, 50),
        statut_emploi: EMPLOYMENT_STATUS.includes(emp.statut_emploi) ? emp.statut_emploi : 'Actif',
        import_batch_id: batchId
      }))

      const { data: insertedEmployees, error: employeeError } = await supabase
        .from('employes')
        .upsert(employeeData, {
          onConflict: 'etablissement_id,matricule,periode',
          ignoreDuplicates: false
        })
        .select('id, matricule, periode')

      if (employeeError) throw employeeError

      const employeeIdMap = new Map<string, string>()
      insertedEmployees?.forEach((emp: any) => {
        employeeIdMap.set(`${emp.matricule}_${emp.periode}`, emp.id)
      })

      // Phase 4: Import remunerations
      setImportProgress({
        phase: 'processing',
        step: 'Import des rémunérations',
        current: 3,
        total: 6,
        percentage: 60,
        message: `Traitement de ${remunerations.length} rémunérations`
      })

      if (remunerations.length > 0) {
        const remunerationData = remunerations
          .map((rem: any) => {
            const periode = normalizePeriod(rem.mois_paie)
            const employeeKey = `${rem.matricule}_${periode}`
            const employeeId = employeeIdMap.get(employeeKey)
            
            if (!employeeId) return null
            
            return {
              etablissement_id: selectedEstablishment.id,
              employe_id: employeeId,
              matricule: sanitizeString(rem.matricule, 50),
              mois_paie: periode,
              type_contrat: CONTRACT_TYPES.includes(rem.type_contrat) ? rem.type_contrat : 'CDI',
              etp_paie: sanitizeNumber(rem.etp_paie, 0),
              salaire_de_base: sanitizeNumber(rem.salaire_de_base, 0),
              primes_fixes: sanitizeNumber(rem.primes_fixes, 0),
              primes_variables: sanitizeNumber(rem.primes_variables, 0),
              heures_supp_payees: sanitizeNumber(rem.heures_supp_payees, 0),
              avantages_nature: sanitizeNumber(rem.avantages_nature, 0),
              cotisations_sociales: sanitizeNumber(rem.cotisations_sociales, 0),
              taxes_sur_salaire: sanitizeNumber(rem.taxes_sur_salaire, 0),
              import_batch_id: batchId
            }
          })
          .filter(Boolean)

        if (remunerationData.length > 0) {
          const { error: remError } = await supabase
            .from('remunerations')
            .upsert(remunerationData, {
              onConflict: 'etablissement_id,matricule,mois_paie',
              ignoreDuplicates: false
            })

          if (remError) throw remError
        }
      }

      // Phase 5: Import absences
      setImportProgress({
        phase: 'processing',
        step: 'Import des absences',
        current: 4,
        total: 6,
        percentage: 80,
        message: `Traitement de ${absences.length} absences`
      })

      if (absences.length > 0) {
        const absenceData = absences
          .map((abs: any) => {
            const employeeKey = `${abs.matricule}_${normalizePeriod(abs.date_debut)}`
            const employeeId = employeeIdMap.get(employeeKey)
            
            if (!employeeId) return null
            
            return {
              etablissement_id: selectedEstablishment.id,
              employe_id: employeeId,
              matricule: sanitizeString(abs.matricule, 50),
              type_absence: sanitizeString(abs.type_absence, 100),
              date_debut: formatDateToISO(abs.date_debut),
              date_fin: formatDateToISO(abs.date_fin),
              import_batch_id: batchId
            }
          })
          .filter(Boolean)

        if (absenceData.length > 0) {
          const { error: absError } = await supabase
            .from('absences')
            .upsert(absenceData, {
              onConflict: 'etablissement_id,matricule,date_debut,type_absence',
              ignoreDuplicates: false
            })

          if (absError) throw absError
        }
      }

      // Phase 6: Calculate KPIs
      setImportProgress({
        phase: 'processing',
        step: 'Calcul des KPIs',
        current: 5,
        total: 6,
        percentage: 90,
        message: 'Génération des indicateurs'
      })

      for (const periode of metadata.periods) {
        await supabase.rpc('calculate_snapshot_for_period', {
          p_etablissement_id: selectedEstablishment.id,
          p_periode: periode
        })
      }

      const processingTime = Date.now() - startTimeRef.current
      
      await supabase
        .from('import_batches')
        .update({
          status: 'completed',
          nb_employes_imported: employees.length,
          nb_remunerations_imported: remunerations.length,
          nb_absences_imported: absences.length,
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString()
        })
        .eq('id', batchId)

      setImportProgress({
        phase: 'completion',
        step: 'Import terminé',
        current: 6,
        total: 6,
        percentage: 100,
        message: 'Import réussi !'
      })

      setImportStatus('success')
      
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)

   } catch (error) {
  console.error('Import error:', error)
  const errorMessage = error instanceof Error ? error.message : String(error)
  setError(`Erreur d'import: ${errorMessage}`)
  setImportStatus('error')
}
  }

  const cancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setImportStatus('idle')
    }
  }

  // ==========================================
  // OPTIMIZED TEMPLATE GENERATION
  // ==========================================

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    
    // EMPLOYES sheet - 10 lignes pour 3 mois
    const employeesData = [
      ['periode', 'matricule', 'sexe', 'date_naissance', 'date_entree', 'date_sortie', 'type_contrat', 'temps_travail', 'intitule_poste', 'code_cost_center', 'code_site', 'manager_matricule', 'statut_emploi'],
      
      // Mai 2025
      ['2025-05', 'E001', 'F', '15/06/1985', '01/03/2020', '', 'CDI', '1', 'Directrice RH', 'RH001', '1000', '', 'Actif'],
      ['2025-05', 'E002', 'M', '22/11/1988', '15/09/2019', '', 'CDI', '1', 'CTO', 'IT001', '1000', '', 'Actif'],
      ['2025-05', 'E003', 'F', '12/04/1995', '20/03/2022', '', 'CDI', '0.8', 'Développeuse Frontend', 'IT002', '1000', 'E002', 'Actif'],
      ['2025-05', 'E004', 'M', '25/01/1987', '12/11/2019', '', 'CDI', '1', 'Commercial Senior', 'COM001', '1200', 'E002', 'Actif'],
      ['2025-05', 'E005', 'F', '08/03/2002', '01/09/2023', '', 'Alternance', '1', 'Alternante Marketing', 'MKT001', '1000', 'E001', 'Actif'],
      ['2025-05', 'E006', 'M', '14/11/1978', '01/06/2023', '', 'CDI', '1', 'Responsable Qualité', 'QUA001', '1000', 'E001', 'Actif'],
      ['2025-05', 'E007', 'F', '28/01/2000', '01/05/2025', '31/08/2025', 'Stage', '1', 'Stagiaire Communication', 'COM002', '1000', 'E004', 'Actif'],
      ['2025-05', 'E008', 'M', '03/07/1990', '15/01/2024', '', 'CDD', '1', 'Consultant IT', 'IT003', '1100', 'E002', 'Actif'],
      ['2025-05', 'E009', 'F', '18/12/1992', '01/04/2025', '', 'Freelance', '0.5', 'UX Designer', 'IT004', '1000', 'E002', 'Actif'],
      ['2025-05', 'E010', 'M', '09/08/1982', '10/02/2018', '', 'CDI', '1', 'Manager Commercial', 'COM001', '1200', '', 'Actif'],
      
      // Juin 2025 - Évolutions
      ['2025-06', 'E001', 'F', '15/06/1985', '01/03/2020', '', 'CDI', '1', 'Directrice RH', 'RH001', '1000', '', 'Actif'],
      ['2025-06', 'E002', 'M', '22/11/1988', '15/09/2019', '', 'CDI', '1', 'CTO', 'IT001', '1000', '', 'Actif'],
      ['2025-06', 'E003', 'F', '12/04/1995', '20/03/2022', '', 'CDI', '1', 'Développeuse Frontend', 'IT002', '1000', 'E002', 'Actif'], // Temps plein
      ['2025-06', 'E004', 'M', '25/01/1987', '12/11/2019', '', 'CDI', '1', 'Commercial Senior', 'COM001', '1200', 'E002', 'Actif'],
      ['2025-06', 'E005', 'F', '08/03/2002', '01/09/2023', '', 'CDI', '1', 'Chargée Marketing', 'MKT001', '1000', 'E001', 'Actif'], // Conversion alternance
      ['2025-06', 'E006', 'M', '14/11/1978', '01/06/2023', '', 'CDI', '1', 'Responsable Qualité', 'QUA001', '1000', 'E001', 'Actif'],
      ['2025-06', 'E007', 'F', '28/01/2000', '01/05/2025', '31/08/2025', 'Stage', '1', 'Stagiaire Communication', 'COM002', '1000', 'E004', 'Actif'],
      ['2025-06', 'E008', 'M', '03/07/1990', '15/01/2024', '30/06/2025', 'CDD', '1', 'Consultant IT', 'IT003', '1100', 'E002', 'Inactif'], // CDD terminé
      ['2025-06', 'E009', 'F', '18/12/1992', '01/04/2025', '', 'CDI', '0.8', 'UX Designer', 'IT004', '1000', 'E002', 'Actif'], // Conversion CDI
      ['2025-06', 'E010', 'M', '09/08/1982', '10/02/2018', '', 'CDI', '1', 'Manager Commercial', 'COM001', '1200', '', 'Actif'],
      
      // Juillet 2025 - Nouvelles embauches
      ['2025-07', 'E001', 'F', '15/06/1985', '01/03/2020', '', 'CDI', '1', 'Directrice RH', 'RH001', '1000', '', 'Actif'],
      ['2025-07', 'E002', 'M', '22/11/1988', '15/09/2019', '', 'CDI', '1', 'CTO', 'IT001', '1000', '', 'Actif'],
      ['2025-07', 'E003', 'F', '12/04/1995', '20/03/2022', '', 'CDI', '1', 'Lead Developer Frontend', 'IT002', '1000', 'E002', 'Actif'], // Promotion
      ['2025-07', 'E004', 'M', '25/01/1987', '12/11/2019', '', 'CDI', '1', 'Commercial Senior', 'COM001', '1200', 'E002', 'Actif'],
      ['2025-07', 'E005', 'F', '08/03/2002', '01/09/2023', '', 'CDI', '1', 'Chargée Marketing', 'MKT001', '1000', 'E001', 'Actif'],
      ['2025-07', 'E006', 'M', '14/11/1978', '01/06/2023', '', 'CDI', '1', 'Responsable Qualité', 'QUA001', '1000', 'E001', 'Actif'],
      ['2025-07', 'E009', 'F', '18/12/1992', '01/04/2025', '', 'CDI', '1', 'UX Designer', 'IT004', '1000', 'E002', 'Actif'], // Temps plein
      ['2025-07', 'E010', 'M', '09/08/1982', '10/02/2018', '', 'CDI', '1', 'Manager Commercial', 'COM001', '1200', '', 'Actif'],
      ['2025-07', 'E011', 'M', '22/05/1995', '01/07/2025', '', 'CDI', '1', 'Développeur Backend', 'IT002', '1000', 'E003', 'Actif'], // Nouvelle embauche
      ['2025-07', 'E012', 'F', '16/09/2001', '01/07/2025', '', 'Apprentissage', '1', 'Apprentie Comptable', 'FIN001', '1000', 'E001', 'Actif'] // Nouvelle embauche
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(employeesData), 'EMPLOYES')
    
    // REMUNERATION sheet - 10 lignes pour 3 mois
    const remunerationData = [
      ['matricule', 'mois_paie', 'type_contrat', 'etp_paie', 'salaire_de_base', 'primes_fixes', 'primes_variables', 'heures_supp_payees', 'avantages_nature', 'cotisations_sociales', 'taxes_sur_salaire'],
      
      // Mai 2025
      ['E001', '2025-05', 'CDI', '1', '5500', '500', '800', '0', '150', '1650', '385'],
      ['E002', '2025-05', 'CDI', '1', '7200', '900', '2000', '0', '220', '2160', '504'],
      ['E003', '2025-05', 'CDI', '0.8', '3200', '200', '400', '0', '80', '960', '224'],
      ['E004', '2025-05', 'CDI', '1', '4200', '300', '1500', '120', '100', '1260', '294'],
      ['E005', '2025-05', 'Alternance', '1', '1100', '0', '0', '0', '0', '330', '77'],
      ['E006', '2025-05', 'CDI', '1', '4400', '400', '200', '0', '120', '1320', '308'],
      ['E007', '2025-05', 'Stage', '1', '700', '0', '0', '0', '0', '0', '0'],
      ['E008', '2025-05', 'CDD', '1', '5000', '0', '500', '50', '100', '1500', '350'],
      ['E009', '2025-05', 'Freelance', '0.5', '3000', '0', '0', '0', '0', '0', '0'],
      ['E010', '2025-05', 'CDI', '1', '4800', '400', '1200', '100', '130', '1440', '336'],
      
      // Juin 2025
      ['E001', '2025-06', 'CDI', '1', '5600', '500', '1000', '0', '150', '1680', '392'],
      ['E002', '2025-06', 'CDI', '1', '7400', '900', '2200', '0', '240', '2220', '518'],
      ['E003', '2025-06', 'CDI', '1', '3600', '250', '500', '0', '90', '1080', '252'], // Temps plein
      ['E004', '2025-06', 'CDI', '1', '4300', '350', '1600', '140', '110', '1290', '301'],
      ['E005', '2025-06', 'CDI', '1', '2800', '200', '300', '0', '70', '840', '196'], // Conversion
      ['E006', '2025-06', 'CDI', '1', '4500', '450', '250', '0', '130', '1350', '315'],
      ['E007', '2025-06', 'Stage', '1', '700', '0', '0', '0', '0', '0', '0'],
      ['E008', '2025-06', 'CDD', '1', '5100', '0', '600', '60', '110', '1530', '357'],
      ['E009', '2025-06', 'CDI', '0.8', '3200', '100', '200', '0', '60', '960', '224'], // Conversion CDI
      ['E010', '2025-06', 'CDI', '1', '4900', '450', '1300', '120', '140', '1470', '343'],
      
      // Juillet 2025
      ['E001', '2025-07', 'CDI', '1', '5700', '500', '1200', '0', '160', '1710', '399'],
      ['E002', '2025-07', 'CDI', '1', '7600', '1000', '2400', '0', '250', '2280', '532'],
      ['E003', '2025-07', 'CDI', '1', '4000', '300', '600', '0', '100', '1200', '280'], // Promotion
      ['E004', '2025-07', 'CDI', '1', '4400', '400', '1700', '160', '120', '1320', '308'],
      ['E005', '2025-07', 'CDI', '1', '2900', '250', '400', '0', '80', '870', '203'],
      ['E006', '2025-07', 'CDI', '1', '4600', '500', '300', '0', '140', '1380', '322'],
      ['E009', '2025-07', 'CDI', '1', '3600', '150', '300', '0', '80', '1080', '252'], // Temps plein
      ['E010', '2025-07', 'CDI', '1', '5000', '500', '1400', '140', '150', '1500', '350'],
      ['E011', '2025-07', 'CDI', '1', '3500', '100', '200', '0', '70', '1050', '245'], // Nouvelle embauche
      ['E012', '2025-07', 'Apprentissage', '1', '950', '0', '0', '0', '0', '285', '67'] // Nouvelle embauche
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(remunerationData), 'REMUNERATION')
    
    // ABSENCES sheet - 4 colonnes seulement, 10 lignes
    const absencesData = [
      ['matricule', 'type_absence', 'date_debut', 'date_fin'],
      ['E001', 'Congés payés', '15/05/2025', '19/05/2025'],
      ['E002', 'Formation', '20/05/2025', '22/05/2025'],
      ['E003', 'Congé maternité', '01/06/2025', '15/09/2025'],
      ['E004', 'Maladie ordinaire', '08/06/2025', '12/06/2025'],
      ['E005', 'RTT', '25/06/2025', '25/06/2025'],
      ['E006', 'Accident du travail', '02/07/2025', '15/07/2025'],
      ['E007', 'Formation', '10/07/2025', '12/07/2025'],
      ['E009', 'Congés payés', '21/07/2025', '25/07/2025'],
      ['E010', 'Maladie ordinaire', '28/07/2025', '30/07/2025'],
      ['E011', 'Formation', '29/07/2025', '31/07/2025']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(absencesData), 'ABSENCES')
    
    // REFERENTIEL_ORGANISATION sheet - 10 lignes, codes alphanumériques
    const organisationData = [
      ['code_site', 'nom_site', 'siret_site', 'code_cost_center', 'nom_cost_center'],
      ['1000', 'Siège social Paris', '12345678901234', 'RH001', 'Direction RH'],
      ['1000', 'Siège social Paris', '12345678901234', 'IT001', 'Direction IT'],
      ['1000', 'Siège social Paris', '12345678901234', 'IT002', 'Développement'],
      ['1000', 'Siège social Paris', '12345678901234', 'IT003', 'Infrastructure'],
      ['1000', 'Siège social Paris', '12345678901234', 'IT004', 'UX/UI Design'],
      ['1000', 'Siège social Paris', '12345678901234', 'MKT001', 'Marketing'],
      ['1000', 'Siège social Paris', '12345678901234', 'QUA001', 'Qualité'],
      ['1000', 'Siège social Paris', '12345678901234', 'FIN001', 'Finance'],
      ['1200', 'Agence Lyon', '12345678901235', 'COM001', 'Commercial'],
      ['1200', 'Agence Lyon', '12345678901235', 'COM002', 'Communication']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(organisationData), 'REFERENTIEL_ORGANISATION')
    
    // REFERENTIEL_ABSENCES sheet - 10 lignes
    const absencesRefData = [
      ['type_absence', 'famille', 'indemnise', 'taux_indemnisation', 'comptabilise_absenteisme'],
      ['Congés payés', 'Congés', 'OUI', '1.0', 'NON'],
      ['RTT', 'Congés', 'OUI', '1.0', 'NON'],
      ['Maladie ordinaire', 'Incapacité', 'OUI', '0.9', 'OUI'],
      ['Longue maladie', 'Incapacité', 'OUI', '0.6', 'OUI'],
      ['Accident du travail', 'Incapacité', 'OUI', '1.0', 'OUI'],
      ['Congé maternité', 'Congés légaux', 'OUI', '1.0', 'NON'],
      ['Congé paternité', 'Congés légaux', 'OUI', '1.0', 'NON'],
      ['Formation', 'Formation', 'OUI', '1.0', 'NON'],
      ['Grève', 'Autres', 'NON', '0.0', 'OUI'],
      ['Absence injustifiée', 'Autres', 'NON', '0.0', 'OUI']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(absencesRefData), 'REFERENTIEL_ABSENCES')
    
    XLSX.writeFile(wb, `template_rh_optimise_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ==========================================
  // ERROR RENDERING
  // ==========================================

  const renderError = () => {
    if (!error) return null

    if (typeof error === 'string') {
      return (
        <div className="mb-8 p-6 bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <XCircle size={24} className="text-red-400" />
            <div className="flex-1">
              <p className="text-red-400 font-bold text-lg">Erreur système</p>
              <p className="text-red-300 mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors">
              <X size={16} className="text-red-400" />
            </button>
          </div>
        </div>
      )
    }

    if (error.type === 'missing_sheets') {
      return (
        <div className="mb-8 p-6 bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-2xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,0,0,0.3) 10px, rgba(255,0,0,0.3) 20px)`,
              animation: 'slide 3s linear infinite'
            }} />
          </div>
          
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center">
                <FileX size={32} className="text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-400 font-bold text-xl flex items-center gap-2">
                  <ShieldAlert size={20} />
                  Structure de fichier incomplète
                </h3>
                <p className="text-red-300 text-sm mt-1">{error.message}</p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-red-400/70">Requis: {error.expectedStructure?.length} onglets</span>
                  <span className="text-red-400/70">•</span>
                  <span className="text-red-400/70">Trouvés: {error.found?.length}</span>
                </div>
              </div>
              <button onClick={() => setError(null)} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors">
                <X size={16} className="text-red-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <h4 className="text-red-400 font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Onglets manquants ({error.missing?.length})
                </h4>
                <div className="space-y-3">
                  {error.missing?.map((sheet, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                      <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet size={16} className="text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-red-300 font-semibold">{sheet}</p>
                        <p className="text-red-400/70 text-xs">
                          {sheet === 'EMPLOYES' && 'Données employés (obligatoire)'}
                          {sheet === 'REMUNERATION' && 'Données de paie (obligatoire)'}
                          {sheet === 'ABSENCES' && 'Suivi des absences (obligatoire)'}
                          {sheet === 'REFERENTIEL_ORGANISATION' && 'Structure organisationnelle (obligatoire)'}
                          {sheet === 'REFERENTIEL_ABSENCES' && 'Types d\'absences (obligatoire)'}
                        </p>
                      </div>
                      <div className="w-6 h-6 bg-red-500/30 rounded-full flex items-center justify-center">
                        <X size={12} className="text-red-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 bg-green-500/10 border border-green-500/20 rounded-xl">
                <h4 className="text-green-400 font-bold mb-4 flex items-center gap-2">
                  <CheckCircle size={18} />
                  Onglets détectés ({error.found?.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {error.found?.map((sheet, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-green-500/5 border border-green-500/10 rounded-lg">
                      <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                      <span className="text-green-300 text-sm flex-1">{sheet}</span>
                      {REQUIRED_SHEETS.includes(sheet) && (
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <h4 className="text-cyan-400 font-bold mb-4 flex items-center gap-2">
                <Zap size={18} />
                Guide de correction
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-cyan-400 text-xs font-bold">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Téléchargez le template</p>
                      <p className="text-slate-400 text-xs">Structure avec les 5 onglets requis</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-cyan-400 text-xs font-bold">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Copiez vos données</p>
                      <p className="text-slate-400 text-xs">Respectez les noms d'onglets exactement</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-cyan-400 text-xs font-bold">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Vérifiez les en-têtes</p>
                      <p className="text-slate-400 text-xs">Première ligne = noms des colonnes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-cyan-400 text-xs font-bold">4</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Relancez l'import</p>
                      <p className="text-slate-400 text-xs">Fichier prêt avec tous les onglets</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="mb-8 p-6 bg-gradient-to-r from-orange-900/20 to-red-900/20 border border-orange-500/30 rounded-2xl backdrop-blur-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
            <AlertCircle size={24} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-orange-400 font-bold text-lg">{error.message}</h3>
            {error.details && <p className="text-orange-300 text-sm mt-1">{error.details}</p>}
          </div>
          <button onClick={() => setError(null)} className="p-2 hover:bg-orange-500/20 rounded-lg transition-colors">
            <X size={16} className="text-orange-400" />
          </button>
        </div>
      </div>
    )
  }

  // ==========================================
  // VALIDATION RESULTS RENDERING
  // ==========================================

  const renderValidationResults = () => {
    if (!validationResult) return null

    const { isValid, errors, warnings, summary } = validationResult

    return (
      <div className={`rounded-2xl border backdrop-blur-sm relative overflow-hidden transition-all duration-500 ${
        isValid 
          ? 'p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/30' 
          : 'p-6 bg-gradient-to-r from-red-900/20 to-orange-900/20 border-red-500/30'
      }`}>
        <div className="relative">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isValid ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {isValid ? (
                <CheckCircle size={28} className="text-green-400" />
              ) : (
                <AlertTriangle size={28} className="text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold text-xl">
                {isValid ? 'Validation réussie' : 'Corrections requises'}
              </h4>
              <p className="text-slate-400 mt-1">
                {validationResult.validRows}/{validationResult.totalRows} lignes valides
                {!isValid && ` • ${errors.length} erreur(s)`}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold font-mono ${
                summary.qualityScore >= 90 ? 'text-green-400' :
                summary.qualityScore >= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {summary.qualityScore}%
              </div>
              <div className="text-xs text-slate-400">Qualité</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Qualité globale des données</span>
              <span className={`font-mono font-bold ${
                summary.qualityScore >= 90 ? 'text-green-400' :
                summary.qualityScore >= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {summary.qualityScore}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  summary.qualityScore >= 90 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  summary.qualityScore >= 70 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                  'bg-gradient-to-r from-red-500 to-orange-500'
                }`}
                style={{ width: `${summary.qualityScore}%` }}
              />
            </div>
          </div>

          {!isValid && errors.length > 0 && (
            <div className="space-y-4">
              <h5 className="text-red-400 font-bold text-lg flex items-center gap-2">
                <AlertTriangle size={18} />
                Erreurs à corriger ({errors.length})
              </h5>
              
              {summary.criticalErrors > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <h6 className="text-red-300 font-bold mb-3 flex items-center gap-2">
                    <XCircle size={16} />
                    Erreurs critiques - Import impossible ({summary.criticalErrors})
                  </h6>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {errors.filter(e => e.severity === 'critical').slice(0, 8).map((error, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-red-500/5 rounded-lg text-sm">
                        <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-red-400 font-mono text-xs font-bold">{error.row}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-red-300 font-semibold">{error.sheet} • {error.field}</p>
                          <p className="text-red-400/80 mt-1">{error.message}</p>
                          {error.suggestion && (
                            <p className="text-cyan-400 mt-2 flex items-start gap-1 text-xs">
                              <ArrowRight size={10} className="mt-0.5 flex-shrink-0" />
                              <span>{error.suggestion}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isValid && (
            <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <CheckCircle size={24} className="text-green-400" />
              <div className="flex-1">
                <p className="text-green-300 font-bold text-lg">Fichier prêt pour l'import</p>
                <p className="text-green-400/70 text-sm">
                  Toutes les validations critiques sont passées • Qualité: {summary.qualityScore}%
                </p>
              </div>
              <div className="text-right">
                <div className="text-green-400 text-2xl font-bold">{processedData?.metadata.totalEmployees}</div>
                <div className="text-green-400/70 text-xs">Employés</div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      <div className="fixed inset-0">
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 255, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 255, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px'
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 container max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6 px-6 py-3 bg-slate-900/70 border border-slate-700/50 rounded-2xl backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-lg flex items-center justify-center">
              <Database size={16} className="text-slate-900" />
            </div>
            <span className="text-slate-300 font-mono text-sm tracking-wider">
              IMPORT SYSTEM V4.0
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xs">SECURE</span>
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Import de Données RH
          </h1>
          
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Interface sécurisée d'import RGPD avec validation automatique et calcul des KPIs
          </p>

          {company && selectedEstablishment && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
                <Building2 size={14} className="text-slate-400" />
                <span className="text-slate-300 text-sm">{company.nom}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
                <Server size={14} className="text-slate-400" />
                <span className="text-slate-300 text-sm">{selectedEstablishment.nom}</span>
              </div>
              {company.ai_features_enabled && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <Sparkles size={14} className="text-cyan-400" />
                  <span className="text-cyan-400 text-sm">IA Active</span>
                </div>
              )}
            </div>
          )}
        </div>

        {renderError()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Template Excel Optimisé</h3>
                  <p className="text-slate-400 text-sm">3 mois • 10 employés • Tous cas de test</p>
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-xl text-white font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Télécharger le Template
              </button>
              <div className="mt-3 text-xs text-slate-400 text-center">
                Mai, Juin, Juillet 2025 • CDI, CDD, Alternance, Stage, Freelance...
              </div>
            </div>

            <div className="p-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl backdrop-blur-sm">
              <button
                onClick={() => setShowDocumentation(!showDocumentation)}
                className="w-full flex items-center justify-between text-white font-medium mb-4"
              >
                <span className="flex items-center gap-2">
                  <BookOpen size={16} className="text-cyan-400" />
                  Documentation
                </span>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${showDocumentation ? 'rotate-90' : ''}`} />
              </button>
              
              {showDocumentation && (
                <div className="space-y-4 text-sm">
                  <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <h4 className="text-cyan-400 font-medium mb-2">Structure des 5 onglets</h4>
                    <ul className="text-slate-300 space-y-1 text-xs">
                      <li>• <strong>EMPLOYES:</strong> Données RH anonymisées (matricule, période, poste)</li>
                      <li>• <strong>REMUNERATION:</strong> Masse salariale et charges</li>
                      <li>• <strong>ABSENCES:</strong> 4 colonnes (matricule, type, dates début/fin)</li>
                      <li>• <strong>REFERENTIEL_ORGANISATION:</strong> Sites et cost centers</li>
                      <li>• <strong>REFERENTIEL_ABSENCES:</strong> Types et paramètres</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="text-white font-medium mb-2">Conseils d'utilisation</h4>
                    <ul className="text-slate-300 space-y-1 text-xs">
                      <li>• Codes alphanumériques: site (1000, PAR01), cost center (RH001, IT023)</li>
                      <li>• Dates format JJ/MM/AAAA obligatoire</li>
                      <li>• Périodes YYYY-MM (ex: 2025-05)</li>
                      <li>• Matricules cohérents entre tous onglets</li>
                      <li>• KPIs calculés automatiquement après import</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 backdrop-blur-sm ${
                isDragActive 
                  ? 'border-cyan-400 bg-cyan-500/5 scale-105' 
                  : file
                  ? 'border-green-500 bg-green-500/5'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-900/30 hover:bg-slate-900/50'
              }`}
            >
              <input {...getInputProps()} />
              
              {file ? (
                <div className="space-y-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
                    <FileCheck size={32} className="text-white" />
                  </div>
                  
                  <div>
                    <h3 className="text-white font-semibold text-xl mb-2">{file.name}</h3>
                    <div className="flex items-center justify-center gap-4 text-sm">
                      <span className="text-slate-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400">
                        {file.type.split('/').pop()?.toUpperCase()}
                      </span>
                      {importStatus === 'validating' && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="flex items-center gap-2 text-cyan-400">
                            <Loader2 size={14} className="animate-spin" />
                            Analyse...
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {processedData && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-cyan-400">{processedData.metadata.totalEmployees}</div>
                          <div className="text-xs text-slate-400 mt-1">Employés</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-400">{processedData.metadata.periods.length}</div>
                          <div className="text-xs text-slate-400 mt-1">Périodes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">{processedData.metadata.dataQuality.accuracy}%</div>
                          <div className="text-xs text-slate-400 mt-1">Qualité</div>
                        </div>
                      </div>
                      
                      {processedData.metadata.periods.length > 0 && (
                        <div className="pt-4 border-t border-slate-700">
                          <div className="text-xs text-slate-400 mb-2">Périodes détectées:</div>
                          <div className="flex flex-wrap gap-2">
                            {processedData.metadata.periods.map(period => (
                              <span key={period} className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg flex items-center gap-1">
                                <Clock size={10} />
                                {period}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-gradient-to-r from-slate-700 to-slate-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Upload size={40} className="text-slate-400" />
                  </div>
                  
                  <div>
                    <h3 className="text-white font-semibold text-xl mb-2">
                      {isDragActive ? 'Déposez le fichier ici' : 'Sélectionnez votre fichier Excel'}
                    </h3>
                    <p className="text-slate-400">
                      Glissez-déposez ou cliquez pour sélectionner
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet size={14} />
                      XLSX/XLS
                    </span>
                    <span>•</span>
                    <span>Max 50MB</span>
                    <span>•</span>
                    <span>5 onglets requis</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {renderValidationResults()}

            {establishments.length > 1 && (
              <div className="p-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl backdrop-blur-sm">
                <label className="text-slate-400 text-sm mb-3 block">Établissement cible</label>
                <select
                  value={selectedEstablishment?.id || ''}
                  onChange={(e) => {
                    const estId = e.target.value
                    const est = establishments.find(establishment => establishment.id === estId)
                    if (est) setSelectedEstablishment(est)
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                >
                  {establishments.map(est => (
                    <option key={est.id} value={est.id}>
                      {est.nom} {est.is_headquarters && '(Siège)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {importStatus === 'processing' && (
          <div className="mt-8 p-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <Activity size={20} className="text-cyan-400" />
                Import en cours
              </h3>
              <button
                onClick={cancelImport}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{importProgress.message}</span>
                <span className="text-cyan-400 font-mono">{importProgress.percentage.toFixed(0)}%</span>
              </div>
              
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress.percentage}%` }}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                <div className="text-center">
                  <div className="text-xl font-bold text-cyan-400">{importProgress.current}</div>
                  <div className="text-xs text-slate-400">Étape</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-400">{importProgress.total}</div>
                  <div className="text-xs text-slate-400">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-400">
                    {((Date.now() - startTimeRef.current) / 1000).toFixed(0)}s
                  </div>
                  <div className="text-xs text-slate-400">Écoulé</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {importStatus === 'success' && (
          <div className="mt-8 p-8 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl backdrop-blur-sm text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-white" />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Import réussi!</h3>
            <p className="text-green-400 mb-6">
              Toutes les données ont été importées et les KPIs calculés
            </p>
            
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-xl text-white font-semibold transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <TrendingUp size={18} />
                Voir le Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-white font-semibold transition-all flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Nouvel Import
              </button>
            </div>
            
            <p className="text-slate-400 text-sm mt-6">
              Redirection automatique dans 3 secondes...
            </p>
          </div>
        )}

        {/* Enhanced action button */}
        {file && validationResult && importStatus === 'idle' && (
          <div className="mt-8 text-center">
            {validationResult.isValid ? (
              <button
                onClick={processImport}
                disabled={!selectedEstablishment}
                className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-white font-bold text-lg transition-all transform hover:scale-105 flex items-center gap-3 mx-auto"
              >
                <Zap size={24} />
                <span>Lancer l'Import</span>
                <div className="text-xs opacity-75 bg-white/10 px-2 py-1 rounded">
                  {processedData?.metadata.totalEmployees || 0} employés • {processedData?.metadata.periods.length || 0} périodes
                </div>
              </button>
            ) : (
              <div className="inline-flex flex-col items-center gap-4">
                <div className="px-8 py-4 bg-red-500/20 border border-red-500/30 rounded-2xl">
                  <div className="flex items-center gap-3 text-red-400">
                    <AlertTriangle size={24} />
                    <div className="text-left">
                      <p className="font-bold text-lg">
                        {validationResult.summary.criticalErrors} erreur(s) critique(s)
                      </p>
                      <p className="text-sm text-red-300">
                        Import impossible - Corrigez les erreurs en rouge
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-slate-400 text-sm">
                  Qualité actuelle: {validationResult.summary.qualityScore}% • Minimum requis: 85%
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced CSS Styles */}
      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-10px) translateX(5px); }
          50% { transform: translateY(5px) translateX(-5px); }
          75% { transform: translateY(-5px) translateX(3px); }
        }
        
        .transition-all {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}