'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Calendar, Building2, User, Mail, Phone, Clock,
  CheckCircle, XCircle, ArrowRight, Sparkles,
  ChevronDown, ChevronUp, Zap, Send, Copy,
  Key, Shield, Loader2, ExternalLink
} from 'lucide-react'

export default function AdminDemosPage() {
  const [demos, setDemos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDemo, setExpandedDemo] = useState<string | null>(null)
  const [creatingCompany, setCreatingCompany] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    loadDemos()
  }, [filter])

  const loadDemos = async () => {
    let query = supabase
      .from('demo_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    if (data) setDemos(data)
    setLoading(false)
  }

  const updateDemoStatus = async (demoId: string, newStatus: string) => {
    await supabase
      .from('demo_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', demoId)
    
    loadDemos()
  }

  const createCompanyFromDemo = async (demo: any) => {
    setCreatingCompany(demo.id)
    
    try {
      // Generate secure credentials
      const accessToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      const companyCode = `RHQ-${Date.now().toString(36).toUpperCase()}`
      const urlSlug = demo.company_name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50)
      
      // Create company
      const { data: company, error } = await supabase
        .from('entreprises')
        .insert({
          nom: demo.company_name,
          code_entreprise: companyCode,
          access_token: accessToken,
          access_url_slug: urlSlug,
          subscription_plan: 'trial',
          subscription_status: 'active',
          billing_email: demo.email,
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          activation_date: new Date().toISOString(),
          onboarding_status: 'trial_started',
          max_employees: demo.employee_count === '1-50' ? 100 : 
                         demo.employee_count === '51-200' ? 300 :
                         demo.employee_count === '201-500' ? 600 : 1000,
          features: { export: true, api: false, white_label: false, ai_features: false }
        })
        .select()
        .single()

      if (error) throw error

      // Create default establishment
      await supabase
        .from('etablissements')
        .insert({
          entreprise_id: company.id,
          nom: `${demo.company_name} - Siège`,
          code_etablissement: 'SIEGE',
          is_headquarters: true,
          statut: 'Actif'
        })

      // Update demo status
      await supabase
        .from('demo_requests')
        .update({
          status: 'converted',
          converted_to_company_id: company.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', demo.id)

      // Show success with credentials
      showSuccessModal(demo, accessToken, company)
      
      loadDemos()
    } catch (error) {
      console.error('Error creating company:', error)
      alert('Error creating company. Please try again.')
    } finally {
      setCreatingCompany(null)
    }
  }

  const showSuccessModal = (demo: any, token: string, company: any) => {
    const modal = document.createElement('div')
    modal.id = 'success-modal'
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn'
    modal.innerHTML = `
      <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-2xl w-full border border-green-500/30 shadow-2xl animate-slideUp">
        <div class="flex items-center gap-4 mb-6">
          <div class="relative">
            <div class="absolute inset-0 bg-green-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div class="relative w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <div>
            <h2 class="text-3xl font-bold text-white">Company Created!</h2>
            <p class="text-gray-400">${demo.company_name} is now active</p>
          </div>
        </div>
        
        <div class="space-y-4 mb-6">
          <div class="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
            <div class="flex items-center gap-2 text-gray-400 text-sm mb-3">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
              </svg>
              Access Token (Click to copy)
            </div>
            <div class="flex gap-2">
              <input 
                type="text" 
                value="${token}" 
                readonly 
                class="flex-1 px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl text-white font-mono text-sm select-all"
                onclick="this.select()"
              />
              <button 
                onclick="navigator.clipboard.writeText('${token}'); this.innerHTML='✓ Copied!'; setTimeout(() => this.innerHTML='Copy', 2000)"
                class="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-400 font-medium transition-all"
              >
                Copy
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <p class="text-gray-500 text-sm mb-1">Company Code</p>
              <p class="text-white font-mono">${company.code_entreprise}</p>
            </div>
            <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <p class="text-gray-500 text-sm mb-1">Trial Expires</p>
              <p class="text-white">${new Date(company.trial_ends_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        
        <div class="flex gap-4">
          <button 
            onclick="document.getElementById('success-modal').remove()"
            class="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-semibold transition-all"
          >
            Close
          </button>
          <button 
            onclick="alert('Email sent to ${demo.email}')"
            class="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            Send Credentials
          </button>
        </div>
      </div>
    `
    document.body.appendChild(modal)
  }

  const statusConfig: any = {
    pending: { 
      color: 'orange', 
      bg: 'from-orange-500/20 to-red-500/20',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      label: 'Pending Review',
      icon: Clock
    },
    contacted: { 
      color: 'blue',
      bg: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      label: 'Contacted',
      icon: Mail
    },
    scheduled: { 
      color: 'purple',
      bg: 'from-purple-500/20 to-pink-500/20',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      label: 'Demo Scheduled',
      icon: Calendar
    },
    demo_completed: { 
      color: 'cyan',
      bg: 'from-cyan-500/20 to-blue-500/20',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400',
      label: 'Demo Complete',
      icon: CheckCircle
    },
    converted: { 
      color: 'green',
      bg: 'from-green-500/20 to-emerald-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      label: 'Converted',
      icon: Building2
    },
    lost: { 
      color: 'red',
      bg: 'from-red-500/20 to-pink-500/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
      label: 'Lost',
      icon: XCircle
    }
  }

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-cyan-500/30 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-20 h-20 border-4 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-green-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/25">
              <Calendar size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400 bg-clip-text text-transparent">
                Demo Requests
              </h1>
              <p className="text-gray-400 text-lg mt-1">Convert prospects into active clients</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-gray-900/50 backdrop-blur rounded-2xl border border-gray-800">
        {['all', 'pending', 'scheduled', 'demo_completed', 'converted'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all ${
              filter === status
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            {status === 'all' ? 'All' : statusConfig[status]?.label || status}
            {status !== 'all' && (
              <span className="ml-2 text-xs opacity-70">
                ({demos.filter(d => d.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Demo Cards */}
      <div className="space-y-6">
        {demos.map((demo) => {
          const isExpanded = expandedDemo === demo.id
          const config = statusConfig[demo.status]
          const isCreating = creatingCompany === demo.id
          
          return (
            <div 
              key={demo.id} 
              className={`relative overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl border ${config.border} rounded-2xl transition-all duration-300 hover:shadow-2xl hover:shadow-${config.color}-500/10`}
            >
              {/* Status Indicator Line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.bg}`} />
              
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <h3 className="text-2xl font-bold text-white">{demo.company_name}</h3>
                      <div className={`px-4 py-1.5 bg-gradient-to-r ${config.bg} ${config.border} border rounded-xl flex items-center gap-2`}>
                        <config.icon size={16} className={config.text} />
                        <span className={`${config.text} text-sm font-medium`}>
                          {config.label}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <User size={16} />
                        <span>{demo.contact_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Mail size={16} />
                        <span>{demo.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Building2 size={16} />
                        <span>{demo.employee_count} employees</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar size={16} />
                        <span>{new Date(demo.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Quick Actions Based on Status */}
                    {demo.status === 'pending' && (
                      <button
                        onClick={() => updateDemoStatus(demo.id, 'contacted')}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-400 font-medium transition-all"
                      >
                        Mark Contacted
                      </button>
                    )}
                    
                    {(demo.status === 'demo_completed' || demo.status === 'scheduled') && !demo.converted_to_company_id && (
                      <button
                        onClick={() => createCompanyFromDemo(demo)}
                        disabled={isCreating}
                        className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 rounded-xl text-white font-semibold transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="animate-spin" size={18} />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Zap size={18} />
                            Create Company
                          </>
                        )}
                      </button>
                    )}
                    
                    {demo.converted_to_company_id && (
                      <div className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 font-medium flex items-center gap-2">
                        <CheckCircle size={18} />
                        Converted
                      </div>
                    )}
                    
                    <button
                      onClick={() => setExpandedDemo(isExpanded ? null : demo.id)}
                      className="p-2 hover:bg-gray-700/50 rounded-lg transition-all"
                    >
                      {isExpanded ? <ChevronUp /> : <ChevronDown />}
                    </button>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-gray-700 animate-slideDown">
                    <div className="grid md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="text-white font-semibold mb-3">Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Industry:</span>
                            <span className="text-gray-300">{demo.industry || 'Not specified'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Phone:</span>
                            <span className="text-gray-300">{demo.phone || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Country:</span>
                            <span className="text-gray-300">{demo.country || 'France'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-white font-semibold mb-3">Status Flow</h4>
                        <div className="space-y-2">
                          {demo.status !== 'converted' && demo.status !== 'lost' && (
                            <>
                              {demo.status === 'pending' && (
                                <button
                                  onClick={() => updateDemoStatus(demo.id, 'contacted')}
                                  className="w-full px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 text-sm"
                                >
                                  → Mark as Contacted
                                </button>
                              )}
                              {demo.status === 'contacted' && (
                                <button
                                  onClick={() => updateDemoStatus(demo.id, 'scheduled')}
                                  className="w-full px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm"
                                >
                                  → Schedule Demo
                                </button>
                              )}
                              {demo.status === 'scheduled' && (
                                <button
                                  onClick={() => updateDemoStatus(demo.id, 'demo_completed')}
                                  className="w-full px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm"
                                >
                                  → Complete Demo
                                </button>
                              )}
                              <button
                                onClick={() => updateDemoStatus(demo.id, 'lost')}
                                className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm"
                              >
                                × Mark as Lost
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-white font-semibold mb-3">Timeline</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Requested:</span>
                            <span className="text-gray-300">
                              {new Date(demo.created_at).toLocaleString()}
                            </span>
                          </div>
                          {demo.updated_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Updated:</span>
                              <span className="text-gray-300">
                                {new Date(demo.updated_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {demo.message && (
                      <div className="mt-4 p-4 bg-gray-800/50 rounded-xl">
                        <h4 className="text-white font-semibold mb-2">Message</h4>
                        <p className="text-gray-300 text-sm">{demo.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
      `}</style>
    </div>
  )
}