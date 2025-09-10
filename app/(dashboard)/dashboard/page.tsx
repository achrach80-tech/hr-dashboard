'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Building2,
  RefreshCw,
  ChevronDown,
  Loader2,
  Heart,
  AlertTriangle,
  Activity,
  Award,
  Percent,
  Calendar,
  Sparkles,
  Brain,
  Upload,
  Star,
  Minus,
  Clock3,
  Banknote,
  Factory,
  Wallet,
  Timer,
  CircleDollarSign,
  Settings,
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PieChart,
  BarChart3,
  Shield,
  Zap,
  Target,
  HeartHandshake,
  UserCheck,
  Package,
  Gauge,
  Navigation,
  Clock,
  Euro,
  Database
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ============================================
// TYPE DEFINITIONS - ALIGNED WITH SQL SCHEMA V4.0
// ============================================

interface Snapshot {
  id: string
  etablissement_id: string
  periode: string
  
  // === EFFECTIFS ===
  effectif_fin_mois: number
  effectif_moyen: number
  etp_fin_mois: number
  
  // === MOUVEMENTS ===
  nb_entrees: number
  nb_sorties: number
  taux_turnover: number
  
  // === CONTRATS ===
  nb_cdi: number
  nb_cdd: number
  nb_alternance: number
  nb_stage: number
  nb_interim: number
  pct_cdi: number
  pct_precarite: number
  
  // === DÉMOGRAPHIE ===
  age_moyen: number
  anciennete_moyenne_mois: number
  pct_hommes: number
  pct_femmes: number
  
  // === PYRAMIDE DES ÂGES ===
  pct_age_moins_25: number
  pct_age_25_35: number
  pct_age_35_45: number
  pct_age_45_55: number
  pct_age_plus_55: number
  
  // === ANCIENNETÉ ===
  pct_anciennete_0_1_an: number
  pct_anciennete_1_3_ans: number
  pct_anciennete_3_5_ans: number
  pct_anciennete_5_10_ans: number
  pct_anciennete_plus_10_ans: number
  
  // === MASSE SALARIALE ===
  masse_salariale_brute: number
  cout_total_employeur: number
  salaire_base_moyen: number
  salaire_base_median: number
  cout_moyen_par_fte: number
  part_variable: number
  taux_charges: number
  
  // === ABSENTÉISME ===
  taux_absenteisme: number
  nb_jours_absence: number
  nb_absences_total: number
  duree_moyenne_absence: number
  nb_jours_maladie: number
  nb_jours_conges: number
  nb_jours_formation: number
  
  // === ALERTES ===
  alerte_turnover_eleve: boolean
  alerte_absenteisme_eleve: boolean
  
  // === QUALITÉ ===
  data_quality_score: number
  calculated_at: string
  calculation_duration_ms: number
}

interface Company {
  id: string
  nom: string
  code_entreprise?: string
  user_id: string
  subscription_plan: string
  subscription_status: string
  ai_features_enabled: boolean
  max_establishments: number
  max_employees: number
  seuil_turnover_default: number
  seuil_absenteisme_default: number
}

interface Establishment {
  id: string
  entreprise_id: string
  nom: string
  code_etablissement: string
  seuil_turnover?: number
  seuil_absenteisme?: number
  statut: string
  is_default: boolean
  is_headquarters: boolean
}

interface DashboardData {
  currentSnapshot: Snapshot
  previousSnapshot: Snapshot | null
  yearlySnapshot: Snapshot | null
  trendData: Snapshot[]
  company: Company
  establishment: Establishment
}

interface KPICard {
  id: string
  title: string
  value: number
  subtitle: string
  detail: string
  icon: React.ElementType
  color: string
  gradient: string
  evolution: {
    monthly: number
    yearly: number
  }
  format: 'currency' | 'percent' | 'number' | 'duration'
  isDiff?: boolean
  alert?: 'critical' | 'warning' | 'success' | null
  aiInsight?: string
  trend: 'up' | 'down' | 'stable'
  threshold?: number
  performance?: 'excellent' | 'good' | 'warning' | 'critical'
  category: 'headcount' | 'payroll' | 'absence' | 'performance'
}

interface Alert {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  timestamp: string
  category: 'headcount' | 'payroll' | 'absence' | 'quality'
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatPeriodDisplay = (periode: string): string => {
  if (!periode) return ''
  try {
    const date = new Date(periode)
    if (isNaN(date.getTime())) return periode
    return date.toLocaleDateString('fr-FR', { 
      month: 'long', 
      year: 'numeric' 
    })
  } catch {
    return periode
  }
}

const formatCurrency = (amount: number | null | undefined): string => {
  const value = amount ?? 0
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatNumber = (num: number | null | undefined): string => {
  const value = num ?? 0
  return new Intl.NumberFormat('fr-FR').format(Math.round(value))
}

const formatPercentage = (num: number | null | undefined, decimals = 1): string => {
  const value = num ?? 0
  return `${value.toFixed(decimals)}%`
}

const formatDuration = (months: number): string => {
  const years = Math.floor(months / 12)
  const remainingMonths = Math.round(months % 12)
  
  if (years === 0) return `${remainingMonths}m`
  if (remainingMonths === 0) return `${years}a`
  return `${years}a ${remainingMonths}m`
}

const calculateEvolution = (current: number, previous: number): number => {
  if (!previous || previous === 0) return 0
  return ((current - previous) / previous) * 100
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    if ('message' in error) return String(error.message)
    if ('details' in error) return String(error.details)
  }
  return 'Une erreur est survenue'
}

const getPerformanceLevel = (value: number, thresholds: { excellent: number, good: number, warning: number }, isLowerBetter = false): 'excellent' | 'good' | 'warning' | 'critical' => {
  if (isLowerBetter) {
    if (value <= thresholds.excellent) return 'excellent'
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.warning) return 'warning'
    return 'critical'
  } else {
    if (value >= thresholds.excellent) return 'excellent'
    if (value >= thresholds.good) return 'good'
    if (value >= thresholds.warning) return 'warning'
    return 'critical'
  }
}

const generateAIInsight = (metric: string, value: number, evolution: number, threshold?: number): string => {
  const insights: { [key: string]: (val: number, evo: number, thresh?: number) => string } = {
    effectif: (val, evo) => {
      if (evo > 15) return `Croissance forte (+${evo.toFixed(1)}%) - Anticipez les besoins RH`
      if (evo < -15) return `Réduction importante (${evo.toFixed(1)}%) - Analysez l'impact organisationnel`
      if (Math.abs(evo) < 2) return "Effectif stable - Situation maîtrisée"
      return `Évolution modérée de ${evo.toFixed(1)}% - Surveillance continue`
    },
    masse: (val, evo) => {
      if (evo > 20) return `Hausse significative (+${evo.toFixed(1)}%) - Vérifiez la rentabilité`
      if (evo < -8) return `Baisse notable (${evo.toFixed(1)}%) - Attention à la motivation des équipes`
      return `Évolution maîtrisée de ${Math.abs(evo).toFixed(1)}% - Dans les normes`
    },
    turnover: (val, evo, thresh) => {
      if (val > (thresh || 15)) return `Critique: ${val.toFixed(1)}% - Action urgente requise pour la fidélisation`
      if (val < 5) return `Excellent: ${val.toFixed(1)}% - Fidélisation très efficace`
      return `Niveau acceptable: ${val.toFixed(1)}% - Surveillance continue recommandée`
    },
    absenteisme: (val, evo, thresh) => {
      if (val > (thresh || 8)) return `Préoccupant: ${val.toFixed(1)}% - Programme QVT recommandé`
      if (val < 3) return `Très bon niveau: ${val.toFixed(1)}% - Continuez sur cette lancée`
      return `Niveau acceptable: ${val.toFixed(1)}% - Maintenir la vigilance`
    }
  }
  
  return insights[metric]?.(value, evolution, threshold) || "Analyse en cours..."
}

// ============================================
// CUSTOM HOOKS
// ============================================

const useDashboardData = (establishmentId: string | null, selectedPeriod: string) => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!establishmentId || !selectedPeriod) return

    try {
      setLoading(true)
      setError(null)

      // Fetch establishment with company data
      const { data: establishmentData, error: establishmentError } = await supabase
        .from('etablissements')
        .select(`
          *,
          entreprises!inner(*)
        `)
        .eq('id', establishmentId)
        .single()

      if (establishmentError) throw establishmentError

      // Fetch current snapshot
      const { data: currentSnap, error: currentError } = await supabase
        .from('snapshots_mensuels')
        .select('*')
        .eq('etablissement_id', establishmentId)
        .eq('periode', selectedPeriod)
        .single()

      if (currentError) {
        if (currentError.code === 'PGRST116') {
          throw new Error('NO_DATA_FOR_PERIOD')
        }
        throw currentError
      }

      // Fetch comparison data
      const currentDate = new Date(selectedPeriod)
      const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      const previousYear = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1)

      const [
        { data: prevSnap },
        { data: yearSnap },
        { data: trendsData }
      ] = await Promise.all([
        supabase
          .from('snapshots_mensuels')
          .select('*')
          .eq('etablissement_id', establishmentId)
          .eq('periode', previousMonth.toISOString().split('T')[0])
          .single(),
        
        supabase
          .from('snapshots_mensuels')
          .select('*')
          .eq('etablissement_id', establishmentId)
          .eq('periode', previousYear.toISOString().split('T')[0])
          .single(),
        
        supabase
          .from('snapshots_mensuels')
          .select('*')
          .eq('etablissement_id', establishmentId)
          .order('periode', { ascending: false })
          .limit(12)
      ])

      setData({
        currentSnapshot: currentSnap,
        previousSnapshot: prevSnap || null,
        yearlySnapshot: yearSnap || null,
        trendData: trendsData || [],
        company: establishmentData.entreprises,
        establishment: establishmentData
      })
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Dashboard data fetch error:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [establishmentId, selectedPeriod, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData, lastRefresh }
}

const useAvailablePeriods = (establishmentId: string | null) => {
  const [periods, setPeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const fetchPeriods = async () => {
      if (!establishmentId) return

      try {
        const { data, error } = await supabase
          .from('snapshots_mensuels')
          .select('periode')
          .eq('etablissement_id', establishmentId)
          .order('periode', { ascending: false })

        if (error) throw error
        setPeriods(data?.map(d => d.periode) || [])
      } catch (err) {
        console.error('Error fetching periods:', err)
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    fetchPeriods()
  }, [establishmentId, supabase])

  return { periods, loading, error }
}

const useUserCompanyEstablishments = () => {
  const [company, setCompany] = useState<Company | null>(null)
  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const initializeUserData = async () => {
      try {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !currentUser) {
          router.push('/auth/login')
          return
        }

        const { data: companyData, error: companyError } = await supabase
          .from('entreprises')
          .select(`
            *,
            etablissements (*)
          `)
          .eq('user_id', currentUser.id)
          .single()

        if (companyError) {
          if (companyError.code === 'PGRST116') {
            router.push('/import')
            return
          }
          throw companyError
        }

        setCompany(companyData as Company)
        const establishmentsData = companyData.etablissements || []
        setEstablishments(establishmentsData)

        const defaultEstablishment = establishmentsData?.find((e: any) => e.is_headquarters) || 
                                   establishmentsData?.find((e: any) => e.is_default) || 
                                   establishmentsData?.[0]
        if (defaultEstablishment) {
          setSelectedEstablishment(defaultEstablishment as Establishment)
        }

      } catch (error) {
        console.error('Setup error:', error)
        setError(getErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }

    initializeUserData()
  }, [supabase, router])

  return { 
    company, 
    establishments, 
    selectedEstablishment, 
    setSelectedEstablishment, 
    loading, 
    error 
  }
}

// ============================================
// COMPONENTS
// ============================================

const LoadingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
    <div className="p-8 space-y-8">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl animate-pulse"></div>
          <div>
            <div className="w-48 h-8 bg-slate-800 rounded animate-pulse mb-2"></div>
            <div className="w-64 h-4 bg-slate-800 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-32 h-10 bg-slate-800 rounded-xl animate-pulse"></div>
          <div className="w-24 h-10 bg-slate-800 rounded-xl animate-pulse"></div>
        </div>
      </div>
      
      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-slate-900/50 rounded-2xl p-6 animate-pulse border border-slate-700/50">
            <div className="w-12 h-12 bg-slate-700 rounded-xl mb-4"></div>
            <div className="h-4 bg-slate-700 rounded mb-2 w-3/4"></div>
            <div className="h-8 bg-slate-700 rounded mb-2"></div>
            <div className="h-3 bg-slate-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const NeumorphicCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`
    bg-gradient-to-br from-slate-900/40 to-slate-800/40 
    backdrop-blur-xl rounded-3xl border border-slate-700/30
    shadow-[8px_8px_16px_rgba(0,0,0,0.4),-8px_-8px_16px_rgba(255,255,255,0.02)]
    hover:shadow-[12px_12px_24px_rgba(0,0,0,0.5),-12px_-12px_24px_rgba(255,255,255,0.03)]
    transition-all duration-500 hover:scale-[1.02]
    ${className}
  `}>
    {children}
  </div>
)

const KPICardComponent: React.FC<{ 
  kpi: KPICard; 
  company: Company;
  onClick?: () => void;
}> = React.memo(({ kpi, company, onClick }) => {
  const IconComponent = kpi.icon

  const getPerformanceIndicator = (performance?: string) => {
    switch (performance) {
      case 'excellent': return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', glow: 'shadow-emerald-500/20' }
      case 'good': return { color: 'text-cyan-400', bg: 'bg-cyan-500/20', glow: 'shadow-cyan-500/20' }
      case 'warning': return { color: 'text-amber-400', bg: 'bg-amber-500/20', glow: 'shadow-amber-500/20' }
      case 'critical': return { color: 'text-red-400', bg: 'bg-red-500/20', glow: 'shadow-red-500/20' }
      default: return { color: 'text-slate-400', bg: 'bg-slate-500/20', glow: 'shadow-slate-500/20' }
    }
  }

  const performanceStyle = getPerformanceIndicator(kpi.performance)

  return (
    <NeumorphicCard 
      className={`p-6 cursor-pointer group hover:border-slate-600/50 ${performanceStyle.glow} hover:shadow-2xl`}
    >
      {/* Alert glow */}
      {kpi.alert && (
        <div className={`absolute inset-0 rounded-3xl ${
          kpi.alert === 'critical' ? 'bg-red-500/5' :
          kpi.alert === 'warning' ? 'bg-amber-500/5' :
          'bg-emerald-500/5'
        } blur-xl`}></div>
      )}
      
      {/* Animated background gradient */}
      <div 
        className="absolute inset-0 rounded-3xl opacity-5 group-hover:opacity-10 transition-opacity duration-500"
        style={{ 
          background: `conic-gradient(from 0deg, ${kpi.color}20, transparent, ${kpi.color}20)`,
          animation: 'spin 20s linear infinite'
        }}
      />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300 border border-white/10 relative overflow-hidden"
            style={{ background: kpi.gradient }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
            <IconComponent size={32} className="text-white relative z-10" />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Trend with animated background */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
              kpi.trend === 'up' ? 'bg-emerald-500/20 border-emerald-500/40 shadow-emerald-500/20' :
              kpi.trend === 'down' ? 'bg-red-500/20 border-red-500/40 shadow-red-500/20' :
              'bg-slate-500/20 border-slate-500/40 shadow-slate-500/20'
            } shadow-lg`}>
              {kpi.trend === 'up' ? <TrendingUp size={18} className="text-emerald-400" /> :
               kpi.trend === 'down' ? <TrendingDown size={18} className="text-red-400" /> :
               <Minus size={18} className="text-slate-400" />}
            </div>
            
            {/* Performance indicator */}
            {kpi.performance && (
              <div className={`w-4 h-4 rounded-full ${performanceStyle.bg} border border-current ${performanceStyle.color} shadow-lg`}></div>
            )}
            
            {/* AI indicator with pulse */}
            {kpi.aiInsight && company.ai_features_enabled && (
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center animate-pulse">
                <Brain size={14} className="text-purple-400" />
              </div>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm mb-3 font-medium tracking-wider uppercase">{kpi.title}</p>
          <div className="mb-3">
            <p className="text-5xl font-bold text-white mb-1 tracking-tight font-mono">
              {kpi.format === 'currency' ? formatCurrency(kpi.value) :
               kpi.format === 'percent' ? formatPercentage(kpi.value) :
               kpi.format === 'duration' ? formatDuration(kpi.value) :
               formatNumber(kpi.value)}
            </p>
            <p className="text-slate-400 text-sm">{kpi.subtitle}</p>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">{kpi.detail}</p>
          {kpi.threshold && (
            <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
              <Target size={10} />
              Seuil: {kpi.format === 'percent' ? formatPercentage(kpi.threshold) : formatNumber(kpi.threshold)}
            </p>
          )}
        </div>
        
        {/* Evolution metrics with glass effect */}
        <div className="pt-4 border-t border-slate-700/50">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-800/20 rounded-xl backdrop-blur-sm border border-slate-700/30">
              <p className="text-slate-500 text-xs mb-2 font-medium">Mois précédent</p>
              <div className={`flex items-center justify-center gap-1 text-sm font-bold ${
                kpi.isDiff
                  ? (kpi.evolution.monthly > 0 ? 'text-red-400' : 'text-emerald-400')
                  : (kpi.evolution.monthly > 0 ? 'text-emerald-400' : 'text-red-400')
              }`}>
                {Math.abs(kpi.evolution.monthly) > 0.01 ? (
                  <>
                    {kpi.evolution.monthly > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    <span>
                      {kpi.isDiff
                        ? `${Math.abs(kpi.evolution.monthly).toFixed(1)}pts`
                        : `${Math.abs(kpi.evolution.monthly).toFixed(1)}%`}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
            
            <div className="text-center p-3 bg-slate-800/20 rounded-xl backdrop-blur-sm border border-slate-700/30">
              <p className="text-slate-500 text-xs mb-2 font-medium">Année précédente</p>
              <div className={`flex items-center justify-center gap-1 text-sm font-bold ${
                kpi.isDiff
                  ? (kpi.evolution.yearly > 0 ? 'text-red-400' : 'text-emerald-400')
                  : (kpi.evolution.yearly > 0 ? 'text-emerald-400' : 'text-red-400')
              }`}>
                {Math.abs(kpi.evolution.yearly) > 0.01 ? (
                  <>
                    {kpi.evolution.yearly > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    <span>
                      {kpi.isDiff
                        ? `${Math.abs(kpi.evolution.yearly).toFixed(1)}pts`
                        : `${Math.abs(kpi.evolution.yearly).toFixed(1)}%`}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* AI Insight with glowing effect */}
        {kpi.aiInsight && company.ai_features_enabled && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="p-3 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-xl border border-purple-500/20 backdrop-blur-sm">
              <div className="flex items-start gap-2">
                <Brain size={14} className="text-purple-400 mt-0.5 flex-shrink-0 animate-pulse" />
                <p className="text-xs text-purple-300 italic leading-relaxed font-medium">{kpi.aiInsight}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </NeumorphicCard>
  )
})

KPICardComponent.displayName = 'KPICard'

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function OptimizedDashboardV4() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [showMonthSelector, setShowMonthSelector] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showEstablishmentSelector, setShowEstablishmentSelector] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const { 
    company, 
    establishments, 
    selectedEstablishment, 
    setSelectedEstablishment, 
    loading: setupLoading, 
    error: setupError 
  } = useUserCompanyEstablishments()

  const { periods, loading: periodsLoading, error: periodsError } = useAvailablePeriods(selectedEstablishment?.id || null)
  const { data, loading, error: dataError, refetch, lastRefresh } = useDashboardData(selectedEstablishment?.id || null, selectedPeriod)

  // Set initial period
  useEffect(() => {
    if (periods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(periods[0])
    }
  }, [periods, selectedPeriod])

  // Calculate KPIs based on simplified schema
  const kpiCards = useMemo((): KPICard[] => {
    if (!data) return []

    const { currentSnapshot, previousSnapshot, yearlySnapshot, company, establishment } = data

    const monthlyEvolutions = {
      effectif: previousSnapshot ? calculateEvolution(currentSnapshot.effectif_fin_mois, previousSnapshot.effectif_fin_mois) : 0,
      masse: previousSnapshot ? calculateEvolution(currentSnapshot.masse_salariale_brute, previousSnapshot.masse_salariale_brute) : 0,
      turnover: previousSnapshot ? currentSnapshot.taux_turnover - previousSnapshot.taux_turnover : 0,
      absenteisme: previousSnapshot ? currentSnapshot.taux_absenteisme - previousSnapshot.taux_absenteisme : 0,
      cout: previousSnapshot ? calculateEvolution(currentSnapshot.cout_total_employeur, previousSnapshot.cout_total_employeur) : 0,
      fte: previousSnapshot ? calculateEvolution(currentSnapshot.etp_fin_mois, previousSnapshot.etp_fin_mois) : 0,
      charges: previousSnapshot ? currentSnapshot.taux_charges - previousSnapshot.taux_charges : 0,
      anciennete: previousSnapshot ? calculateEvolution(currentSnapshot.anciennete_moyenne_mois, previousSnapshot.anciennete_moyenne_mois) : 0
    }

    const yearlyEvolutions = {
      effectif: yearlySnapshot ? calculateEvolution(currentSnapshot.effectif_fin_mois, yearlySnapshot.effectif_fin_mois) : 0,
      masse: yearlySnapshot ? calculateEvolution(currentSnapshot.masse_salariale_brute, yearlySnapshot.masse_salariale_brute) : 0,
      turnover: yearlySnapshot ? currentSnapshot.taux_turnover - yearlySnapshot.taux_turnover : 0,
      absenteisme: yearlySnapshot ? currentSnapshot.taux_absenteisme - yearlySnapshot.taux_absenteisme : 0,
      cout: yearlySnapshot ? calculateEvolution(currentSnapshot.cout_total_employeur, yearlySnapshot.cout_total_employeur) : 0,
      fte: yearlySnapshot ? calculateEvolution(currentSnapshot.etp_fin_mois, yearlySnapshot.etp_fin_mois) : 0,
      charges: yearlySnapshot ? currentSnapshot.taux_charges - yearlySnapshot.taux_charges : 0,
      anciennete: yearlySnapshot ? calculateEvolution(currentSnapshot.anciennete_moyenne_mois, yearlySnapshot.anciennete_moyenne_mois) : 0
    }

    const turnoverThreshold = establishment.seuil_turnover || company.seuil_turnover_default || 15
    const absenteeismThreshold = establishment.seuil_absenteisme || company.seuil_absenteisme_default || 8

    return [
      // Effectif
      {
        id: 'effectif',
        title: 'Effectif Total',
        value: currentSnapshot.effectif_fin_mois,
        subtitle: `ETP: ${currentSnapshot.etp_fin_mois.toFixed(1)} • Moyen: ${currentSnapshot.effectif_moyen.toFixed(0)}`,
        detail: `${currentSnapshot.nb_entrees} entrées • ${currentSnapshot.nb_sorties} sorties ce mois`,
        icon: Users,
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)',
        evolution: {
          monthly: monthlyEvolutions.effectif,
          yearly: yearlyEvolutions.effectif
        },
        format: 'number' as const,
        trend: monthlyEvolutions.effectif > 2 ? 'up' : monthlyEvolutions.effectif < -2 ? 'down' : 'stable',
        performance: getPerformanceLevel(currentSnapshot.effectif_fin_mois, { 
          excellent: 50, 
          good: 30, 
          warning: 15 
        }),
        aiInsight: generateAIInsight('effectif', currentSnapshot.effectif_fin_mois, monthlyEvolutions.effectif),
        category: 'headcount' as const
      },

      // Turnover
      {
        id: 'turnover',
        title: 'Taux de Turnover',
        value: currentSnapshot.taux_turnover,
        subtitle: `${currentSnapshot.nb_entrees + currentSnapshot.nb_sorties} mouvements totaux`,
        detail: currentSnapshot.alerte_turnover_eleve ? 'Seuil dépassé - Action requise' : 'Niveau acceptable',
        icon: currentSnapshot.taux_turnover > turnoverThreshold ? TrendingUp : Activity,
        color: currentSnapshot.alerte_turnover_eleve ? '#ef4444' : '#10b981',
        gradient: currentSnapshot.alerte_turnover_eleve
          ? 'linear-gradient(135deg, #ef4444 0%, #f87171 50%, #fca5a5 100%)'
          : 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
        evolution: {
          monthly: monthlyEvolutions.turnover,
          yearly: yearlyEvolutions.turnover
        },
        format: 'percent' as const,
        isDiff: true,
        threshold: turnoverThreshold,
        alert: currentSnapshot.alerte_turnover_eleve ? 'critical' : null,
        trend: monthlyEvolutions.turnover > 2 ? 'up' : monthlyEvolutions.turnover < -2 ? 'down' : 'stable',
        performance: getPerformanceLevel(currentSnapshot.taux_turnover, { 
          excellent: 5, 
          good: 10, 
          warning: turnoverThreshold 
        }, true),
        aiInsight: generateAIInsight('turnover', currentSnapshot.taux_turnover, monthlyEvolutions.turnover, turnoverThreshold),
        category: 'headcount' as const
      },

      // Masse salariale
      {
        id: 'masse',
        title: 'Masse Salariale Brute',
        value: currentSnapshot.masse_salariale_brute,
        subtitle: `Médian: ${formatCurrency(currentSnapshot.salaire_base_median)}`,
        detail: `Salaire moyen: ${formatCurrency(currentSnapshot.salaire_base_moyen)}`,
        icon: Banknote,
        color: '#06b6d4',
        gradient: 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 50%, #38bdf8 100%)',
        evolution: {
          monthly: monthlyEvolutions.masse,
          yearly: yearlyEvolutions.masse
        },
        format: 'currency' as const,
        trend: monthlyEvolutions.masse > 5 ? 'up' : monthlyEvolutions.masse < -5 ? 'down' : 'stable',
        performance: getPerformanceLevel(currentSnapshot.masse_salariale_brute, { 
          excellent: 1000000, 
          good: 500000, 
          warning: 200000 
        }),
        aiInsight: generateAIInsight('masse', currentSnapshot.masse_salariale_brute, monthlyEvolutions.masse),
        category: 'payroll' as const
      },

      // Coût total employeur
      {
        id: 'cout_total',
        title: 'Coût Total Employeur',
        value: currentSnapshot.cout_total_employeur,
        subtitle: `Charges: ${currentSnapshot.taux_charges.toFixed(1)}% • Variable: ${currentSnapshot.part_variable.toFixed(1)}%`,
        detail: `Coût moyen par ETP: ${formatCurrency(currentSnapshot.cout_moyen_par_fte)}`,
        icon: CircleDollarSign,
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)',
        evolution: {
          monthly: monthlyEvolutions.cout,
          yearly: yearlyEvolutions.cout
        },
        format: 'currency' as const,
        trend: monthlyEvolutions.cout > 3 ? 'up' : monthlyEvolutions.cout < -3 ? 'down' : 'stable',
        performance: getPerformanceLevel(currentSnapshot.taux_charges, { 
          excellent: 35, 
          good: 40, 
          warning: 45 
        }, true),
        category: 'payroll' as const
      },

      // Taux CDI
      {
        id: 'taux_cdi',
        title: 'Stabilité Contractuelle',
        value: currentSnapshot.pct_cdi,
        subtitle: `${currentSnapshot.nb_cdi} CDI sur ${currentSnapshot.effectif_fin_mois} employés`,
        detail: `Précarité: ${currentSnapshot.pct_precarite.toFixed(1)}% (CDD + Intérim + Stage)`,
        icon: Shield,
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)',
        evolution: {
          monthly: previousSnapshot ? currentSnapshot.pct_cdi - previousSnapshot.pct_cdi : 0,
          yearly: yearlySnapshot ? currentSnapshot.pct_cdi - yearlySnapshot.pct_cdi : 0
        },
        format: 'percent' as const,
        isDiff: true,
        trend: 'stable',
        performance: getPerformanceLevel(currentSnapshot.pct_cdi, { 
          excellent: 85, 
          good: 70, 
          warning: 60 
        }),
        category: 'performance' as const
      },

      // Absentéisme
      {
        id: 'absenteisme',
        title: 'Taux d\'Absentéisme',
        value: currentSnapshot.taux_absenteisme,
        subtitle: `${currentSnapshot.nb_jours_absence} jours d'absence • ${currentSnapshot.nb_absences_total} absences`,
        detail: `Durée moyenne: ${currentSnapshot.duree_moyenne_absence.toFixed(1)}j • Maladie: ${currentSnapshot.nb_jours_maladie}j`,
        icon: Heart,
        color: currentSnapshot.alerte_absenteisme_eleve ? '#f59e0b' : '#10b981',
        gradient: currentSnapshot.alerte_absenteisme_eleve
          ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)'
          : 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
        evolution: {
          monthly: monthlyEvolutions.absenteisme,
          yearly: yearlyEvolutions.absenteisme
        },
        format: 'percent' as const,
        isDiff: true,
        threshold: absenteeismThreshold,
        alert: currentSnapshot.alerte_absenteisme_eleve ? 'warning' : null,
        trend: monthlyEvolutions.absenteisme > 1 ? 'up' : monthlyEvolutions.absenteisme < -1 ? 'down' : 'stable',
        performance: getPerformanceLevel(currentSnapshot.taux_absenteisme, { 
          excellent: 3, 
          good: 5, 
          warning: absenteeismThreshold 
        }, true),
        aiInsight: generateAIInsight('absenteisme', currentSnapshot.taux_absenteisme, monthlyEvolutions.absenteisme, absenteeismThreshold),
        category: 'absence' as const
      },

      // Ancienneté moyenne
      {
        id: 'anciennete',
        title: 'Ancienneté Moyenne',
        value: currentSnapshot.anciennete_moyenne_mois,
        subtitle: `${currentSnapshot.pct_anciennete_plus_10_ans.toFixed(0)}% ont plus de 10 ans`,
        detail: `Juniors (< 1an): ${currentSnapshot.pct_anciennete_0_1_an.toFixed(0)}% • Seniors (> 5ans): ${(currentSnapshot.pct_anciennete_5_10_ans + currentSnapshot.pct_anciennete_plus_10_ans).toFixed(0)}%`,
        icon: Award,
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)',
        evolution: {
          monthly: monthlyEvolutions.anciennete,
          yearly: yearlyEvolutions.anciennete
        },
        format: 'duration' as const,
        trend: monthlyEvolutions.anciennete > 2 ? 'up' : 'stable',
        performance: getPerformanceLevel(currentSnapshot.anciennete_moyenne_mois, { 
          excellent: 60, 
          good: 36, 
          warning: 12 
        }),
        category: 'performance' as const
      },

      // Qualité des données
      {
        id: 'qualite',
        title: 'Qualité des Données',
        value: currentSnapshot.data_quality_score,
        subtitle: `Calculé en ${currentSnapshot.calculation_duration_ms}ms`,
        detail: `Dernière mise à jour: ${new Date(currentSnapshot.calculated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
        icon: Database,
        color: currentSnapshot.data_quality_score >= 90 ? '#10b981' : currentSnapshot.data_quality_score >= 70 ? '#f59e0b' : '#ef4444',
        gradient: currentSnapshot.data_quality_score >= 90 
          ? 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)'
          : currentSnapshot.data_quality_score >= 70
          ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)'
          : 'linear-gradient(135deg, #ef4444 0%, #f87171 50%, #fca5a5 100%)',
        evolution: {
          monthly: previousSnapshot ? currentSnapshot.data_quality_score - previousSnapshot.data_quality_score : 0,
          yearly: yearlySnapshot ? currentSnapshot.data_quality_score - yearlySnapshot.data_quality_score : 0
        },
        format: 'percent' as const,
        isDiff: true,
        trend: 'stable',
        performance: getPerformanceLevel(currentSnapshot.data_quality_score, { 
          excellent: 95, 
          good: 85, 
          warning: 70 
        }),
        alert: currentSnapshot.data_quality_score < 70 ? 'warning' : null,
        category: 'performance' as const
      }
    ]
  }, [data])

  const handleRefresh = useCallback(async () => {
    if (!selectedEstablishment || !selectedPeriod) return
    
    setRefreshing(true)
    try {
      await supabase.rpc('calculate_snapshot_for_period', {
        p_etablissement_id: selectedEstablishment.id,
        p_periode: selectedPeriod
      })
      await refetch()
    } catch (err) {
      console.error('Refresh error:', err)
    } finally {
      setRefreshing(false)
    }
  }, [selectedEstablishment, selectedPeriod, supabase, refetch])

  // Generate alerts
  const alerts = useMemo((): Alert[] => {
    if (!data) return []

    const alerts: Alert[] = []
    const { currentSnapshot } = data

    if (currentSnapshot.alerte_turnover_eleve) {
      alerts.push({
        id: 'turnover-alert',
        type: 'warning',
        title: 'Turnover critique',
        message: `Le taux de turnover (${currentSnapshot.taux_turnover.toFixed(1)}%) dépasse le seuil d'alerte`,
        priority: 'high',
        timestamp: new Date().toISOString(),
        category: 'headcount'
      })
    }

    if (currentSnapshot.alerte_absenteisme_eleve) {
      alerts.push({
        id: 'absence-alert',
        type: 'warning',
        title: 'Absentéisme élevé',
        message: `Le taux d'absentéisme (${currentSnapshot.taux_absenteisme.toFixed(1)}%) nécessite une attention`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        category: 'absence'
      })
    }

    if (currentSnapshot.data_quality_score < 80) {
      alerts.push({
        id: 'quality-alert',
        type: 'info',
        title: 'Qualité des données',
        message: `Score de qualité: ${currentSnapshot.data_quality_score}% - Vérification recommandée`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        category: 'quality'
      })
    }

    return alerts
  }, [data])

  // Loading state
  if (setupLoading || loading || periodsLoading) {
    return <LoadingSkeleton />
  }

  // Error handling
  if (setupError || dataError || periodsError) {
    const errorMsg = setupError || dataError || periodsError
    
    if (errorMsg?.toString().includes('NO_DATA')) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
          <NeumorphicCard className="text-center max-w-lg p-12">
            <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-3xl flex items-center justify-center mb-8 mx-auto">
              <Upload className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-white text-3xl font-bold mb-4">Aucune donnée disponible</h2>
            <p className="text-slate-300 mb-8 leading-relaxed">
              Importez vos données RH pour commencer à utiliser le dashboard analytics.
            </p>
            <button
              onClick={() => router.push('/import')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-2xl text-white font-semibold hover:opacity-90 transition-all transform hover:scale-105 shadow-lg"
            >
              Importer des données
            </button>
          </NeumorphicCard>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
        <NeumorphicCard className="text-center max-w-lg p-12">
          <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl flex items-center justify-center mb-8 mx-auto">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-white text-3xl font-bold mb-4">Erreur</h2>
          <p className="text-slate-300 mb-8">{getErrorMessage(errorMsg)}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-2xl text-white font-semibold hover:opacity-90 transition-all transform hover:scale-105"
          >
            Réessayer
          </button>
        </NeumorphicCard>
      </div>
    )
  }

  if (!data || !company || !selectedEstablishment) {
    return <LoadingSkeleton />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative">
      {/* Enhanced futuristic background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Animated grid */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
            animation: 'grid-move 20s linear infinite'
          }}
        />
        
        {/* Floating orbs with improved animation */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '6s' }}></div>
        
        {/* Scanning lines */}
        <div className="absolute inset-0">
          <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent animate-scan"></div>
        </div>
      </div>

      {/* Header with glass morphism */}
      <div className="relative sticky top-0 z-50 backdrop-blur-2xl bg-slate-950/80 border-b border-slate-800/50">
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 via-cyan-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl animate-gradient">
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-3xl"></div>
                  <Brain size={32} className="text-white relative z-10" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-3xl blur-xl opacity-50 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  RH Analytics
                </h1>
                <div className="flex items-center gap-3 text-sm text-slate-400 mt-2">
                  <Building2 size={16} />
                  <span className="font-medium">{company.nom}</span>
                  <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                  <span>{selectedEstablishment.nom}</span>
                  {company.ai_features_enabled && (
                    <>
                      <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                      <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-lg border border-purple-500/30">
                        <Sparkles size={12} className="text-purple-400" />
                        <span className="text-purple-400 font-medium">IA</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Alerts with pulse animation */}
              {alerts.length > 0 && (
                <div className="relative">
                  <button className="p-3 text-amber-400 hover:text-amber-300 transition-colors hover:bg-amber-500/10 rounded-2xl border border-amber-500/30 backdrop-blur-sm">
                    <Bell size={20} />
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-xs text-white font-bold animate-pulse">
                      {alerts.length}
                    </div>
                  </button>
                </div>
              )}

              {/* Establishment selector */}
              {establishments.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setShowEstablishmentSelector(!showEstablishmentSelector)}
                    className="flex items-center gap-2 px-4 py-3 bg-slate-800/30 hover:bg-slate-700/30 rounded-2xl border border-slate-700/50 transition-all backdrop-blur-sm"
                  >
                    <Factory size={16} className="text-slate-400" />
                    <span className="text-white text-sm font-medium">{selectedEstablishment.nom}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showEstablishmentSelector ? 'rotate-180' : ''}`} />
                  </button>

                  {showEstablishmentSelector && (
                    <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-700/50 shadow-2xl z-50">
                      <div className="p-2">
                        {establishments.map((est) => (
                          <button
                            key={est.id}
                            onClick={() => {
                              setSelectedEstablishment(est)
                              setShowEstablishmentSelector(false)
                            }}
                            className={`w-full px-4 py-4 rounded-xl text-left transition-all ${
                              est.id === selectedEstablishment.id
                                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white'
                                : 'hover:bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            <div className="font-medium">{est.nom}</div>
                            <div className="text-xs opacity-70 mt-1">{est.code_etablissement}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Period selector */}
              <div className="relative">
                <button
                  onClick={() => setShowMonthSelector(!showMonthSelector)}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-800/30 hover:bg-slate-700/30 rounded-2xl border border-slate-700/50 transition-all backdrop-blur-sm"
                >
                  <Calendar size={16} className="text-purple-400" />
                  <span className="text-white font-medium">{formatPeriodDisplay(selectedPeriod)}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showMonthSelector ? 'rotate-180' : ''}`} />
                </button>

                {showMonthSelector && (
                  <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-700/50 shadow-2xl z-50">
                    <div className="p-2">
                      {periods.map((period) => (
                        <button
                          key={period}
                          onClick={() => {
                            setSelectedPeriod(period)
                            setShowMonthSelector(false)
                          }}
                          className={`w-full px-4 py-4 rounded-xl text-left transition-all ${
                            period === selectedPeriod
                              ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white'
                              : 'hover:bg-slate-800/50 text-slate-300'
                          }`}
                        >
                          {formatPeriodDisplay(period)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-3 text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-all hover:bg-purple-500/10 rounded-2xl border border-purple-500/30 backdrop-blur-sm"
                title="Recalculer les KPIs"
              >
                <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => router.push('/import')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 rounded-2xl text-white font-semibold transition-all shadow-xl transform hover:scale-105"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts notification bar */}
      {alerts.length > 0 && (
        <div className="relative z-40 mx-8 mt-4 p-4 bg-gradient-to-r from-amber-900/20 via-orange-900/20 to-red-900/20 border border-amber-500/30 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-amber-300 font-semibold">
                {alerts.length} alerte{alerts.length > 1 ? 's' : ''} active{alerts.length > 1 ? 's' : ''}
              </p>
              <p className="text-amber-400/80 text-sm">
                {alerts.map(alert => alert.title).join(' • ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 p-8">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-12">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.id}
              onClick={() => console.log(`Clicked ${kpi.id}`)}
              className="cursor-pointer"
            >
              <KPICardComponent 
                kpi={kpi} 
                company={company}
              />
            </div>
          ))}
        </div>

        {/* Secondary analytics section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Contract distribution */}
          <NeumorphicCard className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                <PieChart size={24} className="text-white" />
              </div>
              <h3 className="text-white font-bold text-xl">Répartition Contractuelle</h3>
            </div>
            <div className="space-y-6">
              {[
                { label: 'CDI', value: data.currentSnapshot.nb_cdi, pct: data.currentSnapshot.pct_cdi, color: 'from-emerald-500 via-emerald-400 to-emerald-600', textColor: 'text-emerald-400' },
                { label: 'CDD', value: data.currentSnapshot.nb_cdd, pct: (data.currentSnapshot.nb_cdd / data.currentSnapshot.effectif_fin_mois) * 100, color: 'from-amber-500 via-amber-400 to-amber-600', textColor: 'text-amber-400' },
                { label: 'Alternance', value: data.currentSnapshot.nb_alternance, pct: (data.currentSnapshot.nb_alternance / data.currentSnapshot.effectif_fin_mois) * 100, color: 'from-purple-500 via-purple-400 to-purple-600', textColor: 'text-purple-400' },
                { label: 'Stage', value: data.currentSnapshot.nb_stage, pct: (data.currentSnapshot.nb_stage / data.currentSnapshot.effectif_fin_mois) * 100, color: 'from-cyan-500 via-cyan-400 to-cyan-600', textColor: 'text-cyan-400' },
                { label: 'Intérim', value: data.currentSnapshot.nb_interim, pct: (data.currentSnapshot.nb_interim / data.currentSnapshot.effectif_fin_mois) * 100, color: 'from-red-500 via-red-400 to-red-600', textColor: 'text-red-400' }
              ].filter(c => c.value > 0).map(contract => (
                <div key={contract.label} className="group">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`font-semibold ${contract.textColor}`}>{contract.label}</span>
                    <div className="text-right">
                      <span className="text-white font-bold text-lg">{contract.value}</span>
                      <span className="text-slate-400 text-sm ml-2">({contract.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="relative w-full bg-slate-800/50 rounded-full h-4 overflow-hidden border border-slate-700/50">
                    <div 
                      className={`h-full bg-gradient-to-r ${contract.color} rounded-full transition-all duration-1000 group-hover:scale-x-105 relative overflow-hidden`}
                      style={{ width: `${contract.pct}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </NeumorphicCard>

          {/* Demographics and age pyramid */}
          <NeumorphicCard className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-orange-500 rounded-2xl flex items-center justify-center">
                <Users size={24} className="text-white" />
              </div>
              <h3 className="text-white font-bold text-xl">Démographie</h3>
            </div>
            <div className="space-y-8">
              {/* Key stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                  <div className="text-cyan-400 font-bold text-2xl">{data.currentSnapshot.age_moyen.toFixed(1)}</div>
                  <div className="text-xs text-slate-400 mt-1">Âge moyen</div>
                </div>
                <div className="text-center p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                  <div className="text-purple-400 font-bold text-2xl">{formatDuration(data.currentSnapshot.anciennete_moyenne_mois)}</div>
                  <div className="text-xs text-slate-400 mt-1">Ancienneté moy.</div>
                </div>
              </div>
              
              {/* Gender distribution */}
              <div>
                <div className="text-slate-400 text-sm mb-4 font-medium">Répartition H/F</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
                    <div className="text-cyan-400 font-bold text-xl">{data.currentSnapshot.pct_hommes.toFixed(0)}%</div>
                    <div className="text-xs text-cyan-300 mt-1">Hommes</div>
                  </div>
                  <div className="text-center p-3 bg-pink-500/10 rounded-xl border border-pink-500/30">
                    <div className="text-pink-400 font-bold text-xl">{data.currentSnapshot.pct_femmes.toFixed(0)}%</div>
                    <div className="text-xs text-pink-300 mt-1">Femmes</div>
                  </div>
                </div>
              </div>

              {/* Age distribution */}
              <div>
                <div className="text-slate-400 text-sm mb-4 font-medium">Pyramide des âges</div>
                <div className="space-y-2">
                  {[
                    { label: '< 25 ans', value: data.currentSnapshot.pct_age_moins_25, color: 'from-green-500 to-green-400' },
                    { label: '25-35 ans', value: data.currentSnapshot.pct_age_25_35, color: 'from-blue-500 to-blue-400' },
                    { label: '35-45 ans', value: data.currentSnapshot.pct_age_35_45, color: 'from-purple-500 to-purple-400' },
                    { label: '45-55 ans', value: data.currentSnapshot.pct_age_45_55, color: 'from-orange-500 to-orange-400' },
                    { label: '> 55 ans', value: data.currentSnapshot.pct_age_plus_55, color: 'from-red-500 to-red-400' }
                  ].filter(age => age.value > 0).map(age => (
                    <div key={age.label} className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 min-w-[70px]">{age.label}</span>
                      <div className="flex-1 mx-3">
                        <div className="w-full bg-slate-800/50 rounded-full h-2">
                          <div 
                            className={`h-full bg-gradient-to-r ${age.color} rounded-full transition-all duration-1000`}
                            style={{ width: `${age.value}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-slate-300 font-medium min-w-[40px] text-right">{age.value.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </NeumorphicCard>

          {/* Absence analysis */}
          <NeumorphicCard className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <Heart size={24} className="text-white" />
              </div>
              <h3 className="text-white font-bold text-xl">Analyse Absences</h3>
            </div>
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-red-500/10 rounded-2xl border border-red-500/30">
                  <div className="text-red-400 font-bold text-2xl">{data.currentSnapshot.nb_jours_maladie}</div>
                  <div className="text-xs text-red-300 mt-1">Jours maladie</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-2xl border border-blue-500/30">
                  <div className="text-blue-400 font-bold text-2xl">{data.currentSnapshot.nb_jours_conges}</div>
                  <div className="text-xs text-blue-300 mt-1">Jours congés</div>
                </div>
              </div>
              
              <div className="text-center p-4 bg-green-500/10 rounded-2xl border border-green-500/30">
                <div className="text-green-400 font-bold text-2xl">{data.currentSnapshot.nb_jours_formation}</div>
                <div className="text-xs text-green-300 mt-1">Jours formation</div>
              </div>

              {/* Detailed metrics */}
              <div className="pt-6 border-t border-slate-700/50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Total absences</span>
                  <span className="text-white font-bold">{data.currentSnapshot.nb_absences_total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Durée moyenne</span>
                  <span className="text-white font-bold">{data.currentSnapshot.duree_moyenne_absence.toFixed(1)}j</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Taux global</span>
                  <span className={`font-bold ${
                    data.currentSnapshot.taux_absenteisme > (data.establishment.seuil_absenteisme || company.seuil_absenteisme_default || 8)
                      ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {data.currentSnapshot.taux_absenteisme.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </NeumorphicCard>
        </div>

        {/* Footer with enhanced info */}
        <div className="flex justify-between items-center p-6 bg-slate-900/30 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>Dernière MAJ: {lastRefresh.toLocaleTimeString('fr-FR')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              <span>Période: {formatPeriodDisplay(selectedPeriod)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={14} />
              <span>Données RGPD conformes</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Database size={14} />
            <span>Analytics V4.0</span>
          </div>
        </div>
      </div>

      {/* Enhanced CSS animations */}
      <style jsx>{`
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(100px, 100px); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(1deg); }
          66% { transform: translateY(10px) rotate(-1deg); }
        }
        
        @keyframes scan {
          0% { transform: translateY(-100vh); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.6), 0 0 60px rgba(139, 92, 246, 0.3); }
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .animate-scan {
          animation: scan 15s linear infinite;
        }
        
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
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