'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Info, Database } from 'lucide-react'

export default function DatabaseDiagnostic() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const runDiagnostics = async () => {
    setLoading(true)
    const diagnostics: any = {}
    
    try {
      // 1. Check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      diagnostics.auth = {
        status: user ? 'success' : 'error',
        message: user ? `Authenticated as ${user.email}` : (userError?.message || 'Not authenticated')
      }
      
      if (!user) {
        setResults(diagnostics)
        setLoading(false)
        return
      }

      // 2. Check etablissements table
      const { data: company, error: companyError } = await supabase
        .from('etablissements')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      diagnostics.company = {
        status: company ? 'success' : 'error',
        message: company ? `Company found: ${company.nom} (ID: ${company.id})` : (companyError?.message || 'No company found'),
        data: company
      }
      
      if (!company) {
        setResults(diagnostics)
        setLoading(false)
        return
      }

      // 3. Check employes table structure
      const { data: sampleEmployee, error: employeeError } = await supabase
        .from('employes')
        .select('*')
        .eq('etablissement_id', company.id)
        .limit(1)
        .maybeSingle()
      
      diagnostics.employeeTable = {
        status: employeeError ? 'error' : 'success',
        message: employeeError ? String(employeeError.message) : 'Table accessible',
        columns: sampleEmployee ? Object.keys(sampleEmployee) : [],
        sampleData: sampleEmployee
      }

      // 4. Test insert operation
      const testEmployee = {
        etablissement_id: company.id,
        matricule: `TEST_${Date.now()}`,
        nom: 'TEST',
        prenom: 'Employee',
        sexe: 'M',
        type_contrat: 'CDI',
        temps_travail: 1.0,
        intitule_poste: 'Test Position',
        salaire_base_mensuel: 3000,
        statut_emploi: 'Actif',
        periode: new Date().toISOString().slice(0, 7) + '-01',
        statut_periode: 'Actif',
        date_entree: new Date().toISOString().split('T')[0]
      }

      const { error: insertError } = await supabase
        .from('employes')
        .insert(testEmployee)
      
      diagnostics.testInsert = {
        status: insertError ? 'error' : 'success',
        message: insertError ? `Insert failed: ${insertError.message}` : 'Insert successful',
        errorCode: insertError ? String(insertError.code) : null,
        errorDetails: insertError ? String(insertError.details || '') : null,
        errorHint: insertError ? String(insertError.hint || '') : null,
        testData: testEmployee
      }

      // 5. If insert succeeded, clean up test data
      if (!insertError) {
        const { error: deleteError } = await supabase
          .from('employes')
          .delete()
          .eq('matricule', testEmployee.matricule)
          .eq('etablissement_id', company.id)
        
        diagnostics.cleanup = {
          status: deleteError ? 'warning' : 'success',
          message: deleteError ? 'Could not clean up test data' : 'Test data cleaned up'
        }
      }

      // 6. Check remunerations table
      const { data: sampleRemuneration, error: remunerationError } = await supabase
        .from('remunerations')
        .select('*')
        .eq('etablissement_id', company.id)
        .limit(1)
        .maybeSingle()
      
      diagnostics.remunerationTable = {
        status: remunerationError ? 'warning' : 'success',
        message: remunerationError ? String(remunerationError.message) : 'Table accessible',
        columns: sampleRemuneration ? Object.keys(sampleRemuneration) : []
      }

      // 7. Check absences table
      const { data: sampleAbsence, error: absenceError } = await supabase
        .from('absences')
        .select('*')
        .eq('etablissement_id', company.id)
        .limit(1)
        .maybeSingle()
      
      diagnostics.absenceTable = {
        status: absenceError ? 'warning' : 'success',
        message: absenceError ? String(absenceError.message) : 'Table accessible',
        columns: sampleAbsence ? Object.keys(sampleAbsence) : []
      }

    } catch (error: any) {
      diagnostics.generalError = {
        status: 'error',
        message: String(error?.message || 'Unknown error occurred')
      }
    }
    
    setResults(diagnostics)
    setLoading(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-green-500/20 bg-green-500/5'
      case 'error':
        return 'border-red-500/20 bg-red-500/5'
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/5'
      default:
        return 'border-blue-500/20 bg-blue-500/5'
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Database Diagnostic Tool
        </h1>
        <p className="text-gray-400">
          Run diagnostics to check your database structure and identify issues
        </p>
      </div>

      <button
        onClick={runDiagnostics}
        disabled={loading}
        className="mb-8 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
      >
        <Database className="w-5 h-5" />
        {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
      </button>

      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([key, value]: [string, any]) => (
            <div
              key={key}
              className={`p-4 rounded-lg border ${getStatusColor(value.status)}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(value.status)}
                <div className="flex-1">
                  <h3 className="font-semibold mb-1 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <p className="text-sm text-gray-300 mb-2">{value.message}</p>
                  
                  {value.columns && value.columns.length > 0 && (
                    <div className="mt-2 p-2 bg-black/20 rounded">
                      <p className="text-xs text-gray-400 mb-1">Table Columns:</p>
                      <p className="text-xs font-mono">{value.columns.join(', ')}</p>
                    </div>
                  )}
                  
                  {value.errorCode && (
                    <div className="mt-2 p-2 bg-black/20 rounded">
                      <p className="text-xs text-gray-400">Error Code: <span className="text-red-400 font-mono">{value.errorCode}</span></p>
                      {value.errorDetails && (
                        <p className="text-xs text-gray-400 mt-1">Details: <span className="text-gray-300">{value.errorDetails}</span></p>
                      )}
                      {value.errorHint && (
                        <p className="text-xs text-gray-400 mt-1">Hint: <span className="text-yellow-400">{value.errorHint}</span></p>
                      )}
                    </div>
                  )}
                  
                  {value.testData && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer">View Test Data</summary>
                      <pre className="mt-2 p-2 bg-black/20 rounded text-xs overflow-x-auto">
                        {JSON.stringify(value.testData, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  {value.sampleData && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer">View Sample Data</summary>
                      <pre className="mt-2 p-2 bg-black/20 rounded text-xs overflow-x-auto">
                        {JSON.stringify(value.sampleData, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {Object.keys(results).length > 0 && (
        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            Common Issues and Solutions
          </h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li><strong>Error Code 23505:</strong> Duplicate key - Employee already exists with same matricule and period</li>
            <li><strong>Error Code 42703:</strong> Column doesn't exist - Check if all columns in your data match the table structure</li>
            <li><strong>Error Code 23503:</strong> Foreign key violation - The etablissement_id doesn't exist</li>
            <li><strong>Missing periode column:</strong> Your table might not have the periode column</li>
            <li><strong>RLS Issues:</strong> Row Level Security policies might be blocking operations</li>
          </ul>
        </div>
      )}
    </div>
  )
}