'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Brain, Zap, Shield, BarChart3, Users, TrendingUp, Sparkles, Clock, Euro, Check } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description: "Predictive analytics for turnover risk and satisfaction",
      color: '#8b5cf6'
    },
    {
      icon: Zap,
      title: "Ultra-Fast Performance",
      description: "Dashboard loads in <100ms with snapshot architecture",
      color: '#06b6d4'
    },
    {
      icon: Shield,
      title: "GDPR Compliant",
      description: "Enterprise security with Row Level Security",
      color: '#10b981'
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Live KPIs and comprehensive trend analysis",
      color: '#f59e0b'
    },
    {
      icon: Users,
      title: "Multi-tenant Ready",
      description: "Manage multiple companies with data isolation",
      color: '#ec4899'
    },
    {
      icon: TrendingUp,
      title: "Excel Import",
      description: "Simple data migration from existing systems",
      color: '#6366f1'
    }
  ]

  const stats = [
    { value: '<100ms', label: 'Dashboard Load' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: 'GDPR', label: 'Compliant' },
    { value: '24/7', label: 'Support' }
  ]

  const plans = [
    {
      name: 'Starter',
      price: '29',
      employees: '25',
      features: ['Dashboard temps réel', 'Import Excel', 'Support email']
    },
    {
      name: 'Professional',
      price: '89',
      employees: '100',
      features: ['Tout Starter +', 'Analytics avancés', 'API access', 'Support prioritaire'],
      popular: true
    },
    {
      name: 'Enterprise',
      price: '249',
      employees: 'Illimité',
      features: ['Tout Professional +', 'IA prédictive', 'SSO/SAML', 'Support dédié']
    }
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #000000, #0a0a0a)',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: '-200px',
          left: '-200px',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
          filter: 'blur(100px)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-200px',
          right: '-200px',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          filter: 'blur(100px)'
        }} />
      </div>

      {/* Navigation */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 48px',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)'
          }}>
            <Sparkles size={24} color="white" />
          </div>
          <span style={{
            fontSize: '24px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            RH Quantum
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => router.push('/login')}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            Se connecter
          </button>
          <button
            onClick={() => router.push('/signup')}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)'
            }}
          >
            Commencer
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ position: 'relative', zIndex: 10, padding: '80px 48px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '999px',
            marginBottom: '32px'
          }}>
            <Clock size={16} color="#a78bfa" />
            <span style={{ fontSize: '14px', color: '#a78bfa' }}>Lancement Officiel - Offre Spéciale</span>
          </div>

          {/* Main Title */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 'bold',
            lineHeight: '1.1',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Transformez vos RH avec<br />l'Analytics Quantique
          </h1>

          {/* Description */}
          <p style={{
            fontSize: '20px',
            color: '#9ca3af',
            maxWidth: '700px',
            margin: '0 auto 48px',
            lineHeight: '1.6'
          }}>
            Plateforme RH nouvelle génération qui transforme vos données en insights stratégiques. 
            Analytics temps réel, prédictions IA, et performance enterprise.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
            <button
              onClick={() => router.push('/signup')}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 25px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 25px rgba(139, 92, 246, 0.4)'
              }}
            >
              Essai Gratuit 14 Jours
              <ArrowRight size={20} />
            </button>
            <button
              style={{
                padding: '14px 32px',
                background: 'transparent',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              }}
            >
              Voir la Démo
            </button>
          </div>

          {/* Trust Badges */}
          <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', fontSize: '14px', color: '#6b7280' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} color="#10b981" /> Sans carte bancaire
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} color="#10b981" /> Configuration en 5 minutes
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} color="#10b981" /> Support dédié
            </span>
          </div>
        </div>

        {/* Features Grid */}
        <div style={{
          maxWidth: '1200px',
          margin: '100px auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '24px',
          padding: '0 20px'
        }}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                padding: '32px',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                e.currentTarget.style.borderColor = feature.color + '40'
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = `0 20px 40px ${feature.color}20`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                background: `linear-gradient(135deg, ${feature.color}40 0%, ${feature.color}20 100%)`,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <feature.icon size={28} color={feature.color} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>
                {feature.title}
              </h3>
              <p style={{ color: '#9ca3af', lineHeight: '1.5' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div style={{
          maxWidth: '1000px',
          margin: '80px auto',
          padding: '48px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
          borderRadius: '24px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px'
        }}>
          {stats.map((stat, index) => (
            <div key={index} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '36px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '8px'
              }}>
                {stat.value}
              </div>
              <div style={{ color: '#9ca3af', fontSize: '14px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Pricing Section */}
        <div style={{ maxWidth: '1200px', margin: '80px auto', padding: '0 20px' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '16px'
          }}>
            Tarification Simple et Transparente
          </h2>
          <p style={{
            textAlign: 'center',
            color: '#9ca3af',
            marginBottom: '48px',
            fontSize: '18px'
          }}>
            Choisissez le plan adapté à votre entreprise. Changez à tout moment.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {plans.map((plan, index) => (
              <div
                key={index}
                style={{
                  padding: '32px',
                  background: plan.popular 
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: plan.popular
                    ? '2px solid rgba(139, 92, 246, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '20px',
                  position: 'relative',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(139, 92, 246, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    padding: '4px 16px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    Plus Populaire
                  </div>
                )}

                <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px', textAlign: 'center' }}>
                  {plan.name}
                </h3>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                    <Euro size={24} color="#9ca3af" />
                    <span style={{ fontSize: '48px', fontWeight: 'bold' }}>{plan.price}</span>
                    <span style={{ color: '#9ca3af' }}>/mois</span>
                  </div>
                  <p style={{ color: '#9ca3af', marginTop: '8px' }}>
                    Jusqu'à {plan.employees} employés
                  </p>
                </div>

                <ul style={{ marginBottom: '32px' }}>
                  {plan.features.map((feature, i) => (
                    <li key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      color: '#e5e7eb'
                    }}>
                      <Check size={16} color="#10b981" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => router.push('/signup')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: plan.popular
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)'
                      : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (plan.popular) {
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.4)'
                    } else {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (plan.popular) {
                      e.currentTarget.style.boxShadow = 'none'
                    } else {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  Commencer
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}