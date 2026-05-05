/**
 * API Diagnostic Component
 * Use this to test API endpoints directly in the browser
 * 
 * Usage:
 * import { ApiDiagnostic } from '@/components/ApiDiagnostic'
 * 
 * <ApiDiagnostic />
 */

import { useState } from 'react'
import { api } from '@/services/api'

interface TestResult {
  endpoint: string
  status: 'loading' | 'success' | 'error'
  statusCode?: number
  data?: unknown
  error?: string
  time?: number
}

export function ApiDiagnostic() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)

  const endpoints = [
    { name: 'Users', fn: () => api.users.getAll({ itemsPerPage: 1 }) },
    { name: 'Products', fn: () => api.products.getAll({ itemsPerPage: 1 }) },
    { name: 'Subscription Plans', fn: () => api.subscriptionPlans.getAll({ itemsPerPage: 1 }) },
    { name: 'Payments', fn: () => api.payments.getAll({ itemsPerPage: 1 }) },
    { name: 'Attendance Records', fn: () => api.attendanceRecords.getAll({ itemsPerPage: 1 }) },
    { name: 'Notifications', fn: () => api.notifications.getAll({ itemsPerPage: 1 }) },
    { name: 'Transactions', fn: () => api.transactions.getAll({ itemsPerPage: 1 }) },
    { name: 'Visit Records', fn: () => api.visitRecords.getAll({ itemsPerPage: 1 }) },
    { name: 'Daily Summary', fn: () => api.dailySummaryRows.getAll({ itemsPerPage: 1 }) },
  ]

  const testAll = async () => {
    setLoading(true)
    setResults([])

    for (const endpoint of endpoints) {
      const startTime = performance.now()
      const result: TestResult = {
        endpoint: endpoint.name,
        status: 'loading',
      }

      try {
        const data = await endpoint.fn()
        const endTime = performance.now()

        result.status = 'success'
        result.statusCode = 200
        result.data = {
          totalItems: data['hydra:totalItems'],
          hasMembers: data['hydra:member']?.length > 0,
        }
        result.time = Math.round(endTime - startTime)
      } catch (error) {
        const endTime = performance.now()
        result.status = 'error'
        result.error = error instanceof Error ? error.message : String(error)
        result.time = Math.round(endTime - startTime)

        // Try to extract status code
        if (result.error.includes('404')) result.statusCode = 404
        else if (result.error.includes('401')) result.statusCode = 401
        else if (result.error.includes('500')) result.statusCode = 500
      }

      setResults((prev) => [...prev, result])
    }

    setLoading(false)
  }

  const testSingle = async (name: string) => {
    const endpoint = endpoints.find((e) => e.name === name)
    if (!endpoint) return

    setResults((prev) =>
      prev.map((r) =>
        r.endpoint === name ? { ...r, status: 'loading' } : r
      )
    )

    const startTime = performance.now()
    const result: TestResult = {
      endpoint: name,
      status: 'loading',
    }

    try {
      const data = await endpoint.fn()
      const endTime = performance.now()

      result.status = 'success'
      result.statusCode = 200
      result.data = {
        totalItems: data['hydra:totalItems'],
        hasMembers: data['hydra:member']?.length > 0,
      }
      result.time = Math.round(endTime - startTime)
    } catch (error) {
      const endTime = performance.now()
      result.status = 'error'
      result.error = error instanceof Error ? error.message : String(error)
      result.time = Math.round(endTime - startTime)
    }

    setResults((prev) => {
      const filtered = prev.filter((r) => r.endpoint !== name)
      return [...filtered, result]
    })
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'loading':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return '✓'
      case 'error':
        return '✗'
      case 'loading':
        return '⏳'
      default:
        return '?'
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🔍 API Platform Diagnostic</h1>
      <p style={{ color: '#666' }}>
        Test all API endpoints to verify connectivity and data availability
      </p>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={testAll}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          {loading ? 'Testing...' : 'Test All Endpoints'}
        </button>
      </div>

      {results.length > 0 && (
        <div>
          <h2>Results ({results.filter((r) => r.status === 'success').length}/{results.length} passed)</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {results.map((result) => (
              <div
                key={result.endpoint}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: result.status === 'success' ? '#f0f9f7' : result.status === 'error' ? '#fef2f2' : '#fffbf0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{result.endpoint}</h3>
                  <span
                    className={getStatusColor(result.status)}
                    style={{
                      fontSize: '20px',
                      fontWeight: 'bold',
                    }}
                  >
                    {getStatusIcon(result.status)}
                  </span>
                </div>

                {result.status === 'success' && result.data && (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <p>✓ Status: 200 OK</p>
                    <p>Total items: {result.data.totalItems}</p>
                    <p>Response time: {result.time}ms</p>
                  </div>
                )}

                {result.status === 'error' && (
                  <div style={{ fontSize: '14px', color: '#d32f2f' }}>
                    <p>✗ Error: {result.error}</p>
                    {result.statusCode && <p>Status Code: {result.statusCode}</p>}
                    <p>Response time: {result.time}ms</p>
                  </div>
                )}

                {result.status === 'loading' && (
                  <div style={{ fontSize: '14px', color: '#ff8f00' }}>
                    <p>⏳ Testing...</p>
                  </div>
                )}

                {result.status !== 'loading' && (
                  <button
                    onClick={() => testSingle(result.endpoint)}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          >
            <h3>Summary</h3>
            <p>✓ Passed: {results.filter((r) => r.status === 'success').length}</p>
            <p>✗ Failed: {results.filter((r) => r.status === 'error').length}</p>

            {results.some((r) => r.status === 'error') && (
              <div style={{ marginTop: '12px', color: '#d32f2f' }}>
                <p>
                  <strong>Troubleshooting:</strong>
                </p>
                <ul>
                  <li>Check that backend is running: cd Backend && symfony serve</li>
                  <li>Verify VITE_API_URL in Frontend/.env includes /api</li>
                  <li>Check browser console (F12) for detailed errors</li>
                  <li>See TROUBLESHOOTING-404.md for more help</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '16px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h3>ℹ️ Information</h3>
        <p>
          <strong>API Base URL:</strong> {import.meta.env.VITE_API_URL || 'https://127.0.0.1:8000/api'}
        </p>
        <p>
          <strong>Environment:</strong> {import.meta.env.MODE}
        </p>
        <p>
          <strong>Check browser console (F12)</strong> for detailed debug information
        </p>
      </div>
    </div>
  )
}
