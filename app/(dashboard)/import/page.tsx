'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import React from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, AlertCircle,
  Download, Building2, ArrowRight, X, Database, Server, Sparkles,
  TrendingUp, RefreshCw, Zap, Activity, FileCheck, BookOpen,
  ChevronRight, ChevronLeft, Settings, AlertTriangle, FileX,
  ShieldAlert, Clock, Users, ChevronDown, ChevronUp, Target,
  MapPin, Search, Filter, Copy, ExternalLink, Info, Bug, Wrench,
  Eye, EyeOff, History, Save, Shield, BarChart3, Cpu, Terminal,
  Code2, Gauge, HardDrive, Binary, Menu, Calendar, CheckSquare,
  FileDown, Layers, Package, PlayCircle, Hash, CheckCircle2
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface Company {
  id: string
  nom: string
  code_entreprise?: string
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

interface ValidationError {
  id: string
  sheet: string
  row: number
  column: string
  field: string
  value: any
  message: string
  severity: 'critical' | 'warning' | 'info'
  canIgnore: boolean
}

interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  summary: {
    totalErrors: number
    criticalErrors: number
    warningCount: number
    canProceed: boolean
    qualityScore: number
  }
}

interface ImportProgress {
  phase: 'validation' | 'processing' | 'snapshots' | 'completion'
  step: string
  current: number
  total: number
  percentage: number
  message: string
  detail?: string
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
    totalRecords: number
    establishments: string[]
  }
}

// ==========================================
// CONSTANTS
// ==========================================

const REQUIRED_SHEETS = ['EMPLOYES', 'REMUNERATION', 'ABSENCES', 'REFERENTIEL_ORGANISATION', 'REFERENTIEL_ABSENCES']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const BATCH_SIZE = 100

const VALID_CONTRACT_TYPES = ['CDI', 'CDD', 'Alternance', 'Stage', 'Intérim', 'Freelance', 'Apprentissage', 'Contrat Pro']
const VALID_EMPLOYMENT_STATUS = ['Actif', 'Inactif', 'Suspendu', 'Congé parental', 'Congé sabbatique']
const VALID_FAMILLE_ABSENCE = ['Congés', 'Maladie', 'Formation', 'Congés légaux', 'Accident', 'Familial', 'Autres']

// ==========================================
// UTILITY FUNCTIONS - BULLETPROOF VERSION
// ==========================================

const normalizeDate = (date: any): string | null => {
  if (!date) return null
  
  try {
    // Handle Excel numeric dates
    if (typeof date === 'number' && date > 0 && date < 100000) {
      const excelDate = new Date((date - 25569) * 86400 * 1000)
      if (!isNaN(excelDate.getTime())) {
        return excelDate.toISOString().split('T')[0]
      }
    }
    
    // Handle Date objects
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
    
    const dateStr = String(date).trim()
    
    // Already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }
    
    // French format DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/')
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    
    // US format MM/DD/YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split('-')
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    
    return null
  } catch {
    return null
  }
}

const normalizePeriod = (period: any): string => {
  if (!period) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  
  try {
    // Handle Excel numeric dates
    if (typeof period === 'number' && period > 0 && period < 100000) {
      const excelDate = new Date((period - 25569) * 86400 * 1000)
      if (!isNaN(excelDate.getTime())) {
        return `${excelDate.getFullYear()}-${String(excelDate.getMonth() + 1).padStart(2, '0')}-01`
      }
    }
    
    // Handle Date objects
    if (period instanceof Date && !isNaN(period.getTime())) {
      return `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}-01`
    }
    
    const periodStr = String(period).trim()
    
    // Already normalized
    if (/^\d{4}-\d{2}-01$/.test(periodStr)) {
      return periodStr
    }
    
    // ISO date format - extract month
    if (/^\d{4}-\d{2}-\d{2}$/.test(periodStr)) {
      return periodStr.substring(0, 7) + '-01'
    }
    
    // French format DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(periodStr)) {
      const [day, month, year] = periodStr.split('/')
      return `${year}-${month.padStart(2, '0')}-01`
    }
    
    // Month/Year format
    if (/^\d{1,2}\/\d{4}$/.test(periodStr)) {
      const [month, year] = periodStr.split('/')
      return `${year}-${month.padStart(2, '0')}-01`
    }
    
    // Default to current month
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  } catch {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
}

const normalizeFamilleAbsence = (famille: any): string => {
  if (!famille) return 'Autres'
  
  const normalized = String(famille).trim().toLowerCase()
  
  const mapping: Record<string, string> = {
    'congé': 'Congés', 'congés': 'Congés', 'conge': 'Congés', 'conges': 'Congés',
    'cp': 'Congés', 'rtt': 'Congés', 'repos': 'Congés',
    'maladie': 'Maladie', 'arrêt': 'Maladie', 'arret': 'Maladie',
    'formation': 'Formation', 'stage': 'Formation',
    'maternité': 'Congés légaux', 'paternité': 'Congés légaux', 'parental': 'Congés légaux',
    'accident': 'Accident', 'at': 'Accident', 'mp': 'Accident',
    'familial': 'Familial', 'famille': 'Familial', 'décès': 'Familial',
    'autre': 'Autres', 'autres': 'Autres', 'divers': 'Autres'
  }
  
  for (const [key, value] of Object.entries(mapping)) {
    if (normalized.includes(key)) return value
  }
  
  return 'Autres'
}

const sanitizeString = (str: any, maxLength = 255): string => {
  if (!str) return ''
  return String(str).trim().substring(0, maxLength)
}

const sanitizeNumber = (val: any, defaultValue = 0): number => {
  if (val === null || val === undefined || val === '') return defaultValue
  const num = parseFloat(String(val).replace(',', '.'))
  return isNaN(num) ? defaultValue : num
}

const parseBoolean = (val: any): boolean => {
  if (typeof val === 'boolean') return val
  const str = String(val).trim().toLowerCase()
  return ['oui', 'yes', 'true', '1', 'o', 'y'].includes(str)
}

// ==========================================
// ENHANCED VALIDATION ENGINE
// ==========================================

const validateData = (data: ProcessedData): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  let idCounter = 0
  
  // Validate employees
  data.employees.forEach((emp, index) => {
    const row = index + 2
    
    if (!emp.matricule) {
      errors.push({
        id: `err_${++idCounter}`,
        sheet: 'EMPLOYES',
        row,
        column: 'A',
        field: 'matricule',
        value: emp.matricule,
        message: 'Matricule obligatoire',
        severity: 'critical',
        canIgnore: false
      })
    }
    
    if (!emp.periode) {
      errors.push({
        id: `err_${++idCounter}`,
        sheet: 'EMPLOYES',
        row,
        column: 'B',
        field: 'periode',
        value: emp.periode,
        message: 'Période obligatoire',
        severity: 'critical',
        canIgnore: false
      })
    }
    
    if (!emp.date_entree) {
      errors.push({
        id: `err_${++idCounter}`,
        sheet: 'EMPLOYES',
        row,
        column: 'E',
        field: 'date_entree',
        value: emp.date_entree,
        message: 'Date d\'entrée obligatoire',
        severity: 'critical',
        canIgnore: false
      })
    }
    
    if (emp.type_contrat && !VALID_CONTRACT_TYPES.includes(emp.type_contrat)) {
      warnings.push({
        id: `warn_${++idCounter}`,
        sheet: 'EMPLOYES',
        row,
        column: 'G',
        field: 'type_contrat',
        value: emp.type_contrat,
        message: `Type de contrat non standard: ${emp.type_contrat}`,
        severity: 'warning',
        canIgnore: true
      })
    }
  })
  
  // Validate remunerations
  const employeeKeys = new Set(data.employees.map(e => `${e.matricule}_${e.periode}`))
  
  data.remunerations.forEach((rem, index) => {
    const row = index + 2
    const key = `${rem.matricule}_${rem.mois_paie}`
    
    if (!employeeKeys.has(key)) {
      warnings.push({
        id: `warn_${++idCounter}`,
        sheet: 'REMUNERATION',
        row,
        column: 'A',
        field: 'matricule',
        value: rem.matricule,
        message: `Rémunération pour employé/période non trouvé: ${key}`,
        severity: 'warning',
        canIgnore: true
      })
    }
  })
  
  const totalErrors = errors.length
  const criticalErrors = errors.filter(e => e.severity === 'critical').length
  const warningCount = warnings.length
  const qualityScore = Math.max(0, 100 - (criticalErrors * 10) - (warningCount * 2))
  
  return {
    isValid: criticalErrors === 0,
    errors,
    warnings,
    summary: {
      totalErrors,
      criticalErrors,
      warningCount,
      canProceed: criticalErrors === 0,
      qualityScore
    }
  }
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function OptimizedImportPage() {
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
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [importLogs, setImportLogs] = useState<string[]>([])
  
  const supabase = createClient()
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize
  useEffect(() => {
    initializeCompany()
  }, [])

  const initializeCompany = async () => {
    try {
      const sessionStr = localStorage.getItem('company_session')
      if (!sessionStr) {
        router.push('/login')
        return
      }

      const session = JSON.parse(sessionStr)
      
      const { data: companyData, error: companyError } = await supabase
        .from('entreprises')
        .select(`*, etablissements (*)`)
        .eq('id', session.company_id)
        .single()

      if (companyError) throw companyError

      setCompany(companyData as Company)
      const establishmentsData = companyData.etablissements || []
      setEstablishments(establishmentsData)
      
      const defaultEstablishment = establishmentsData.find((e: any) => e.is_headquarters) || establishmentsData[0]
      if (defaultEstablishment) {
        setSelectedEstablishment(defaultEstablishment as Establishment)
      }
    } catch (error) {
      console.error('Initialization error:', error)
      setError('Erreur d\'initialisation')
    }
  }

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = {
      info: '📝',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type]
    
    setImportLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`])
  }

  // File handling
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
      setImportLogs([])
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

  // Analyze file
  const analyzeFile = async (file: File) => {
    try {
      setImportStatus('validating')
      addLog('Début de l\'analyse du fichier', 'info')
      
      setImportProgress({
        phase: 'validation',
        step: 'Lecture du fichier',
        current: 10,
        total: 100,
        percentage: 10,
        message: 'Chargement...'
      })

      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { 
        type: 'array',
        cellDates: true,
        dateNF: 'yyyy-mm-dd'
      })
      
      // Check required sheets
      const missingSheets = REQUIRED_SHEETS.filter(sheet => !wb.SheetNames.includes(sheet))
      if (missingSheets.length > 0) {
        throw new Error(`Onglets manquants: ${missingSheets.join(', ')}`)
      }

      addLog('Structure du fichier validée', 'success')

      // Extract data
      setImportProgress({
        phase: 'validation',
        step: 'Extraction des données',
        current: 30,
        total: 100,
        percentage: 30,
        message: 'Lecture des onglets...'
      })

      const employees = XLSX.utils.sheet_to_json(wb.Sheets['EMPLOYES'], { defval: null })
      const remunerations = XLSX.utils.sheet_to_json(wb.Sheets['REMUNERATION'], { defval: null })
      const absences = XLSX.utils.sheet_to_json(wb.Sheets['ABSENCES'], { defval: null })
      const referentiel_organisation = XLSX.utils.sheet_to_json(wb.Sheets['REFERENTIEL_ORGANISATION'], { defval: null })
      const referentiel_absences = XLSX.utils.sheet_to_json(wb.Sheets['REFERENTIEL_ABSENCES'], { defval: null })

      addLog(`${employees.length} employés trouvés`, 'info')
      addLog(`${remunerations.length} lignes de rémunération`, 'info')

      // Normalize data
      setImportProgress({
        phase: 'validation',
        step: 'Normalisation des données',
        current: 50,
        total: 100,
        percentage: 50,
        message: 'Traitement...'
      })

      const normalizedEmployees = employees.map((emp: any) => ({
        ...emp,
        periode: normalizePeriod(emp.periode),
        date_entree: normalizeDate(emp.date_entree),
        date_sortie: normalizeDate(emp.date_sortie),
        date_naissance: normalizeDate(emp.date_naissance),
        type_contrat: emp.type_contrat || 'CDI',
        temps_travail: sanitizeNumber(emp.temps_travail, 1),
        statut_emploi: emp.statut_emploi || 'Actif'
      }))

      const normalizedRemunerations = remunerations.map((rem: any) => ({
        ...rem,
        mois_paie: normalizePeriod(rem.mois_paie),
        salaire_de_base: sanitizeNumber(rem.salaire_de_base),
        primes_fixes: sanitizeNumber(rem.primes_fixes),
        primes_variables: sanitizeNumber(rem.primes_variables),
        cotisations_sociales: sanitizeNumber(rem.cotisations_sociales)
      }))

      const normalizedAbsences = absences.map((abs: any) => ({
        ...abs,
        date_debut: normalizeDate(abs.date_debut),
        date_fin: normalizeDate(abs.date_fin)
      }))

      const normalizedRefAbsences = referentiel_absences.map((ref: any) => ({
        ...ref,
        famille: normalizeFamilleAbsence(ref.famille),
        indemnise: parseBoolean(ref.indemnise),
        comptabilise_absenteisme: parseBoolean(ref.comptabilise_absenteisme)
      }))

      // Get unique periods
      const periods = [...new Set([
        ...normalizedEmployees.map(e => e.periode),
        ...normalizedRemunerations.map(r => r.mois_paie)
      ])].filter(Boolean).sort()

      addLog(`Périodes détectées: ${periods.join(', ')}`, 'info')

      const processedData: ProcessedData = {
        employees: normalizedEmployees,
        remunerations: normalizedRemunerations,
        absences: normalizedAbsences,
        referentiel_organisation,
        referentiel_absences: normalizedRefAbsences,
        metadata: {
          periods,
          totalEmployees: normalizedEmployees.length,
          totalRecords: normalizedEmployees.length + normalizedRemunerations.length + normalizedAbsences.length,
          establishments: [...new Set(normalizedEmployees.map(e => e.code_site).filter(Boolean))]
        }
      }

      setProcessedData(processedData)

      // Validate
      setImportProgress({
        phase: 'validation',
        step: 'Validation des données',
        current: 80,
        total: 100,
        percentage: 80,
        message: 'Vérification...'
      })

      const validation = validateData(processedData)
      setValidationResult(validation)

      if (validation.summary.criticalErrors > 0) {
        addLog(`${validation.summary.criticalErrors} erreur(s) critique(s) détectée(s)`, 'error')
      } else {
        addLog('Données prêtes pour l\'import', 'success')
      }

      setImportProgress({
        phase: 'validation',
        step: 'Analyse terminée',
        current: 100,
        total: 100,
        percentage: 100,
        message: validation.summary.canProceed ? 'Prêt pour l\'import' : 'Corrections requises'
      })

      setImportStatus('idle')
    } catch (error) {
      console.error('Analysis error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      setError(errorMessage)
      addLog(errorMessage, 'error')
      setImportStatus('error')
    }
  }

  // Process import with bulletproof snapshot calculation
  const processImport = async () => {
    if (!processedData || !selectedEstablishment || !validationResult?.summary.canProceed) {
      setError('Import impossible - données manquantes ou erreurs critiques')
      return
    }

    try {
      setImportStatus('processing')
      setError(null)
      setImportLogs([])
      abortControllerRef.current = new AbortController()
      
      const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const { employees, remunerations, absences, referentiel_organisation, referentiel_absences, metadata } = processedData

      addLog(`Début de l'import - ${metadata.totalRecords} enregistrements`, 'info')

      // Phase 1: Initialize
      setImportProgress({
        phase: 'processing',
        step: 'Initialisation',
        current: 5,
        total: 100,
        percentage: 5,
        message: 'Préparation...'
      })

      await supabase.from('import_batches').insert({
        id: batchId,
        etablissement_id: selectedEstablishment.id,
        file_name: file?.name || 'import.xlsx',
        status: 'processing',
        periods_imported: metadata.periods
      })

      // Phase 2: Import referentials
      if (referentiel_organisation.length > 0) {
        setImportProgress({
          phase: 'processing',
          step: 'Import référentiels',
          current: 10,
          total: 100,
          percentage: 10,
          message: 'Organisation...'
        })

        const orgData = referentiel_organisation.map(org => ({
          etablissement_id: selectedEstablishment.id,
          code_site: sanitizeString(org.code_site, 20),
          nom_site: sanitizeString(org.nom_site),
          code_cost_center: sanitizeString(org.code_cost_center, 20),
          nom_cost_center: sanitizeString(org.nom_cost_center),
          is_active: true
        }))

        const { error: orgError } = await supabase
          .from('referentiel_organisation')
          .upsert(orgData, { onConflict: 'etablissement_id,code_cost_center,code_site' })

        if (orgError) throw orgError
        addLog('Référentiel organisation importé', 'success')
      }

      if (referentiel_absences.length > 0) {
        const absTypesData = referentiel_absences.map(abs => ({
          etablissement_id: selectedEstablishment.id,
          type_absence: sanitizeString(abs.type_absence, 100),
          famille: abs.famille,
          indemnise: abs.indemnise,
          comptabilise_absenteisme: abs.comptabilise_absenteisme,
          is_active: true
        }))

        const { error: absError } = await supabase
          .from('referentiel_absences')
          .upsert(absTypesData, { onConflict: 'etablissement_id,type_absence' })

        if (absError) throw absError
        addLog('Référentiel absences importé', 'success')
      }

      // Phase 3: Import employees
      setImportProgress({
        phase: 'processing',
        step: 'Import des employés',
        current: 20,
        total: 100,
        percentage: 20,
        message: `0/${employees.length}`
      })

      const employeeMap = new Map<string, string>()
      
      for (let i = 0; i < employees.length; i += BATCH_SIZE) {
        if (abortControllerRef.current?.signal.aborted) throw new Error('Import annulé')
        
        const batch = employees.slice(i, i + BATCH_SIZE)
        const employeesData = batch.map(emp => ({
          etablissement_id: selectedEstablishment.id,
          matricule: sanitizeString(emp.matricule, 50),
          periode: emp.periode,
          sexe: emp.sexe || null,
          date_naissance: emp.date_naissance,
          date_entree: emp.date_entree || '2020-01-01',
          date_sortie: emp.date_sortie,
          type_contrat: emp.type_contrat,
          temps_travail: emp.temps_travail,
          intitule_poste: sanitizeString(emp.intitule_poste || 'Non spécifié'),
          code_cost_center: sanitizeString(emp.code_cost_center),
          code_site: sanitizeString(emp.code_site),
          statut_emploi: emp.statut_emploi,
          import_batch_id: batchId
        }))

        const { data: insertedEmployees, error: empError } = await supabase
          .from('employes')
          .upsert(employeesData, { onConflict: 'etablissement_id,matricule,periode' })
          .select('id, matricule, periode')

        if (empError) throw empError

        insertedEmployees?.forEach(emp => {
          employeeMap.set(`${emp.matricule}_${emp.periode}`, emp.id)
        })

        const processed = Math.min(i + BATCH_SIZE, employees.length)
        setImportProgress({
          phase: 'processing',
          step: 'Import des employés',
          current: 20 + Math.round((processed / employees.length) * 20),
          total: 100,
          percentage: 20 + Math.round((processed / employees.length) * 20),
          message: `${processed}/${employees.length}`
        })
      }

      addLog(`${employees.length} employés importés`, 'success')

      // Phase 4: Import remunerations
      setImportProgress({
        phase: 'processing',
        step: 'Import des rémunérations',
        current: 40,
        total: 100,
        percentage: 40,
        message: `0/${remunerations.length}`
      })

      for (let i = 0; i < remunerations.length; i += BATCH_SIZE) {
        if (abortControllerRef.current?.signal.aborted) throw new Error('Import annulé')
        
        const batch = remunerations.slice(i, i + BATCH_SIZE)
        const remunerationsData = batch.map(rem => ({
          etablissement_id: selectedEstablishment.id,
          employe_id: employeeMap.get(`${rem.matricule}_${rem.mois_paie}`) || null,
          matricule: sanitizeString(rem.matricule, 50),
          mois_paie: rem.mois_paie,
          salaire_de_base: rem.salaire_de_base,
          primes_fixes: rem.primes_fixes,
          primes_variables: rem.primes_variables,
          cotisations_sociales: rem.cotisations_sociales,
          import_batch_id: batchId
        }))

        const { error: remError } = await supabase
          .from('remunerations')
          .upsert(remunerationsData, { onConflict: 'etablissement_id,matricule,mois_paie' })

        if (remError) throw remError

        const processed = Math.min(i + BATCH_SIZE, remunerations.length)
        setImportProgress({
          phase: 'processing',
          step: 'Import des rémunérations',
          current: 40 + Math.round((processed / remunerations.length) * 20),
          total: 100,
          percentage: 40 + Math.round((processed / remunerations.length) * 20),
          message: `${processed}/${remunerations.length}`
        })
      }

      addLog(`${remunerations.length} rémunérations importées`, 'success')

      // Phase 5: Import absences
      if (absences.length > 0) {
        setImportProgress({
          phase: 'processing',
          step: 'Import des absences',
          current: 60,
          total: 100,
          percentage: 60,
          message: `0/${absences.length}`
        })

        for (let i = 0; i < absences.length; i += BATCH_SIZE) {
          if (abortControllerRef.current?.signal.aborted) throw new Error('Import annulé')
          
          const batch = absences.slice(i, i + BATCH_SIZE)
          const absencesData = batch.filter(abs => abs.date_debut).map(abs => ({
            etablissement_id: selectedEstablishment.id,
            matricule: sanitizeString(abs.matricule, 50),
            type_absence: sanitizeString(abs.type_absence, 100),
            date_debut: abs.date_debut,
            date_fin: abs.date_fin || abs.date_debut,
            import_batch_id: batchId
          }))

          if (absencesData.length > 0) {
            const { error: absError } = await supabase
              .from('absences')
              .upsert(absencesData, { onConflict: 'etablissement_id,matricule,date_debut,type_absence' })

            if (absError) throw absError
          }

          const processed = Math.min(i + BATCH_SIZE, absences.length)
          setImportProgress({
            phase: 'processing',
            step: 'Import des absences',
            current: 60 + Math.round((processed / absences.length) * 10),
            total: 100,
            percentage: 60 + Math.round((processed / absences.length) * 10),
            message: `${processed}/${absences.length}`
          })
        }

        addLog(`${absences.length} absences importées`, 'success')
      }

      // Phase 6: Calculate snapshots - BULLETPROOF VERSION
      setImportProgress({
        phase: 'snapshots',
        step: 'Calcul des KPIs',
        current: 70,
        total: 100,
        percentage: 70,
        message: 'Initialisation...'
      })

      const snapshotResults = []
      
      for (let idx = 0; idx < metadata.periods.length; idx++) {
        const period = metadata.periods[idx]
        const normalizedPeriod = normalizePeriod(period)
        
        setImportProgress({
          phase: 'snapshots',
          step: 'Calcul des KPIs',
          current: 70 + Math.round((idx / metadata.periods.length) * 25),
          total: 100,
          percentage: 70 + Math.round((idx / metadata.periods.length) * 25),
          message: `Période ${idx + 1}/${metadata.periods.length}: ${normalizedPeriod}`,
          detail: `Calcul en cours pour ${normalizedPeriod}...`
        })

        try {
          // Call the RPC function
          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            'calculate_snapshot_for_period',
            {
              p_etablissement_id: selectedEstablishment.id,
              p_periode: normalizedPeriod,
              p_force: true
            }
          )

          if (rpcError) {
            console.error(`RPC error for ${normalizedPeriod}:`, rpcError)
            addLog(`⚠️ Erreur KPI ${normalizedPeriod}: ${rpcError.message}`, 'warning')
            snapshotResults.push({ period: normalizedPeriod, success: false, error: rpcError.message })
          } else {
            // Verify the snapshot was created
            const { data: verifySnapshot, error: verifyError } = await supabase
              .from('snapshots_mensuels')
              .select('id, periode, effectif_fin_mois, calculated_at')
              .eq('etablissement_id', selectedEstablishment.id)
              .eq('periode', normalizedPeriod)
              .single()

            if (verifySnapshot) {
              console.log(`Snapshot verified for ${normalizedPeriod}:`, verifySnapshot)
              addLog(`✅ KPIs calculés pour ${normalizedPeriod}`, 'success')
              snapshotResults.push({ period: normalizedPeriod, success: true, data: verifySnapshot })
            } else {
              console.warn(`Snapshot not found after calculation for ${normalizedPeriod}`)
              addLog(`⚠️ KPIs non vérifiés pour ${normalizedPeriod}`, 'warning')
              snapshotResults.push({ period: normalizedPeriod, success: false, error: 'Not verified' })
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`Snapshot error for ${normalizedPeriod}:`, error)
          addLog(`❌ Erreur KPI ${normalizedPeriod}: ${errorMessage}`, 'error')
          snapshotResults.push({ period: normalizedPeriod, success: false, error: errorMessage })
        }
      }

      // Check results
      const successfulSnapshots = snapshotResults.filter(r => r.success).length
      const failedSnapshots = snapshotResults.filter(r => !r.success).length

      if (successfulSnapshots === 0) {
        throw new Error('Aucun KPI n\'a pu être calculé. Vérifiez les données.')
      }

      if (failedSnapshots > 0) {
        addLog(`⚠️ ${failedSnapshots} période(s) sans KPI`, 'warning')
      }

      // Phase 7: Finalize
      setImportProgress({
        phase: 'completion',
        step: 'Finalisation',
        current: 95,
        total: 100,
        percentage: 95,
        message: 'Sauvegarde...'
      })

      await supabase.from('import_batches').update({
        status: 'completed',
        nb_employes_imported: employees.length,
        nb_remunerations_imported: remunerations.length,
        nb_absences_imported: absences.length,
        completed_at: new Date().toISOString()
      }).eq('id', batchId)

      setImportProgress({
        phase: 'completion',
        step: 'Import terminé!',
        current: 100,
        total: 100,
        percentage: 100,
        message: `✅ ${metadata.totalRecords} enregistrements • ${successfulSnapshots} KPIs calculés`
      })

      addLog(`Import terminé avec succès! ${successfulSnapshots}/${metadata.periods.length} périodes traitées`, 'success')
      setImportStatus('success')

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)

    } catch (error) {
      console.error('Import error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      setError(errorMessage)
      addLog(errorMessage, 'error')
      setImportStatus('error')
    }
  }

  // Download template
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    
    // EMPLOYES sheet with examples
    const employeesData = [
      ['matricule', 'periode', 'sexe', 'date_naissance', 'date_entree', 'date_sortie', 'type_contrat', 'temps_travail', 'intitule_poste', 'code_cost_center', 'code_site', 'statut_emploi'],
      ['E001', '01/01/2025', 'F', '15/06/1985', '01/03/2020', '', 'CDI', '1', 'Directrice RH', 'RH', 'SIEGE', 'Actif'],
      ['E002', '01/01/2025', 'M', '22/11/1988', '15/09/2019', '', 'CDI', '1', 'Développeur Senior', 'IT', 'SIEGE', 'Actif'],
      ['E003', '01/01/2025', 'F', '10/04/1995', '01/06/2021', '', 'CDI', '0.8', 'Comptable', 'FIN', 'SIEGE', 'Actif'],
      ['E001', '01/02/2025', 'F', '15/06/1985', '01/03/2020', '', 'CDI', '1', 'Directrice RH', 'RH', 'SIEGE', 'Actif'],
      ['E002', '01/02/2025', 'M', '22/11/1988', '15/09/2019', '', 'CDI', '1', 'Développeur Senior', 'IT', 'SIEGE', 'Actif'],
      ['E003', '01/02/2025', 'F', '10/04/1995', '01/06/2021', '', 'CDI', '1', 'Comptable', 'FIN', 'SIEGE', 'Actif']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(employeesData), 'EMPLOYES')
    
    // REMUNERATION sheet
    const remunerationData = [
      ['matricule', 'mois_paie', 'salaire_de_base', 'primes_fixes', 'primes_variables', 'cotisations_sociales'],
      ['E001', '01/01/2025', '5500', '500', '1000', '1650'],
      ['E002', '01/01/2025', '4500', '300', '800', '1350'],
      ['E003', '01/01/2025', '2800', '200', '400', '840'],
      ['E001', '01/02/2025', '5500', '500', '1200', '1650'],
      ['E002', '01/02/2025', '4500', '300', '900', '1350'],
      ['E003', '01/02/2025', '3500', '250', '500', '1050']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(remunerationData), 'REMUNERATION')
    
    // ABSENCES sheet
    const absencesData = [
      ['matricule', 'type_absence', 'date_debut', 'date_fin'],
      ['E001', 'Congés payés', '15/01/2025', '19/01/2025'],
      ['E002', 'Formation', '10/02/2025', '12/02/2025'],
      ['E003', 'Maladie', '20/02/2025', '21/02/2025']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(absencesData), 'ABSENCES')
    
    // REFERENTIEL_ORGANISATION sheet
    const organisationData = [
      ['code_site', 'nom_site', 'code_cost_center', 'nom_cost_center'],
      ['SIEGE', 'Siège Social', 'RH', 'Ressources Humaines'],
      ['SIEGE', 'Siège Social', 'IT', 'Informatique'],
      ['SIEGE', 'Siège Social', 'FIN', 'Finance']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(organisationData), 'REFERENTIEL_ORGANISATION')
    
    // REFERENTIEL_ABSENCES sheet
    const absencesRefData = [
      ['type_absence', 'famille', 'indemnise', 'comptabilise_absenteisme'],
      ['Congés payés', 'Congés', 'OUI', 'NON'],
      ['RTT', 'Congés', 'OUI', 'NON'],
      ['Maladie', 'Maladie', 'OUI', 'OUI'],
      ['Formation', 'Formation', 'OUI', 'NON'],
      ['Accident du travail', 'Accident', 'OUI', 'OUI']
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(absencesRefData), 'REFERENTIEL_ABSENCES')
    
    XLSX.writeFile(wb, `template_import_rh_${new Date().toISOString().split('T')[0]}.xlsx`)
    addLog('Template téléchargé', 'success')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(139, 92, 246, 0.15) 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }} />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-20'} transition-all duration-300 bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-r border-slate-700/50`}>
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h3 className={`text-white font-bold ${sidebarOpen ? 'text-xl' : 'text-sm'} transition-all`}>
                {sidebarOpen ? 'Outils d\'Import' : 'Tools'}
              </h3>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-700/50 rounded-lg"
              >
                {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Template download */}
            <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
              <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'justify-center'}`}>
                <FileSpreadsheet size={20} className="text-green-400" />
                {sidebarOpen && <span className="text-green-400 font-medium">Template Excel</span>}
              </div>
              {sidebarOpen && (
                <button
                  onClick={downloadTemplate}
                  className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:opacity-90 transition-all"
                >
                  Télécharger
                </button>
              )}
            </div>

            {/* Import logs */}
            {sidebarOpen && importLogs.length > 0 && (
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Terminal size={16} className="text-purple-400" />
                  Journal d'import
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
                  {importLogs.map((log, idx) => (
                    <div key={idx} className="text-slate-400">{log}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick guide */}
            {sidebarOpen && (
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <BookOpen size={16} className="text-cyan-400" />
                  Guide rapide
                </h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-green-400 mt-0.5" />
                    <span>Formats dates: JJ/MM/AAAA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-green-400 mt-0.5" />
                    <span>5 onglets obligatoires</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-green-400 mt-0.5" />
                    <span>Import par batch de 100</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-green-400 mt-0.5" />
                    <span>KPIs calculés automatiquement</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 container max-w-6xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-slate-900/70 to-slate-800/70 border border-purple-500/20 rounded-2xl backdrop-blur-sm mb-6">
              <Database size={20} className="text-purple-400" />
              <span className="text-purple-400 font-mono text-sm">IMPORT SYSTEM v3.0</span>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            
            <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Import de Données RH
            </h1>
            
            <p className="text-slate-400 text-lg">
              Importez vos données Excel pour générer automatiquement vos KPIs
            </p>

            {company && selectedEstablishment && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700">
                  <span className="text-slate-300 text-sm">{company.nom}</span>
                </div>
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700">
                  <span className="text-slate-300 text-sm">{selectedEstablishment.nom}</span>
                </div>
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-8 p-6 bg-red-900/20 border border-red-500/30 rounded-2xl">
              <div className="flex items-center gap-3">
                <XCircle size={24} className="text-red-400" />
                <div className="flex-1">
                  <p className="text-red-400 font-bold">Erreur</p>
                  <p className="text-red-300 text-sm mt-1">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="p-2 hover:bg-red-500/20 rounded-lg">
                  <X size={16} className="text-red-400" />
                </button>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-500 ${
              isDragActive 
                ? 'border-purple-400 bg-purple-500/10 scale-[1.02]' 
                : file
                ? 'border-green-500 bg-green-500/5'
                : 'border-slate-600 hover:border-slate-500 bg-slate-900/30'
            }`}
          >
            <input {...getInputProps()} />
            
            {file ? (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
                  <FileCheck size={40} className="text-white" />
                </div>
                
                <div>
                  <h3 className="text-white font-bold text-2xl mb-2">{file.name}</h3>
                  <p className="text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>

                {processedData && (
                  <div className="bg-slate-800/50 rounded-2xl p-6 max-w-2xl mx-auto">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-400">{processedData.metadata.totalEmployees}</div>
                        <div className="text-xs text-slate-400 mt-1">Employés</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-cyan-400">{processedData.metadata.periods.length}</div>
                        <div className="text-xs text-slate-400 mt-1">Périodes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-400">{validationResult?.summary.qualityScore || 0}%</div>
                        <div className="text-xs text-slate-400 mt-1">Qualité</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <Upload size={64} className="text-slate-500 mx-auto" />
                <div>
                  <h3 className="text-white font-bold text-2xl mb-2">
                    {isDragActive ? 'Déposez le fichier ici' : 'Glissez-déposez votre fichier Excel'}
                  </h3>
                  <p className="text-slate-400">ou cliquez pour sélectionner</p>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
                  <span>XLSX/XLS</span>
                  <span>•</span>
                  <span>Max 50MB</span>
                  <span>•</span>
                  <span>5 onglets requis</span>
                </div>
              </div>
            )}
          </div>

          {/* Validation results */}
          {validationResult && (
            <div className="mt-8 p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50">
              <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-3">
                <Shield size={24} className="text-purple-400" />
                Résultats de validation
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                  <div className="text-2xl font-bold text-white">{validationResult.summary.totalErrors}</div>
                  <div className="text-xs text-slate-400 mt-1">Erreurs totales</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                  <div className="text-2xl font-bold text-red-400">{validationResult.summary.criticalErrors}</div>
                  <div className="text-xs text-slate-400 mt-1">Critiques</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                  <div className="text-2xl font-bold text-yellow-400">{validationResult.summary.warningCount}</div>
                  <div className="text-xs text-slate-400 mt-1">Avertissements</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                  <div className={`text-2xl font-bold ${validationResult.summary.canProceed ? 'text-green-400' : 'text-red-400'}`}>
                    {validationResult.summary.canProceed ? '✓' : '✗'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Prêt</div>
                </div>
              </div>

              {/* Error list */}
              {validationResult.errors.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {validationResult.errors.slice(0, 5).map(error => (
                    <div key={error.id} className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <XCircle size={16} className="text-red-400" />
                        <div className="flex-1">
                          <span className="text-red-400 font-medium">{error.sheet} L{error.row}</span>
                          <span className="text-red-300 text-sm ml-2">{error.message}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {validationResult.errors.length > 5 && (
                    <p className="text-slate-400 text-sm text-center">
                      +{validationResult.errors.length - 5} autres erreurs
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {importStatus === 'processing' && (
            <div className="mt-8 p-8 bg-slate-900/50 rounded-2xl border border-purple-500/30">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-xl flex items-center gap-3">
                  <Cpu size={24} className="text-purple-400 animate-spin" />
                  Import en cours
                </h3>
                <button
                  onClick={() => {
                    abortControllerRef.current?.abort()
                    setImportStatus('idle')
                  }}
                  className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400"
                >
                  Annuler
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">{importProgress.step}</span>
                    <span className="text-purple-400 font-mono">{importProgress.percentage}%</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${importProgress.percentage}%` }}
                    />
                  </div>
                </div>
                
                {importProgress.detail && (
                  <p className="text-sm text-slate-400 text-center">{importProgress.detail}</p>
                )}
              </div>
            </div>
          )}

          {/* Success message */}
          {importStatus === 'success' && (
            <div className="mt-8 p-10 bg-green-900/20 border border-green-500/30 rounded-2xl text-center">
              <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Import réussi!</h3>
              <p className="text-green-400 mb-6">{importProgress.message}</p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium"
                >
                  Voir le Dashboard
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-slate-700 text-white rounded-xl font-medium"
                >
                  Nouvel Import
                </button>
              </div>
            </div>
          )}

          {/* Import button */}
          {file && processedData && validationResult && importStatus === 'idle' && (
            <div className="mt-8 text-center">
              <button
                onClick={processImport}
                disabled={!validationResult.summary.canProceed || !selectedEstablishment}
                className={`px-12 py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 ${
                  validationResult.summary.canProceed
                    ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-xl'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {validationResult.summary.canProceed ? (
                  <span className="flex items-center gap-3">
                    <Zap size={24} />
                    Lancer l'import
                  </span>
                ) : (
                  'Corriger les erreurs avant l\'import'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}