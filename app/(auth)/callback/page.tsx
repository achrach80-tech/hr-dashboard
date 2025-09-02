'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check URL params for errors
        const urlParams = new URLSearchParams(window.location.search)
        const error = urlParams.get('error')
        const errorCode = urlParams.get('error_code')
        const errorDescription = urlParams.get('error_description')

        if (error || errorCode === 'otp_expired') {
          setStatus('expired')
          setMessage(errorDescription || 'Le lien de vérification a expiré')
          return
        }

        // Get the current user after email verification
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          // Try to refresh the session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (!session || sessionError) {
            throw new Error('Session non trouvée. Veuillez vous reconnecter.')
          }
        }

        // Re-fetch user after session check
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        
        if (!currentUser) {
          throw new Error('Utilisateur non trouvé')
        }

        // Check if company already exists
        const { data: existingCompany } = await supabase
          .from('etablissements')
          .select('*')
          .eq('user_id', currentUser.id)
          .single()

        if (existingCompany) {
          // Company exists, redirect to dashboard
          setStatus('success')
          setMessage('Connexion réussie!')
          setTimeout(() => router.push('/dashboard'), 1500)
          return
        }

        // Create company from stored data or defaults
        const pendingCompanyStr = localStorage.getItem('pending_company')
        let companyData = null

        if (pendingCompanyStr) {
          try {
            companyData = JSON.parse(pendingCompanyStr)
          } catch (e) {
            console.error('Error parsing pending company:', e)
          }
        }

        // Use metadata or defaults if no localStorage data
        if (!companyData) {
          companyData = {
            nom: currentUser.user_metadata?.company_name || 'Mon Entreprise',
            code_entreprise: currentUser.user_metadata?.company_code || `ENT${Date.now()}`,
            siret: currentUser.user_metadata?.siret || null
          }
        }

        // Create the company
        const { error: companyError } = await supabase
          .from('etablissements')
          .insert({
            nom: companyData.nom,
            code_entreprise: companyData.code_entreprise,
            siret: companyData.siret,
            user_id: currentUser.id,
            effectif_total: 0,
            subscription_plan: 'starter',
            subscription_status: 'active',
            ai_features_enabled: false
          })

        if (companyError) {
          console.error('Company creation error:', companyError)
          // Don't throw - company might already exist
        }

        // Clear localStorage
        localStorage.removeItem('pending_company')

        setStatus('success')
        setMessage('Email vérifié et compte créé avec succès!')
        
        // Redirect to import page
        setTimeout(() => {
          router.push('/import')
        }, 1500)

      } catch (error: any) {
        console.error('Callback error:', error)
        setStatus('error')
        setMessage(error.message || 'Une erreur est survenue')
      }
    }

    handleCallback()
  }, [router, supabase])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '48px 40px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 32px',
          boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)'
        }}>
          <Sparkles size={32} color="white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 
              size={48} 
              color="#8b5cf6" 
              style={{ 
                margin: '0 auto 24px',
                animation: 'spin 1s linear infinite'
              }} 
            />
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '12px', color: 'white' }}>
              Vérification en cours...
            </h2>
            <p style={{ color: '#9ca3af' }}>
              Validation de votre email et création de votre compte
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 
              size={48} 
              color="#10b981" 
              style={{ margin: '0 auto 24px' }} 
            />
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '12px', color: 'white' }}>
              Compte activé avec succès!
            </h2>
            <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
              {message}
            </p>
            <p style={{ color: '#a78bfa' }}>
              Redirection vers l'application...
            </p>
          </>
        )}

        {status === 'expired' && (
          <>
            <AlertCircle 
              size={48} 
              color="#f59e0b" 
              style={{ margin: '0 auto 24px' }} 
            />
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '12px', color: 'white' }}>
              Lien expiré
            </h2>
            <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
              {message}
            </p>
            <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
              Les liens de vérification expirent après 24 heures pour votre sécurité.
            </p>
            <Link 
              href="/signup"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                borderRadius: '10px',
                color: 'white',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
              }}
            >
              Créer un nouveau compte
            </Link>
            <p style={{ marginTop: '16px' }}>
              <Link 
                href="/login"
                style={{
                  color: '#9ca3af',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}
              >
                Ou connectez-vous à un compte existant
              </Link>
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle 
              size={48} 
              color="#ef4444" 
              style={{ margin: '0 auto 24px' }} 
            />
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '12px', color: 'white' }}>
              Erreur de vérification
            </h2>
            <p style={{ color: '#ef4444', marginBottom: '24px' }}>
              {message}
            </p>
            <Link 
              href="/login"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: 'white',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: '500'
              }}
            >
              Retour à la connexion
            </Link>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}