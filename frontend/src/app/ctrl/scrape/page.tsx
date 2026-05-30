'use client'

import { useEffect, useRef, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { adminApi } from '@/lib/adminApi'

const STATUS_STYLES: Record<string, string> = {
  running:   'text-primary bg-primary/10 border-primary/20',
  completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  failed:    'text-red-400 bg-red-400/10 border-red-400/20',
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

type Action = { key: string; label: string; mediaType: 'movie' | 'tv' }
type Job    = { _id: string; site: string; label: string; status: string; added: number; skipped: number; addedTitles?: string[]; scrapeErrors: string[]; startedAt: string; completedAt?: string }

export default function AdminScrapePage() {
  const [actions, setActions]   = useState<Action[]>([])
  const [jobs, setJobs]         = useState<Job[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [running, setRunning]   = useState<Record<string, boolean>>({})
  const [results, setResults]   = useState<Record<string, { added: number; skipped: number; errors: number; addedTitles: string[] }>>({})
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [error, setError]       = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadJobs() {
    try {
      const data = await adminApi.getScrapeJobs()
      setJobs(data)
      return data as Job[]
    } catch {
      return [] as Job[]
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const [acts, jobData] = await Promise.all([adminApi.getScrapeActions(), adminApi.getScrapeJobs()])
        setActions(acts)
        setJobs(jobData as Job[])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [])

  // Poll while any job is running
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running')
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const fresh = await loadJobs()
        if (!fresh.some((j: Job) => j.status === 'running')) {
          clearInterval(pollRef.current!)
          pollRef.current = null
        }
      }, 3000)
    }
    if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [jobs])

  async function handleRun(key: string) {
    setRunning(r => ({ ...r, [key]: true }))
    setError('')
    try {
      const res = await adminApi.runFetchAction(key)
      setResults(r => ({ ...r, [key]: { added: res.added, skipped: res.skipped, errors: res.errors, addedTitles: res.addedTitles ?? [] } }))
      await loadJobs()
    } catch (e: any) {
      setError(`${key}: ${e.message}`)
    } finally {
      setRunning(r => ({ ...r, [key]: false }))
    }
  }

  // Last completed job per action key
  const lastJob: Record<string, Job> = {}
  for (const job of jobs) {
    if (job.status === 'completed' && !lastJob[job.site]) lastJob[job.site] = job
  }

  const movieActions = actions.filter(a => a.mediaType === 'movie')
  const showActions  = actions.filter(a => a.mediaType === 'tv')

  function ActionCard({ action }: { action: Action }) {
    const isRunning = running[action.key]
    const last = lastJob[action.key]
    const freshResult = results[action.key]

    return (
      <div className="glass rounded-xl border border-white/[0.06] p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{action.label}</p>
          {freshResult ? (
            <div className="mt-0.5">
              <p className="text-xs text-emerald-400">
                +{freshResult.added} added · {freshResult.skipped} skipped{freshResult.errors > 0 ? ` · ${freshResult.errors} errors` : ''}
              </p>
              {freshResult.addedTitles.length > 0 && (
                <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
                  {freshResult.addedTitles.slice(0, 3).join(', ')}{freshResult.addedTitles.length > 3 ? ` +${freshResult.addedTitles.length - 3} more` : ''}
                </p>
              )}
            </div>
          ) : last ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last: +{last.added ?? 0} added · {last.skipped ?? 0} skipped · {timeAgo(last.completedAt || last.startedAt)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 mt-0.5">Never run</p>
          )}
        </div>
        <button
          onClick={() => handleRun(action.key)}
          disabled={isRunning || Object.values(running).some(Boolean)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold rounded-lg hover:bg-primary/20 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isRunning ? (
            <>
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
              Run
            </>
          )}
        </button>
      </div>
    )
  }

  function ActionGroup({ title, icon, list }: { title: string; icon: string; list: Action[] }) {
    const allRunning = list.every(a => running[a.key])
    const anyRunning = Object.values(running).some(Boolean)
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{icon} {title}</h2>
          <button
            onClick={() => { for (const a of list) if (!running[a.key]) handleRun(a.key) }}
            disabled={anyRunning}
            className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Run all
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {list.map(a => <ActionCard key={a.key} action={a} />)}
        </div>
      </div>
    )
  }

  return (
    <AdminShell>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Fetch from TMDB</h1>
          <p className="text-sm text-muted-foreground mt-1">Import movies and shows directly from TMDB into your database.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {loadingInit ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <ActionGroup title="Movies" icon="🎬" list={movieActions} />
            <ActionGroup title="TV Shows" icon="📺" list={showActions} />

            {/* Job History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Jobs</h2>
                <button
                  onClick={loadJobs}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
                  </svg>
                  Refresh
                </button>
              </div>

              <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden">
                {jobs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No jobs yet.</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {jobs.map(job => {
                      const isExpanded = expandedJob === job._id
                      const hasTitles  = (job.addedTitles?.length ?? 0) > 0
                      return (
                        <div key={job._id}>
                          <div
                            className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${hasTitles ? 'cursor-pointer hover:bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                            onClick={() => hasTitles && setExpandedJob(isExpanded ? null : job._id)}
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              job.status === 'running'   ? 'bg-primary animate-pulse' :
                              job.status === 'completed' ? 'bg-emerald-400' : 'bg-red-400'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${STATUS_STYLES[job.status] || STATUS_STYLES.running}`}>
                                  {job.status}
                                </span>
                                <span className="text-sm text-foreground truncate">{job.label || job.site}</span>
                              </div>
                              {job.status === 'completed' && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  +{job.added ?? 0} added · {job.skipped ?? 0} skipped
                                  {(job.scrapeErrors?.length ?? 0) > 0 && (
                                    <span className="text-red-400"> · {job.scrapeErrors[0]}</span>
                                  )}
                                </p>
                              )}
                              {job.status === 'failed' && job.scrapeErrors?.[0] && (
                                <p className="text-xs text-red-400/80 mt-0.5 truncate">{job.scrapeErrors[0]}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-xs text-muted-foreground">{timeAgo(job.startedAt)}</p>
                              {hasTitles && (
                                <svg className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="6,9 12,15 18,9"/>
                                </svg>
                              )}
                            </div>
                          </div>
                          {isExpanded && hasTitles && (
                            <div className="px-5 pb-4 bg-white/[0.015]">
                              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Added titles</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {job.addedTitles!.map((t, i) => (
                                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="w-1 h-1 rounded-full bg-emerald-400/60 flex-shrink-0" />
                                    {t}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
