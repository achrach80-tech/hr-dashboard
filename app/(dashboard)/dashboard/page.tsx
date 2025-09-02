'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  Euro,
  Calendar,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Activity,
  UserMinus,
  UserPlus,
  Clock,
  Target,
  Briefcase,
  Heart,
  Award,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  BarChart3,
  PieChart,
  Building,
  FileText,
  DollarSign,
  Percent,
  UserCheck
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DashboardMetrics {
  // Effectifs & Contrats
  effectif_total: number
  etp_total: number
  effectif_cdi: number
  effectif_cdd: number
  effectif_alternance: number
  effectif_stage: number
  pct_cdi: number
  pct_cdd: number
  
  // Turnover
  turnover_rate: number
  nb_entrees: number
  nb_sorties: number
  effectif_moyen: number
  
  // Démographie
  anciennete_moyenne: number
  age_moyen: number
  nb_hommes: number
  nb_femmes: number
  pct_hommes: number
  pct_femmes: number
  pyramide_ages: {
    moins_30: number
    de_30_39: number
    de_40_49: number
    plus_50: number
  }
  
  // Rémunérations
  masse_salariale_brute: number
  cout_total_employeur: number
  salaire_moyen_brut: number
  cout_moyen_employeur: number
  part_variable: number
  total_primes_variables: number
  
  // Absentéisme
  taux_absenteisme: number
  jours_absence_total: number
  jours_theoriques: number
  duree_moyenne_absence: number
  cout_absenteisme: number
  absences_par_type: {
    type: string
    count: number
    jours: number
  }[]
  
  // Organisation
  effectif_par_site: { site: string, count: number }[]
  effectif_par_cost_center: { center: string, count: number, masse: number }[]
  stock_cp_moyen: number
  stock_rtt_moyen: number
  valeur_cp_rtt_provisionnee: number
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<any>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadDashboardData()
  }, [selectedPeriod])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Get current user and company
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: company } = await supabase
        .from('etablissements')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!company) {
        router.push('/import')
        return
      }

      setCompany(company)

      // Get employees
      const { data: employees } = await supabase
        .from('employes')
        .select('*')
        .eq('etablissement_id', company.id)

      if (!employees || employees.length === 0) {
        router.push('/import')
        return
      }

      // Get remunerations for current month
      const currentDate = new Date()
      const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      
      const { data: remunerations } = await supabase
        .from('remunerations')
        .select('*')
        .eq('etablissement_id', company.id)
        .gte('mois_paie', `${currentMonth}-01`)

      // Get absences
      const { data: absences } = await supabase
        .from('absences')
        .select('*')
        .eq('etablissement_id', company.id)

      // Calculate metrics
      const activeEmployees = employees.filter(e => e.statut_emploi === 'Actif')
      
      // 1. EFFECTIFS & CONTRATS
      const etp_total = activeEmployees.reduce((sum, e) => sum + (e.temps_travail || 1), 0)
      const cdi = activeEmployees.filter(e => e.type_contrat === 'CDI')
      const cdd = activeEmployees.filter(e => e.type_contrat === 'CDD')
      const alternance = activeEmployees.filter(e => e.type_contrat === 'Alternance')
      const stage = activeEmployees.filter(e => e.type_contrat === 'Stage')
      
      // 2. TURNOVER (sur 3 mois, annualisé)
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      
      const entrees = employees.filter(e => {
        const dateEntree = new Date(e.date_entree)
        return dateEntree >= threeMonthsAgo
      })
      
      const sorties = employees.filter(e => {
        if (!e.date_sortie) return false
        const dateSortie = new Date(e.date_sortie)
        return dateSortie >= threeMonthsAgo
      })
      
      const effectif_moyen = (activeEmployees.length + (activeEmployees.length - sorties.length + entrees.length)) / 2
      const turnover_rate = effectif_moyen > 0 ? ((sorties.length / effectif_moyen) * 4 * 100) : 0 // Annualisé
      
      // 3. DÉMOGRAPHIE
      const hommes = activeEmployees.filter(e => e.sexe === 'M')
      const femmes = activeEmployees.filter(e => e.sexe === 'F')
      
      const age_moyen = activeEmployees.reduce((sum, e) => {
        if (e.date_naissance) {
          const age = new Date().getFullYear() - new Date(e.date_naissance).getFullYear()
          return sum + age
        }
        return sum + 30 // Default age
      }, 0) / activeEmployees.length
      
      const anciennete_moyenne = activeEmployees.reduce((sum, e) => {
        const dateEntree = new Date(e.date_entree)
        const years = (new Date().getTime() - dateEntree.getTime()) / (1000 * 60 * 60 * 24 * 365)
        return sum + years
      }, 0) / activeEmployees.length
      
      // Pyramide des âges
      const pyramide_ages = {
        moins_30: activeEmployees.filter(e => {
          if (!e.date_naissance) return false
          const age = new Date().getFullYear() - new Date(e.date_naissance).getFullYear()
          return age < 30
        }).length,
        de_30_39: activeEmployees.filter(e => {
          if (!e.date_naissance) return false
          const age = new Date().getFullYear() - new Date(e.date_naissance).getFullYear()
          return age >= 30 && age < 40
        }).length,
        de_40_49: activeEmployees.filter(e => {
          if (!e.date_naissance) return false
          const age = new Date().getFullYear() - new Date(e.date_naissance).getFullYear()
          return age >= 40 && age < 50
        }).length,
        plus_50: activeEmployees.filter(e => {
          if (!e.date_naissance) return false
          const age = new Date().getFullYear() - new Date(e.date_naissance).getFullYear()
          return age >= 50
        }).length
      }
      
      // 4. RÉMUNÉRATIONS
      let masse_salariale_brute = 0
      let cout_total_employeur = 0
      let total_primes_variables = 0
      let stock_cp_total = 0
      let stock_rtt_total = 0
      let valeur_cp_rtt = 0
      
      if (remunerations && remunerations.length > 0) {
        remunerations.forEach(r => {
          masse_salariale_brute += (r.salaire_de_base || 0) + (r.primes_fixes || 0) + 
                                   (r.primes_variables || 0) + (r.heures_supp_payees || 0) + 
                                   (r.avantages_nature || 0) + (r.autres_elements_bruts || 0)
          
          cout_total_employeur += masse_salariale_brute + (r.cotisations_sociales || 0) + 
                                  (r.taxes_sur_salaire || 0) + (r.mutuelle_employeur || 0) + 
                                  (r.prevoyance_employeur || 0)
          
          total_primes_variables += r.primes_variables || 0
          stock_cp_total += r.stock_cp_jours || 0
          stock_rtt_total += r.stock_rtt_jours || 0
          valeur_cp_rtt += (r.valeur_cp_provisionnee || 0) + (r.valeur_rtt_provisionnee || 0)
        })
      } else {
        // Utiliser les salaires de base des employés si pas de données de rémunération
        masse_salariale_brute = activeEmployees.reduce((sum, e) => sum + (e.salaire_base_mensuel || 0), 0)
        cout_total_employeur = masse_salariale_brute * 1.45 // Estimation charges patronales à 45%
      }
      
      const salaire_moyen_brut = etp_total > 0 ? masse_salariale_brute / etp_total : 0
      const cout_moyen_employeur = etp_total > 0 ? cout_total_employeur / etp_total : 0
      const part_variable = masse_salariale_brute > 0 ? (total_primes_variables / masse_salariale_brute) * 100 : 0
      
      // 5. ABSENTÉISME
      const jours_theoriques = activeEmployees.length * 22 // 22 jours ouvrés par mois
      let jours_absence_total = 0
      const absences_par_type: any = {}
      
      if (absences && absences.length > 0) {
        absences.forEach(a => {
          const jours = a.nb_jours_ouvres || 0
          jours_absence_total += jours
          
          if (!absences_par_type[a.type_absence]) {
            absences_par_type[a.type_absence] = { type: a.type_absence, count: 0, jours: 0 }
          }
          absences_par_type[a.type_absence].count++
          absences_par_type[a.type_absence].jours += jours
        })
      }
      
      const taux_absenteisme = jours_theoriques > 0 ? (jours_absence_total / jours_theoriques) * 100 : 0
      const duree_moyenne_absence = absences && absences.length > 0 ? jours_absence_total / absences.length : 0
      const cout_jour_moyen = cout_total_employeur / (etp_total * 22)
      const cout_absenteisme = jours_absence_total * cout_jour_moyen
      
      // 6. ORGANISATION
      const effectif_par_site: any = {}
      const effectif_par_cost_center: any = {}
      
      activeEmployees.forEach(e => {
        // Par site
        const site = e.code_site || 'Non défini'
        if (!effectif_par_site[site]) {
          effectif_par_site[site] = 0
        }
        effectif_par_site[site]++
        
        // Par cost center
        const center = e.code_cost_center || 'Non défini'
        if (!effectif_par_cost_center[center]) {
          effectif_par_cost_center[center] = { count: 0, masse: 0 }
        }
        effectif_par_cost_center[center].count++
        effectif_par_cost_center[center].masse += e.salaire_base_mensuel || 0
      })
      
      // Set all metrics
      setMetrics({
        // Effectifs
        effectif_total: activeEmployees.length,
        etp_total: Math.round(etp_total * 10) / 10,
        effectif_cdi: cdi.length,
        effectif_cdd: cdd.length,
        effectif_alternance: alternance.length,
        effectif_stage: stage.length,
        pct_cdi: activeEmployees.length > 0 ? (cdi.length / activeEmployees.length) * 100 : 0,
        pct_cdd: activeEmployees.length > 0 ? (cdd.length / activeEmployees.length) * 100 : 0,
        
        // Turnover
        turnover_rate,
        nb_entrees: entrees.length,
        nb_sorties: sorties.length,
        effectif_moyen,
        
        // Démographie
        anciennete_moyenne,
        age_moyen,
        nb_hommes: hommes.length,
        nb_femmes: femmes.length,
        pct_hommes: activeEmployees.length > 0 ? (hommes.length / activeEmployees.length) * 100 : 0,
        pct_femmes: activeEmployees.length > 0 ? (femmes.length / activeEmployees.length) * 100 : 0,
        pyramide_ages,
        
        // Rémunérations
        masse_salariale_brute,
        cout_total_employeur,
        salaire_moyen_brut,
        cout_moyen_employeur,
        part_variable,
        total_primes_variables,
        
        // Absentéisme
        taux_absenteisme,
        jours_absence_total,
        jours_theoriques,
        duree_moyenne_absence,
        cout_absenteisme,
        absences_par_type: Object.values(absences_par_type),
        
        // Organisation
        effectif_par_site: Object.entries(effectif_par_site).map(([site, count]) => ({ site, count: count as number })),
        effectif_par_cost_center: Object.entries(effectif_par_cost_center).map(([center, data]: any) => ({ 
          center, 
          count: data.count, 
          masse: data.masse 
        })),
        stock_cp_moyen: remunerations && remunerations.length > 0 ? stock_cp_total / remunerations.length : 0,
        stock_rtt_moyen: remunerations && remunerations.length > 0 ? stock_rtt_total / remunerations.length : 0,
        valeur_cp_rtt_provisionnee: valeur_cp_rtt
      })

    } catch (error) {
      console.error('Dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '3px solid rgba(139, 92, 246, 0.2)',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px'
          }} />
          <p style={{ color: '#9ca3af', fontSize: '18px' }}>
            Calcul des KPIs RH en cours...
          </p>
        </div>
      </div>
    )
  }

  if (!metrics) return null

  // Top 10 KPIs prioritaires
  const topKPIs = [
    {
      title: 'Effectif (ETP)',
      value: metrics.etp_total.toFixed(1),
      subtitle: `${metrics.effectif_total} personnes`,
      icon: Users,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      trend: metrics.nb_entrees - metrics.nb_sorties,
      alert: false
    },
    {
      title: 'Répartition CDI/CDD',
      value: `${metrics.pct_cdi.toFixed(0)}%`,
      subtitle: `${metrics.effectif_cdi} CDI / ${metrics.effectif_cdd} CDD`,
      icon: Briefcase,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      trend: 0,
      alert: metrics.pct_cdd > 30
    },
    {
      title: 'Turnover',
      value: `${metrics.turnover_rate.toFixed(1)}%`,
      subtitle: `${metrics.nb_entrees} entrées, ${metrics.nb_sorties} sorties`,
      icon: metrics.turnover_rate > 10 ? TrendingUp : TrendingDown,
      gradient: metrics.turnover_rate > 15 
        ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        : 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      trend: metrics.turnover_rate > 10 ? 1 : -1,
      alert: metrics.turnover_rate > 15
    },
    {
      title: 'Parité H/F',
      value: `${metrics.pct_hommes.toFixed(0)}/${metrics.pct_femmes.toFixed(0)}`,
      subtitle: `${metrics.nb_hommes} hommes, ${metrics.nb_femmes} femmes`,
      icon: UserCheck,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      trend: 0,
      alert: Math.abs(metrics.pct_hommes - 50) > 20
    }
  ]

  const financialKPIs = [
    {
      label: 'Masse Salariale Brute',
      value: (metrics.masse_salariale_brute / 1000).toFixed(0),
      unit: 'K€',
      icon: Euro,
      color: '#8b5cf6'
    },
    {
      label: 'Coût Total Employeur',
      value: (metrics.cout_total_employeur / 1000).toFixed(0),
      unit: 'K€',
      icon: DollarSign,
      color: '#06b6d4'
    },
    {
      label: 'Salaire Moyen',
      value: (metrics.salaire_moyen_brut / 1000).toFixed(1),
      unit: 'K€/ETP',
      icon: Euro,
      color: '#10b981'
    },
    {
      label: 'Part Variable',
      value: metrics.part_variable.toFixed(1),
      unit: '%',
      icon: Percent,
      color: '#f59e0b'
    }
  ]

  const demographicKPIs = [
    {
      label: 'Âge Moyen',
      value: metrics.age_moyen.toFixed(1),
      unit: 'ans',
      icon: Calendar,
      color: '#8b5cf6'
    },
    {
      label: 'Ancienneté',
      value: metrics.anciennete_moyenne.toFixed(1),
      unit: 'ans',
      icon: Award,
      color: '#06b6d4'
    }
  ]

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontSize: '42px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px'
            }}>
              Tableau de Bord RH
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building size={16} color="#9ca3af" />
              <p style={{ color: '#e5e7eb', fontSize: '16px' }}>
                {company?.nom}
              </p>
              <span style={{ color: '#6b7280' }}>•</span>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                Période: {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 Priority KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {topKPIs.map((kpi, index) => (
          <div
            key={index}
            style={{
              padding: '24px',
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-30%',
              width: '200px',
              height: '200px',
              background: kpi.gradient,
              opacity: 0.1,
              borderRadius: '50%',
              filter: 'blur(60px)'
            }} />
            
            {kpi.alert && (
              <AlertCircle size={16} color="#f59e0b" style={{
                position: 'absolute',
                top: '16px',
                right: '16px'
              }} />
            )}
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: kpi.gradient,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <kpi.icon size={24} color="white" />
              </div>
              
              <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '4px' }}>
                {kpi.title}
              </p>
              
              <p style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>
                {kpi.value}
              </p>
              
              <p style={{ color: '#6b7280', fontSize: '13px' }}>
                {kpi.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Metrics */}
      <div style={{
        marginBottom: '32px',
        padding: '24px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Euro size={20} color="#9ca3af" />
          Rémunérations
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          {financialKPIs.map((metric, index) => (
            <div key={index} style={{
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: `${metric.color}20`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <metric.icon size={18} color={metric.color} />
                </div>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '2px' }}>
                    {metric.label}
                  </p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {metric.value}
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '4px' }}>
                      {metric.unit}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Absenteeism Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Absenteeism Rate */}
        <div style={{
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={20} color="#ef4444" />
            Absentéisme
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px' }}>
              Taux d'absentéisme global
            </p>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: metrics.taux_absenteisme > 5 ? '#ef4444' : '#10b981' }}>
              {metrics.taux_absenteisme.toFixed(1)}%
            </p>
            <p style={{ color: '#6b7280', fontSize: '13px' }}>
              {metrics.jours_absence_total} jours / {metrics.jours_theoriques} jours théoriques
            </p>
          </div>
          
          <div style={{
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <p style={{ fontSize: '14px', color: '#fca5a5', marginBottom: '4px' }}>
              Coût estimé
            </p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
              {(metrics.cout_absenteisme / 1000).toFixed(0)} K€
            </p>
          </div>
        </div>

        {/* Age Pyramid */}
        <div style={{
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} color="#9ca3af" />
            Pyramide des Âges
          </h3>
          
          {Object.entries({
            '< 30 ans': metrics.pyramide_ages.moins_30,
            '30-39 ans': metrics.pyramide_ages.de_30_39,
            '40-49 ans': metrics.pyramide_ages.de_40_49,
            '50+ ans': metrics.pyramide_ages.plus_50
          }).map(([label, count]) => (
            <div key={label} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>{count}</span>
              </div>
              <div style={{
                height: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${metrics.effectif_total > 0 ? (count / metrics.effectif_total) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)',
                  borderRadius: '4px',
                  transition: 'width 1s ease'
                }} />
              </div>
            </div>
          ))}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
            {demographicKPIs.map((metric, index) => (
              <div key={index} style={{
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>
                  {metric.label}
                </p>
                <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {metric.value}
                  <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '2px' }}>
                    {metric.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CP/RTT Provisions */}
        <div style={{
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#9ca3af" />
            Provisions CP/RTT
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#9ca3af' }}>Stock CP moyen</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {metrics.stock_cp_moyen.toFixed(1)} jours
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#9ca3af' }}>Stock RTT moyen</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {metrics.stock_rtt_moyen.toFixed(1)} jours
              </span>
            </div>
          </div>
          
          <div style={{
            padding: '12px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <p style={{ fontSize: '14px', color: '#fcd34d', marginBottom: '4px' }}>
              Valeur provisionnée
            </p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
              {(metrics.valeur_cp_rtt_provisionnee / 1000).toFixed(0)} K€
            </p>
          </div>
        </div>
      </div>

      {/* Organization by Site and Cost Centers */}
      {(metrics.effectif_par_site.length > 1 || metrics.effectif_par_cost_center.length > 1) && (
        <div style={{
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '32px'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={20} color="#9ca3af" />
            Organisation
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* Par Site */}
            {metrics.effectif_par_site.length > 1 && (
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '16px', color: '#e5e7eb' }}>
                  Répartition par Site
                </h4>
                {metrics.effectif_par_site
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map((site, index) => (
                    <div key={index} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#9ca3af' }}>{site.site}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>{site.count} employés</span>
                      </div>
                      <div style={{
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(site.count / metrics.effectif_total) * 100}%`,
                          background: 'linear-gradient(90deg, #06b6d4 0%, #22d3ee 100%)',
                          borderRadius: '3px'
                        }} />
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            {/* Par Cost Center */}
            {metrics.effectif_par_cost_center.length > 1 && (
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '16px', color: '#e5e7eb' }}>
                  Top 5 Cost Centers (par masse salariale)
                </h4>
                {metrics.effectif_par_cost_center
                  .sort((a, b) => b.masse - a.masse)
                  .slice(0, 5)
                  .map((center, index) => (
                    <div key={index} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#9ca3af' }}>{center.center}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>
                          {(center.masse / 1000).toFixed(0)} K€
                        </span>
                      </div>
                      <div style={{
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${metrics.masse_salariale_brute > 0 ? (center.masse / metrics.masse_salariale_brute) * 100 : 0}%`,
                          background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                          borderRadius: '3px'
                        }} />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alert Summary */}
      {(metrics.turnover_rate > 15 || metrics.taux_absenteisme > 5 || Math.abs(metrics.pct_hommes - 50) > 20) && (
        <div style={{
          padding: '20px',
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '16px',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertTriangle size={24} color="#f59e0b" />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f59e0b' }}>
              Points d'attention RH
            </h3>
          </div>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {metrics.turnover_rate > 15 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#ef4444',
                  borderRadius: '50%',
                  marginTop: '6px'
                }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Turnover élevé ({metrics.turnover_rate.toFixed(1)}%)
                  </p>
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Risque de perte de compétences. Recommandation: Analyser les causes de départ et améliorer la rétention.
                  </p>
                </div>
              </div>
            )}
            
            {metrics.taux_absenteisme > 5 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#f59e0b',
                  borderRadius: '50%',
                  marginTop: '6px'
                }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Absentéisme préoccupant ({metrics.taux_absenteisme.toFixed(1)}%)
                  </p>
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Impact sur la productivité. Coût estimé: {(metrics.cout_absenteisme / 1000).toFixed(0)} K€/mois.
                  </p>
                </div>
              </div>
            )}
            
            {Math.abs(metrics.pct_hommes - 50) > 20 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#3b82f6',
                  borderRadius: '50%',
                  marginTop: '6px'
                }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Déséquilibre de parité ({metrics.pct_hommes.toFixed(0)}% hommes)
                  </p>
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                    Attention à l'index égalité professionnelle. Actions correctives recommandées.
                  </p>
                </div>
              </div>
            )}
          </div>
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