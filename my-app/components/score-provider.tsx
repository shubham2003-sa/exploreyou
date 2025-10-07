"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { fetchScoreSummary, recordScoreEvent, type ScoreEventOptions, type ScoreSummary } from "@/lib/user-score"

interface ScoreContextValue {
  summary: ScoreSummary | null
  loading: boolean
  recordScore: (options: ScoreEventOptions) => Promise<void>
  refresh: () => Promise<void>
}

const ScoreContext = createContext<ScoreContextValue | undefined>(undefined)

export function ScoreProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<ScoreSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialised, setInitialised] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const latest = await fetchScoreSummary(true)
      setSummary(latest)
    } finally {
      setLoading(false)
      setInitialised(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      setLoading(true)
      const latest = await fetchScoreSummary(false)
      if (!cancelled) {
        setSummary(latest)
        setLoading(false)
        setInitialised(true)
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const recordScore = useCallback(async (options: ScoreEventOptions) => {
    if (!initialised) {
      await refresh()
    }
    const next = await recordScoreEvent(options)
    if (next) {
      setSummary(next)
    }
  }, [initialised, refresh])

  const value = useMemo<ScoreContextValue>(() => ({
    summary,
    loading,
    recordScore,
    refresh,
  }), [summary, loading, recordScore, refresh])

  return <ScoreContext.Provider value={value}>{children}</ScoreContext.Provider>
}

export function useScore() {
  const ctx = useContext(ScoreContext)
  return ctx ?? { summary: null, loading: false, recordScore: async () => {}, refresh: async () => {} }
}
