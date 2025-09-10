'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

export default function DatabaseCleanup() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const supabase = createClient()

  const findDuplicates = async () => {
    setLoading(true)
    const report: any = {}

    try {
      // Get user and company
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: company } = await supabase
        .from('etablissements')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (!company) throw new Error('No company found')

      // Get all employees
      const { data: employees, error } = await supabase
        .from('employes')
        .select('*')
        .eq('etablissement_id', company.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Find duplicates
      const seen = new Map()
      const duplicates: any[] = []
      const toKeep: any[] = []

      employees?.forEach((emp) => {
        const key = `${emp.matricule}-${emp.periode}`
        if (seen.has(key)) {
          duplicates.push(emp)
        } else {
          seen.set(key, emp)
          toKeep.push(emp)
        }
      })

      report.totalEmployees = employees?.length || 0
      report.uniqueEmployees = toKeep.length
      report.duplicates = duplicates
      report.duplicateCount = duplicates.length
      report.company = company

      setResults(report)
    } catch (error: any) {
      setResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const removeDuplicates = async () => {
    if (!results?.duplicates || results.duplicates.length === 0) return

    setLoading(true)
    try {
      // Delete duplicates
      for (const dup of results.duplicates) {
        await supabase
          .from('employes')
          .delete()
          .eq('id', dup.id)
      }

      // Refresh the report
      await findDuplicates()
      alert(`Successfully removed ${results.duplicates.length} duplicate records!`)
    } catch (error: any) {
      alert(`Error removing duplicates: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const removeAllData = async () => {
    if (!confirm('Are you sure you want to remove ALL employee data? This cannot be undone!')) {
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: company } = await supabase
        .from('etablissements')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!company) throw new Error('No company found')

      // Delete all related data
      await supabase
        .from('absences')
        .delete()
        .eq('etablissement_id', company.id)

      await supabase
        .from('remunerations')
        .delete()
        .eq('etablissement_id', company.id)

      await supabase
        .from('employes')
        .delete()
        .eq('etablissement_id', company.id)

      setResults({ message: 'All data has been removed successfully' })
      alert('All employee data has been removed. You can now import fresh data.')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent mb-2">
          Database Cleanup Tool
        </h1>
        <p className="text-gray-400">
          Find and remove duplicate employee records
        </p>
      </div>

      <div className="space-y-4">
        {/* Step 1: Find Duplicates */}
        <div className="p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Step 1: Find Duplicates</h2>
          <button
            onClick={findDuplicates}
            disabled={loading}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Scan for Duplicates
          </button>
        </div>

        {/* Results */}
        {results && !results.error && (
          <div className="p-6 bg-white/5 rounded-lg border border-white/10">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-gray-400 text-sm">Total Records</p>
                <p className="text-2xl font-bold">{results.totalEmployees}</p>
              </div>
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-gray-400 text-sm">Unique Employees</p>
                <p className="text-2xl font-bold text-green-400">{results.uniqueEmployees}</p>
              </div>
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-gray-400 text-sm">Duplicates Found</p>
                <p className="text-2xl font-bold text-orange-400">{results.duplicateCount}</p>
              </div>
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-gray-400 text-sm">Company</p>
                <p className="text-lg">{results.company?.nom}</p>
              </div>
            </div>

            {results.duplicateCount > 0 && (
              <>
                <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-orange-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Found {results.duplicateCount} duplicate records (same matricule + periode)
                  </p>
                </div>

                <button
                  onClick={removeDuplicates}
                  disabled={loading}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  Remove {results.duplicateCount} Duplicates
                </button>
              </>
            )}

            {results.duplicateCount === 0 && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  No duplicates found! Your database is clean.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Nuclear Option */}
        <div className="p-6 bg-red-500/5 rounded-lg border border-red-500/20">
          <h2 className="text-xl font-semibold mb-2 text-red-400">Complete Reset</h2>
          <p className="text-gray-400 text-sm mb-4">
            If you're having too many issues, you can remove all data and start fresh
          </p>
          <button
            onClick={removeAllData}
            disabled={loading}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            Remove All Employee Data
          </button>
        </div>

        {/* Error Display */}
        {results?.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">Error: {results.error}</p>
          </div>
        )}

        {/* Success Message */}
        {results?.message && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400">{results.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}