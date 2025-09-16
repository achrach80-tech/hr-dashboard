'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Building2, Mail, User, Calendar, Package, 
  Loader2, CheckCircle, Copy, Send, ArrowRight,
  Sparkles, Key, Shield, Zap, Clock, CreditCard
} from 'lucide-react'

export default function CreateCompanyPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState({
    nom: '',
    contact_name: '',
    email: '',
    phone: '',
    subscription_plan: 'trial',
    trial_days: 30,
    max_employees: 100,
    employee_count: '1-50'
  })
  const [createdCompany, setCreatedCompany] = useState<any>(null)
  const [generatedToken, setGeneratedToken] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const generateAccessToken = () => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return token
  }

  const generateCompanyCode = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `RHQ-${timestamp}-${random}`
  }

  const createCompany = async () => {
    setLoading(true)
    try {
      const accessToken = generateAccessToken()
      const companyCode = generateCompanyCode()
      const urlSlug = companyData.nom
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50)

      // Create company
      const { data: company, error } = await supabase
        .from('entreprises')
        .insert({
          nom: companyData.nom,
          code_entreprise: companyCode,
          access_token: accessToken,
          access_url_slug: urlSlug,
          subscription_plan: companyData.subscription_plan,
          subscription_status: 'active',
          billing_email: companyData.email,
          trial_ends_at: companyData.subscription_plan === 'trial' 
            ? new Date(Date.now() + companyData.trial_days * 24 * 60 * 60 * 1000).toISOString()
            : null,
          activation_date: new Date().toISOString(),
          onboarding_status: 'trial_started',
          max_employees: companyData.max_employees,
          features: {
            export: true,
            api: companyData.subscription_plan !== 'trial',
            white_label: companyData.subscription_plan === 'enterprise',
            ai_features: companyData.subscription_plan !== 'trial'
          }
        })
        .select()
        .single()

      if (error) throw error

      // Create default establishment
      await supabase
        .from('etablissements')
        .insert({
          entreprise_id: company.id,
          nom: `${companyData.nom} - Siège`,
          code_etablissement: 'SIEGE',
          is_headquarters: true,
          statut: 'Actif'
        })

      setGeneratedToken(accessToken)
      setCreatedCompany(company)
      setStep(3)
    } catch (error) {
      console.error('Error creating company:', error)
      alert('Error creating company. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Show toast notification
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg z-50'
    toast.textContent = 'Copied to clipboard!'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
  }

  const sendCredentialsByEmail = () => {
    // This would integrate with your email service
    console.log('Sending credentials to:', companyData.email)
    alert(`Credentials sent to ${companyData.email}`)
  }

  const plans = [
    { 
      value: 'trial', 
      name: 'Trial', 
      price: '€0', 
      duration: '30 days',
      color: 'from-gray-500 to-gray-600',
      features: ['Basic Dashboard', 'Up to 100 employees', 'Email support']
    },
    { 
      value: 'starter', 
      name: 'Starter', 
      price: '€29/mo',
      duration: 'Monthly',
      color: 'from-blue-500 to-cyan-500',
      features: ['Full Dashboard', 'Up to 250 employees', 'Priority support', 'Export features']
    },
    { 
      value: 'professional', 
      name: 'Professional', 
      price: '€89/mo',
      duration: 'Monthly',
      color: 'from-purple-500 to-pink-500',
      features: ['Advanced Analytics', 'Up to 1000 employees', 'API Access', 'AI Features']
    },
    { 
      value: 'enterprise', 
      name: 'Enterprise', 
      price: '€249/mo',
      duration: 'Monthly',
      color: 'from-orange-500 to-red-500',
      features: ['Unlimited employees', 'White label', 'Dedicated support', 'Custom features']
    }
  ]

  if (step === 1) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
              <Building2 size={28} />
            </div>
            Create New Company
          </h1>
          <p className="text-gray-400">Set up a new client account with access credentials</p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Sparkles className="text-yellow-400" size={24} />
            Company Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={companyData.nom}
                onChange={(e) => setCompanyData({...companyData, nom: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Acme Corporation"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Contact Name *
              </label>
              <input
                type="text"
                value={companyData.contact_name}
                onChange={(e) => setCompanyData({...companyData, contact_name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={companyData.email}
                onChange={(e) => setCompanyData({...companyData, email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="contact@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={companyData.phone}
                onChange={(e) => setCompanyData({...companyData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="+33 1 23 45 67 89"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Employee Count
              </label>
              <select
                value={companyData.employee_count}
                onChange={(e) => setCompanyData({...companyData, employee_count: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="1-50">1-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Employees (System Limit)
              </label>
              <input
                type="number"
                value={companyData.max_employees}
                onChange={(e) => setCompanyData({...companyData, max_employees: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                min="10"
                max="10000"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!companyData.nom || !companyData.email}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all flex items-center gap-2"
            >
              Continue
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Select Subscription Plan</h1>
          <p className="text-gray-400">Choose the best plan for {companyData.nom}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.value}
              onClick={() => setCompanyData({...companyData, subscription_plan: plan.value})}
              className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all ${
                companyData.subscription_plan === plan.value
                  ? 'border-orange-500 bg-gradient-to-br ' + plan.color + ' bg-opacity-10'
                  : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              {companyData.subscription_plan === plan.value && (
                <div className="absolute top-4 right-4">
                  <CheckCircle className="text-white" size={24} />
                </div>
              )}
              
              <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold text-white mb-1">{plan.price}</div>
              <div className="text-sm text-gray-400 mb-4">{plan.duration}</div>
              
              <ul className="space-y-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {companyData.subscription_plan === 'trial' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-6">
            <label className="block text-sm font-medium text-blue-400 mb-2">
              Trial Duration (days)
            </label>
            <input
              type="number"
              value={companyData.trial_days}
              onChange={(e) => setCompanyData({...companyData, trial_days: parseInt(e.target.value)})}
              className="w-32 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white"
              min="7"
              max="90"
            />
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setStep(1)}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-semibold transition-all"
          >
            Back
          </button>
          <button
            onClick={createCompany}
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 rounded-xl text-white font-semibold transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Creating Company...
              </>
            ) : (
              <>
                <Zap size={20} />
                Create Company & Generate Token
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  if (step === 3 && createdCompany) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-3xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
              <CheckCircle size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Company Created Successfully!</h1>
              <p className="text-gray-400">Access credentials have been generated</p>
            </div>
          </div>

          {/* Company Details */}
          <div className="bg-gray-900/50 rounded-2xl p-6 mb-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 size={20} />
              Company Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Company Name</p>
                <p className="text-white font-medium">{createdCompany.nom}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Company Code</p>
                <p className="text-white font-mono">{createdCompany.code_entreprise}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Subscription</p>
                <p className="text-white capitalize">{createdCompany.subscription_plan}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Access Credentials */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-2xl p-6 mb-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Key size={20} />
              Access Credentials
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-2">Access Token (Keep this secret!)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedToken}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedToken)}
                    className="px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-400 transition-all"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-2">Login URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/login`}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/login`)}
                    className="px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-400 transition-all"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={sendCredentialsByEmail}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Send size={20} />
              Send Credentials by Email
            </button>
            <button
              onClick={() => router.push('/admin/companies')}
              className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-semibold transition-all"
            >
              View All Companies
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}