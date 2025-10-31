"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useScore } from "@/components/score-provider"
import { recordVideoProgressEvent } from "@/lib/video-progress"
import { getTaskScenario } from "@/config/task-scenarios"
import Image from "next/image"
import { Clock } from "lucide-react"

const CONSULTING_OPTION_FALLBACK_LABELS: Record<string, string> = {
  A: "I'll own In-Store Experience",
  B: "I'll lead Supply Chain & Logistics",
  C: "I'll focus on Financials & Store Portfolio",
}

const SCORE_LABELS = ["Score 1", "Score 2", "Score 3", "Score 4"] as const
type ScoreValueState = Record<(typeof SCORE_LABELS)[number], string>
type AnalysisState = "idle" | "running" | "completed"

const createInitialScores = (): ScoreValueState =>
  SCORE_LABELS.reduce<ScoreValueState>((acc, label) => {
    acc[label] = "---"
    return acc
  }, {} as ScoreValueState)

const formatRemaining = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export default function TaskSimulationPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const subject = (params.subject as string) ?? ""
  const option = searchParams.get("option")
  const optionKey = option ? option.toUpperCase() : null
  const optionLabelParam = searchParams.get("label")
  const displayOptionLabel =
    optionLabelParam ??
    (subject === "consulting" && optionKey
      ? CONSULTING_OPTION_FALLBACK_LABELS[optionKey] ?? `Option ${optionKey}`
      : optionKey
        ? `Option ${optionKey}`
        : null)

  const scenario = useMemo(() => getTaskScenario(subject, optionKey), [subject, optionKey])
  const simulationVideoId = `simulation-${subject}`
  const streamTag = displayOptionLabel
    ? `${subject}:${displayOptionLabel}`
    : optionKey
      ? `${subject}:Option${optionKey}`
      : subject

  const totalMinutes = Math.max(1, scenario.timerMinutes)
  const totalSeconds = useMemo(() => Math.max(1, Math.round(totalMinutes * 60)), [totalMinutes])

  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle")
  const [timeLeft, setTimeLeft] = useState<number>(totalSeconds)
  const [scoreValues, setScoreValues] = useState<ScoreValueState>(() => createInitialScores())
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { recordScore } = useScore()

  const completedScoreValues = useMemo(() => {
    if (subject === "consulting") {
      return [82, 76, 71, 88]
    }
    return [78, 74, 72, 80]
  }, [subject])

  useEffect(() => {
    setAnalysisState("idle")
    setTimeLeft(totalSeconds)
    setScoreValues(createInitialScores())
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [scenario.id, totalSeconds])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (analysisState !== "running") return
    setTimeLeft(totalSeconds)
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [analysisState, totalSeconds])

  const sendProgressEvent = useCallback(
    (eventName: string, progress: number, status: "in_progress" | "completed") => {
      const clamped = Math.min(1, Math.max(0, progress))
      const elapsed = totalSeconds - timeLeft
      void recordVideoProgressEvent({
        videoId: simulationVideoId,
        videoUrl: undefined,
        progress: clamped,
        positionSeconds: Math.max(0, elapsed),
        durationSeconds: totalSeconds,
        streamSelected: streamTag,
        taskStatus: status,
        eventName,
      })
    },
    [simulationVideoId, streamTag, timeLeft, totalSeconds],
  )

  const revealScores = useCallback(() => {
    const nextScores = createInitialScores()
    SCORE_LABELS.forEach((label, index) => {
      const value = completedScoreValues[index]
      if (typeof value === "number") {
        nextScores[label] = value.toString()
      }
    })
    setScoreValues(nextScores)
  }, [completedScoreValues])

  const handleBeginAnalysis = () => {
    if (analysisState !== "idle") return
    setAnalysisState("running")
    setScoreValues(createInitialScores())
    sendProgressEvent("analysis_started", 0, "in_progress")

    timeoutRef.current = setTimeout(() => {
      setAnalysisState("completed")
      revealScores()
      sendProgressEvent("analysis_completed", 1, "completed")
      if (scenario.completionScore != null) {
        void recordScore({
          pointsEarned: scenario.completionScore,
          pointsPossible: 100,
          source: `analysis:${subject || "unknown"}:${optionKey ?? "default"}`,
        })
      }
    }, 1200)
  }

  const handleStartNextVideo = () => {
    sendProgressEvent("next_video_started", 1, "completed")
    router.push(`/next-video/${subject}`)
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section className="relative overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0">
            <Image
              src={scenario.heroImageUrl}
              alt="Consulting team reviewing market intelligence"
              fill
              sizes="(min-width: 1024px) 1280px, 100vw"
              className="object-cover"
              priority={false}
            />
            <div className="absolute inset-0 bg-slate-900/70" />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-6 text-white">
              <div className="space-y-2 text-white/70">
                <p className="text-xs font-semibold uppercase tracking-[0.3em]">{scenario.projectName}</p>
                <p className="text-sm font-medium">{scenario.activity}</p>
              </div>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{scenario.heroHeading}</h1>
                <p className="max-w-2xl text-base text-white/80 md:text-lg">{scenario.heroSubheading}</p>
              </div>
            </div>

            <aside className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
              <div className="space-y-4 text-white">
                {scenario.metrics.map((metric) => (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
                      <span>{metric.label}</span>
                      <span className="font-semibold text-white">{metric.value}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/20">
                      <div
                        className={`h-2 rounded-full ${metric.colorClass}`}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
                  <Clock className="h-4 w-4 text-white/80" aria-hidden />
                  {scenario.timerLabel}
                </div>
                <span className="font-mono text-xl">{formatRemaining(timeLeft)}</span>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.8fr),minmax(260px,1fr)]">
          <div className="space-y-6">
            {displayOptionLabel ? (
              <div className="text-sm font-medium text-slate-500">Selected path: {displayOptionLabel}</div>
            ) : null}
            <div className="rounded-3xl border border-indigo-200 bg-indigo-50 px-6 py-5 text-slate-900 shadow-sm">
              <h2 className="text-lg font-semibold text-indigo-900">{scenario.callout.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{scenario.callout.description}</p>
            </div>

            {scenario.sections.map((section) => (
              <section key={section.title} className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                {section.layout === "bullets" ? (
                  <ul className="mt-4 space-y-3 text-sm text-slate-700">
                    {section.items.map((item) => (
                      <li key={`${section.title}-${item.label ?? item.text}`} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 flex-none rounded-full bg-indigo-500" />
                        <span>
                          {item.label ? <span className="font-semibold text-slate-900">{item.label}: </span> : null}
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    {section.items.map((item) => (
                      <p key={`${section.title}-${item.label ?? item.text}`}>
                        {item.label ? <span className="font-semibold text-slate-900">{item.label}: </span> : null}
                        {item.text}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Performance Scores</h3>
              <div className="mt-4 mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-600">{scenario.timerLabel}</span>
                <span className="font-mono text-lg text-slate-900">{formatRemaining(timeLeft)}</span>
              </div>
              <div className="space-y-3">
                {SCORE_LABELS.map((label) => (
                  <div key={label} className="space-y-1">
                    <Label htmlFor={label} className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {label}
                    </Label>
                    <Input
                      id={label}
                      value={scoreValues[label]}
                      readOnly
                      className="h-11 rounded-lg border-slate-200 bg-slate-50 text-base text-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            size="lg"
            className="w-full max-w-md rounded-xl bg-indigo-600 px-8 py-6 text-base font-semibold text-white hover:bg-indigo-500"
            onClick={handleBeginAnalysis}
            disabled={analysisState !== "idle"}
          >
            {analysisState === "completed" ? "Analysis Synced" : analysisState === "running" ? "Analyzing..." : scenario.ctaLabel}
          </Button>
          <Button
            variant="outline"
            className="w-full max-w-md rounded-xl border-slate-300 px-8 py-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={handleStartNextVideo}
          >
            Start Next Video
          </Button>
        </div>
      </main>
    </div>
  )
}
