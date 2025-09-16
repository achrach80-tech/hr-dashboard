'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Building2,
  RefreshCw, ChevronDown, Heart, AlertTriangle, Activity, Award,
  Calendar, Sparkles, Brain, Upload, Minus, Banknote, CircleDollarSign,
  Bell, Shield, Target, Database, BarChart3, PieChart, Clock,
  CheckCircle2, XCircle, AlertCircle, Gauge, Euro, Percent
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ==========================================
// TYPES
// ==========================================

interface Snapshot {
  id: string
  etablissement_id: string
  periode: string
  
  effectif_fin_mois: number
  effectif_moyen: number
  etp_fin_mois: number
  
  nb_entrees: number
  nb_sorties: number
  taux_turnover: number
  
  nb_cdi: number
  nb_cdd: number
  pct_cdi: number
  pct_precarite: number
  
  age_moyen: number
  anciennete_moyenne_mois: number
  pct_hommes: number
  pct_femmes: number
  
  masse_salariale_brute: number
  cout_total_employeur: number
  salaire_base_moyen: number
  cout_moyen_par_fte: number
  part_variable: number
  taux_charges: number
  
  taux_absenteisme: number
  nb_jours_absence: number
  duree_moyenne_absence: number
  
  alerte_turnover_eleve: boolean
  alerte_absenteisme_eleve: boolean
  
  data_quality_score: number
  calculated_at: string
}

interface Company {
  id: string
  nom: string
  subscription_plan: string
  ai_features_enabled: boolean
  seuil_turnover_default: number
  seuil_absenteisme_default: number
}

interface Establishment {
  id: string
  nom: string
  seuil_turnover?: number
  seuil_absenteisme?: number
}

// ==========================================
// UTILITIES
// ==========================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('fr-FR').format(Math.round(num))
}

const formatPercentage = (num: number): string => {
  return `${num.toFixed(1)}%`
}

const formatPeriodDisplay = (periode: string): string => {
  if (!periode) return ''
  try {
    const date = new Date(periode)
    return date.toLocaleDateString('fr-FR', { 
      month: 'long', 
      year: 'numeric' 
    })
  } catch {
    return periode
  }
}

const calculateEvolution = (current: number, previous: number): number => {
  if (!previous || previous === 0) return 0
  return ((current - previous) / previous) * 100
}

// ==========================================
// KPI CARD COMPONENT
// ==========================================

const KPICard: React.FC<{
  title: string
  value: number
  format: 'currency' | 'percent' | 'number'
  icon: React.ElementType
  color: string
  evolution?: number
  subtitle?: string
  alert?: boolean
}> = ({ title, value, format, icon: Icon, color, evolution, subtitle, alert }) => {
  const formattedValue = 
    format === 'currency' ? formatCurrency(value) :
    format === 'percent' ? formatPercentage(value) :
    formatNumber(value)

  return (
    <div className={`p-6 bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-2xl border ${
      alert ? 'border-red-500/30' : 'border-slate-700/30'
    } backdrop-blur-xl hover:scale-[1.02] transition-all duration-300`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
        
        {evolution !== undefined && evolution !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            evolution > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {evolution > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {Math.abs(evolution).toFixed(1)}%
          </div>
        )}
      </div>
      
      <p className="text-slate-400 text-sm mb-2">{title}</p>
      <p className="text-3xl font-bold text-white mb-1">{formattedValue}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================

export default function OptimizedDashboard() {
  const [company, setCompany] = useState<Company | null>(null)
  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null)
  const [periods, setPeriods] = useState<string[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null)
  const [previousSnapshot, setPreviousSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showPeriodSelector, setShowPeriodSelector] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  // Initialize
  useEffect(() => {
    initializeData()
  }, [])

  const initializeData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get company from session
      const sessionStr = localStorage.getItem('company_session')
      if (!sessionStr) {
        router.push('/login')
        return
      }

      const session = JSON.parse(sessionStr)

      // Fetch company with establishments
      const { data: companyData, error: companyError } = await supabase
        .from('entreprises')
        .select(`*, etablissements (*)`)
        .eq('id', session.company_id)
        .single()

      if (companyError) throw companyError

      setCompany(companyData)
      const ests = companyData.etablissements || []
      setEstablishments(ests)

      // Select first establishment
      const defaultEst = ests.find((e: any) => e.is_headquarters) || ests[0]
      if (defaultEst) {
        setSelectedEstablishment(defaultEst)
        await loadPeriodsForEstablishment(defaultEst.id)
      }
    } catch (err) {
      console.error('Initialize error:', err)
      setError('Erreur d\'initialisation')
    } finally {
      setLoading(false)
    }
  }

  const loadPeriodsForEstablishment = async (establishmentId: string) => {
    try {
      console.log('Loading periods for establishment:', establishmentId)

      // Get available periods from snapshots
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('snapshots_mensuels')
        .select('periode, effectif_fin_mois')
        .eq('etablissement_id', establishmentId)
        .order('periode', { ascending: false })

      if (snapshotsError) throw snapshotsError

      console.log('Available snapshots:', snapshots)

      if (!snapshots || snapshots.length === 0) {
        // No snapshots - check if there's any data
        const { data: employees } = await supabase
          .from('employes')
          .select('periode')
          .eq('etablissement_id', establishmentId)
          .limit(1)

        if (!employees || employees.length === 0) {
          setError('Aucune donnée disponible. Veuillez importer des données.')
          setPeriods([])
          return
        }

        // Data exists but no snapshots - offer to calculate
        setError('Les KPIs doivent être calculés. Utilisez le bouton "Calculer KPIs".')
        setPeriods([])
        return
      }

      const availablePeriods = snapshots.map(s => s.periode)
      setPeriods(availablePeriods)

      // Select most recent period
      if (availablePeriods.length > 0) {
        setSelectedPeriod(availablePeriods[0])
        await loadSnapshotData(establishmentId, availablePeriods[0])
      }
    } catch (err) {
      console.error('Load periods error:', err)
      setError('Erreur lors du chargement des périodes')
    }
  }

  const loadSnapshotData = async (establishmentId: string, period: string) => {
    try {
      console.log('Loading snapshot for:', { establishmentId, period })

      // Normalize period to YYYY-MM-01
      const normalizedPeriod = period.substring(0, 7) + '-01'

      // Get current snapshot
      const { data: current, error: currentError } = await supabase
        .from('snapshots_mensuels')
        .select('*')
        .eq('etablissement_id', establishmentId)
        .eq('periode', normalizedPeriod)
        .single()

      if (currentError) {
        console.error('Snapshot error:', currentError)
        setError('Impossible de charger les données pour cette période')
        return
      }

      setCurrentSnapshot(current)
      console.log('Current snapshot loaded:', current)

      // Get previous month snapshot
      const currentDate = new Date(normalizedPeriod)
      const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      const previousPeriod = previousMonth.toISOString().split('T')[0]

      const { data: previous } = await supabase
        .from('snapshots_mensuels')
        .select('*')
        .eq('etablissement_id', establishmentId)
        .eq('periode', previousPeriod)
        .single()

      setPreviousSnapshot(previous)
    } catch (err) {
      console.error('Load snapshot error:', err)
      setError('Erreur lors du chargement des KPIs')
    }
  }

  // Calculate KPIs manually
  const calculateKPIs = async () => {
    if (!selectedEstablishment || !selectedPeriod) return

    try {
      setRefreshing(true)
      const normalizedPeriod = selectedPeriod.substring(0, 7) + '-01'

      console.log('Manually calculating KPIs for:', normalizedPeriod)

      const { data, error } = await supabase.rpc('calculate_snapshot_for_period', {
        p_etablissement_id: selectedEstablishment.id,
        p_periode: normalizedPeriod,
        p_force: true
      })

      if (error) {
        console.error('KPI calculation error:', error)
        alert(`Erreur: ${error.message}`)
      } else {
        console.log('KPIs calculated successfully')
        await loadSnapshotData(selectedEstablishment.id, selectedPeriod)
      }
    } catch (err) {
      console.error('Calculate KPIs error:', err)
    } finally {
      setRefreshing(false)
    }
  }

  // Handle period change
  const handlePeriodChange = async (period: string) => {
    setSelectedPeriod(period)
    setShowPeriodSelector(false)
    if (selectedEstablishment) {
      await loadSnapshotData(selectedEstablishment.id, period)
    }
  }

  // Calculate evolutions
  const evolutions = useMemo(() => {
    if (!currentSnapshot || !previousSnapshot) return {}

    return {
      effectif: calculateEvolution(currentSnapshot.effectif_fin_mois, previousSnapshot.effectif_fin_mois),
      masse: calculateEvolution(currentSnapshot.masse_salariale_brute, previousSnapshot.masse_salariale_brute),
      turnover: currentSnapshot.taux_turnover - previousSnapshot.taux_turnover,
      absenteisme: currentSnapshot.taux_absenteisme - previousSnapshot.taux_absenteisme
    }
  }, [currentSnapshot, previousSnapshot])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !currentSnapshot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 max-w-lg text-center border border-slate-700/50">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Erreur</h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push('/import')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-xl font-medium"
            >
              Importer des données
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-700 text-white rounded-xl font-medium"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(139, 92, 246, 0.15) 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                <Brain size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Dashboard Analytics</h1>
                <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                  <Building2 size={14} />
                  <span>{company?.nom}</span>
                  <span>•</span>
                  <span>{selectedEstablishment?.nom}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Debug mode toggle */}
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`p-2 rounded-lg transition-colors ${
                  debugMode ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white'
                }`}
                title="Mode debug"
              >
                <Gauge size={20} />
              </button>

              {/* Period selector */}
              <div className="relative">
                <button
                  onClick={() => setShowPeriodSelector(!showPeriodSelector)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <Calendar size={16} className="text-purple-400" />
                  <span className="text-white">{formatPeriodDisplay(selectedPeriod)}</span>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>

                {showPeriodSelector && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      {periods.map(period => (
                        <button
                          key={period}
                          onClick={() => handlePeriodChange(period)}
                          className={`w-full px-4 py-3 text-left hover:bg-slate-800/50 transition-colors ${
                            period === selectedPeriod ? 'bg-purple-500/20 text-purple-400' : 'text-slate-300'
                          }`}
                        >
                          {formatPeriodDisplay(period)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Calculate KPIs button */}
              <button
                onClick={calculateKPIs}
                disabled={refreshing}
                className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
              >
                {refreshing ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  'Calculer KPIs'
                )}
              </button>

              {/* Import button */}
              <button
                onClick={() => router.push('/import')}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug info */}
      {debugMode && (
        <div className="relative z-10 p-4 bg-purple-900/20 border-b border-purple-500/30">
          <div className="text-xs font-mono text-purple-300">
            <p>Establishment ID: {selectedEstablishment?.id}</p>
            <p>Period: {selectedPeriod}</p>
            <p>Snapshot ID: {currentSnapshot?.id}</p>
            <p>Data quality: {currentSnapshot?.data_quality_score}%</p>
            <p>Last calculated: {currentSnapshot?.calculated_at}</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 p-8">
        {currentSnapshot ? (
          <>
            {/* Alerts */}
            {(currentSnapshot.alerte_turnover_eleve || currentSnapshot.alerte_absenteisme_eleve) && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-red-400" />
                  <div>
                    <p className="text-red-400 font-medium">Alertes actives</p>
                    <p className="text-red-300 text-sm">
                      {currentSnapshot.alerte_turnover_eleve && 'Turnover élevé'}
                      {currentSnapshot.alerte_turnover_eleve && currentSnapshot.alerte_absenteisme_eleve && ' • '}
                      {currentSnapshot.alerte_absenteisme_eleve && 'Absentéisme élevé'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              <KPICard
                title="Effectif Total"
                value={currentSnapshot.effectif_fin_mois}
                format="number"
                icon={Users}
                color="bg-gradient-to-r from-purple-500 to-purple-600"
                evolution={evolutions.effectif}
                subtitle={`ETP: ${currentSnapshot.etp_fin_mois.toFixed(1)}`}
              />

              <KPICard
                title="Masse Salariale"
                value={currentSnapshot.masse_salariale_brute}
                format="currency"
                icon={Euro}
                color="bg-gradient-to-r from-cyan-500 to-cyan-600"
                evolution={evolutions.masse}
                subtitle={`Moyen: ${formatCurrency(currentSnapshot.salaire_base_moyen)}`}
              />

              <KPICard
                title="Taux de Turnover"
                value={currentSnapshot.taux_turnover}
                format="percent"
                icon={TrendingUp}
                color={currentSnapshot.alerte_turnover_eleve 
                  ? "bg-gradient-to-r from-red-500 to-red-600"
                  : "bg-gradient-to-r from-green-500 to-green-600"}
                evolution={evolutions.turnover}
                subtitle={`${currentSnapshot.nb_entrees} entrées, ${currentSnapshot.nb_sorties} sorties`}
                alert={currentSnapshot.alerte_turnover_eleve}
              />

              <KPICard
                title="Taux d'Absentéisme"
                value={currentSnapshot.taux_absenteisme}
                format="percent"
                icon={Heart}
                color={currentSnapshot.alerte_absenteisme_eleve
                  ? "bg-gradient-to-r from-orange-500 to-orange-600"
                  : "bg-gradient-to-r from-blue-500 to-blue-600"}
                evolution={evolutions.absenteisme}
                subtitle={`${currentSnapshot.nb_jours_absence} jours`}
                alert={currentSnapshot.alerte_absenteisme_eleve}
              />

              <KPICard
                title="Coût Total"
                value={currentSnapshot.cout_total_employeur}
                format="currency"
                icon={CircleDollarSign}
                color="bg-gradient-to-r from-amber-500 to-amber-600"
                subtitle={`Par ETP: ${formatCurrency(currentSnapshot.cout_moyen_par_fte)}`}
              />

              <KPICard
                title="Taux CDI"
                value={currentSnapshot.pct_cdi}
                format="percent"
                icon={Shield}
                color="bg-gradient-to-r from-emerald-500 to-emerald-600"
                subtitle={`${currentSnapshot.nb_cdi} CDI`}
              />

              <KPICard
                title="Âge Moyen"
                value={currentSnapshot.age_moyen}
                format="number"
                icon={Award}
                color="bg-gradient-to-r from-indigo-500 to-indigo-600"
                subtitle="ans"
              />

              <KPICard
                title="Ancienneté"
                value={currentSnapshot.anciennete_moyenne_mois / 12}
                format="number"
                icon={Clock}
                color="bg-gradient-to-r from-pink-500 to-pink-600"
                subtitle="années en moyenne"
              />
            </div>

            {/* Additional metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Contract distribution */}
              <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/30">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <PieChart size={20} className="text-purple-400" />
                  Répartition Contractuelle
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">CDI</span>
                    <span className="text-white font-medium">{currentSnapshot.nb_cdi}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">CDD</span>
                    <span className="text-white font-medium">{currentSnapshot.nb_cdd}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Précarité</span>
                    <span className="text-white font-medium">{formatPercentage(currentSnapshot.pct_precarite)}</span>
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/30">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <Users size={20} className="text-cyan-400" />
                  Démographie
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Hommes</span>
                    <span className="text-white font-medium">{formatPercentage(currentSnapshot.pct_hommes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Femmes</span>
                    <span className="text-white font-medium">{formatPercentage(currentSnapshot.pct_femmes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Âge moyen</span>
                    <span className="text-white font-medium">{currentSnapshot.age_moyen.toFixed(1)} ans</span>
                  </div>
                </div>
              </div>

              {/* Performance metrics */}
              <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/30">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <BarChart3 size={20} className="text-green-400" />
                  Performance
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Qualité données</span>
                    <span className="text-white font-medium">{currentSnapshot.data_quality_score}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Durée absence moy.</span>
                    <span className="text-white font-medium">{currentSnapshot.duree_moyenne_absence.toFixed(1)}j</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Taux charges</span>
                    <span className="text-white font-medium">{formatPercentage(currentSnapshot.taux_charges)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 p-4 bg-slate-900/30 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <div className="flex items-center gap-6">
                  <span>Dernière mise à jour: {new Date(currentSnapshot.calculated_at).toLocaleDateString('fr-FR')}</span>
                  <span>Période: {formatPeriodDisplay(selectedPeriod)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database size={14} />
                  <span>Dashboard v3.0</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* No data state */
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Upload size={40} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Aucune donnée disponible</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Importez vos fichiers Excel pour commencer à visualiser vos KPIs RH
            </p>
            <button
              onClick={() => router.push('/import')}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-2xl font-bold hover:opacity-90 transition-opacity"
            >
              Importer des données
            </button>
          </div>
        )}
      </div>
    </div>
  )
}