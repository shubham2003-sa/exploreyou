"use client"

import { useMemo, useState, useCallback } from "react"

import { useScore } from "@/components/score-provider"

export default function ScoreBar() {
  const { summary, loading, refresh } = useScore()
  const [refreshing, setRefreshing] = useState(false)

  const display = useMemo(() => {
    if (!summary) return null
    const percent = Number.isFinite(summary.scorePercent) ? Math.round(summary.scorePercent) : 0
    return {
      percent,
      totalPoints: Math.round(summary.totalPoints),
      totalPossible: Math.round(summary.totalPossible),
    }
  }, [summary])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  if (!loading && !display) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 top-auto z-[10000] flex flex-col items-end"
      style={{ top: "auto" }}
    >
      <div className="pointer-events-auto rounded-xl border border-border bg-background/90 px-4 py-3 shadow-lg backdrop-blur">
        <div className="text-xs font-medium uppercase text-muted-foreground">Overall Score</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold">
            {loading ? "--" : `${display?.percent ?? 0}%`}
          </span>
          {!loading && display ? (
            <span className="text-xs text-muted-foreground">
              {display.totalPoints}/{display.totalPossible}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="mt-2 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh score"}
        </button>
      </div>
    </div>
  )
}
