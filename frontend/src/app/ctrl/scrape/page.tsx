'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { adminApi } from '@/lib/adminApi'

const STATUS_STYLES: Record<string, string> = {
  running:   'text-primary bg-primary/10 border-primary/20',
  completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  failed:    'text-red-400 bg-red-400/10 border-red-400/20',
  queued:    'text-amber-400 bg-amber-400/10 border-amber-400/20',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AdminScrapePage() {
  const [jobs, setJobs]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  async function loadJobs() {
    setLoading(true)
    try {
      const data = await adminApi.getScrapeJobs()
      setJobs(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJobs() }, [])

  async function handleTrigger() {
    setTriggering(true)
    setError('')
    setSuccess('')
    try {
      const res = await adminApi.triggerScrape()
      setSuccess(`Scrape job queued — Job ID: ${res.jobId}`)
      await loadJobs()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <AdminShell>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scrape Jobs</h1>
            <p className="text-sm text-muted-foreground mt-1">Trigger and monitor content scraping jobs.</p>
          </div>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background font-semibold text-sm rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(6,214,224,0.2)] disabled:opacity-60"
          >
            {triggering ? (
              <>
                <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                Triggering...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2a10 10 0 1 0 10 10"/><path d="M18 2v4h4"/>
                </svg>
                Trigger Scrape
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {success}
          </div>
        )}

        {/* Jobs list */}
        <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a10 10 0 1 0 10 10"/><path d="M18 2v4h4"/>
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No scrape jobs yet.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Trigger your first scrape above.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {jobs.map(job => (
                <div key={job._id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    job.status === 'running'   ? 'bg-primary animate-pulse' :
                    job.status === 'completed' ? 'bg-emerald-400' :
                    job.status === 'failed'    ? 'bg-red-400' : 'bg-amber-400'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${STATUS_STYLES[job.status] || STATUS_STYLES.queued}`}>
                        {job.status}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{job.site}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/60 font-mono truncate">{job._id}</p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{timeAgo(job.startedAt)}</p>
                    {job.completedAt && (
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        Done {timeAgo(job.completedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={loadJobs}
          disabled={loading}
          className="mt-4 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
          </svg>
          Refresh
        </button>
      </div>
    </AdminShell>
  )
}
