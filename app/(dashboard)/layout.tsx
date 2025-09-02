'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  LayoutDashboard, 
  Users, 
  Upload, 
  Settings, 
  LogOut,
  Menu,
  X,
  Sparkles,
  Building2,
  Calendar
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [hasData, setHasData] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    checkUserAndData()
  }, [])

  const checkUserAndData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)

      // Get company info
      const { data: companyData } = await supabase
        .from('etablissements')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (companyData) {
        setCompany(companyData)
        
        // Check if company has any employees (data uploaded)
        const { count } = await supabase
          .from('employes')
          .select('*', { count: 'exact', head: true })
          .eq('etablissement_id', companyData.id)
        
        const employeeCount = count || 0
        setHasData(employeeCount > 0)
        
        // If no data and trying to access dashboard, redirect to import
        if (employeeCount === 0 && pathname === '/dashboard') {
          router.push('/import')
        }
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigation = [
    { 
      name: 'Tableau de bord', 
      href: '/dashboard', 
      icon: LayoutDashboard,
      disabled: !hasData 
    },
    { 
      name: 'Employés', 
      href: '/employees', 
      icon: Users,
      disabled: !hasData 
    },
    { 
      name: 'Import Excel', 
      href: '/import', 
      icon: Upload,
      disabled: false 
    },
    { 
      name: 'Paramètres', 
      href: '/settings', 
      icon: Settings,
      disabled: false 
    },
  ]

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            border: '4px solid rgba(139, 92, 246, 0.3)',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#9ca3af' }}>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 50,
          padding: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'white',
          cursor: 'pointer',
          display: window.innerWidth >= 1024 ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: isSidebarOpen || window.innerWidth >= 1024 ? 0 : '-280px',
          bottom: 0,
          width: '280px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'left 0.3s ease',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px' }}>
          <Link href="/dashboard" style={{ 
            textDecoration: 'none', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px' 
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
            }}>
              <Sparkles size={24} color="white" />
            </div>
            <span style={{
              fontSize: '24px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              RH Quantum
            </span>
          </Link>
        </div>

        {/* Company info */}
        {company && (
          <div style={{ padding: '0 24px 16px' }}>
            <div style={{
              padding: '12px',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Building2 size={16} color="#a78bfa" />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{company.nom}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  Code: {company.code_entreprise || 'N/A'}
                </span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>•</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {hasData ? 'Données importées' : 'Aucune donnée'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0 16px' }}>
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const isDisabled = item.disabled
            
            return (
              <Link
                key={item.name}
                href={isDisabled ? '#' : item.href}
                onClick={(e) => {
                  if (isDisabled) {
                    e.preventDefault()
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  marginBottom: '4px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: isDisabled ? '#4b5563' : (isActive ? '#ffffff' : '#d1d5db'),
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)'
                    : 'transparent',
                  border: isActive 
                    ? '1px solid rgba(139, 92, 246, 0.3)'
                    : '1px solid transparent',
                  transition: 'all 0.3s ease',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <item.icon size={20} color={isActive ? '#a78bfa' : '#9ca3af'} />
                <span style={{ fontSize: '14px', fontWeight: isActive ? '500' : '400' }}>
                  {item.name}
                </span>
                {isDisabled && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    color: '#9ca3af'
                  }}>
                    Importez d'abord
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div style={{ maxWidth: '120px' }}>
                <p style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </p>
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#9ca3af'
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: window.innerWidth >= 1024 ? '280px' : '0',
        padding: '32px',
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease'
      }}>
        {children}
      </main>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}