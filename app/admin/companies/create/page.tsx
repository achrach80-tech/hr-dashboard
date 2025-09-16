'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Building2, Search, Filter, Calendar, User, 
  Mail, CreditCard, Activity, MoreVertical,
  Copy, Edit, Trash2, Eye
} from 'lucide-react'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    loadCompanies()
  }, [filterStatus])

  const loadCompanies = async () => {
    setLoading(true)
    let query = supabase
      .from('entreprises')
      .select('*')
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') {
      query = query.eq('subscription_status', filterStatus)
    }

    const { data, error } = await query
    if (data) {
      setCompanies(data)
    }
    setLoading(false)
  }

  const copyAccessToken = (token: string) => {
    navigator.clipboard.writeText(token)
    // Show toast
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg z-50'
    toast.textContent = 'Token copied!'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
  }

  const filteredCompanies = companies.filter(company =>
    company.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.billing_email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusColors: any = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    suspended: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    expired: 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  const planColors: any = {
    trial: 'from-gray-500 to-gray-600',
    starter: 'from-blue-500 to-cyan-500',
    professional: 'from-purple-500 to-pink-500',
    enterprise: 'from-orange-500 to-red-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Companies</h1>
        <p className="text-gray-400">Manage all registered companies and their access</p>
      </div>

      {/* Filters */}
      <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search companies..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid gap-6">
        {filteredCompanies.length === 0 ? (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center">
            <Building2 className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400">No companies found</p>
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <div key={company.id} className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="text-2xl font-bold text-white">{company.nom}</h3>
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${statusColors[company.subscription_status]}`}>
                      {company.subscription_status}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium bg-gradient-to-r ${planColors[company.subscription_plan]} text-white`}>
                      {company.subscription_plan}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-gray-500 text-sm">Code</p>
                      <p className="text-white font-mono">{company.code_entreprise}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Email</p>
                      <p className="text-white">{company.billing_email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Created</p>
                      <p className="text-white">{new Date(company.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Last Login</p>
                      <p className="text-white">
                        {company.last_login_at 
                          ? new Date(company.last_login_at).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                  </div>

                  {company.trial_ends_at && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 inline-block">
                      <p className="text-blue-400 text-sm">
                        Trial ends: {new Date(company.trial_ends_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => copyAccessToken(company.access_token)}
                    className="p-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 transition-all"
                    title="Copy Access Token"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-all"
                    title="View Details"
                  >
                    <Eye size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}