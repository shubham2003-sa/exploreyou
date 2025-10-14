"use client"

import { useMemo } from "react"

import { useScore } from "@/components/score-provider"

export default function ScoreBar() {
  const { summary, loading } = useScore()

  const display = useMemo(() => {
    if (!summary) return null
    const percent = Number.isFinite(summary.scorePercent) ? Math.round(summary.scorePercent) : 0
    return {
      percent,
      totalPoints: Math.round(summary.totalPoints),
      totalPossible: Math.round(summary.totalPossible),
    }
  }, [summary])

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
      </div>
    </div>
  )
}
