"use client"

import { Button } from "@/components/ui/button"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Header from "@/components/header"
import { useScore } from "@/components/score-provider"
import { recordVideoProgressEvent } from "@/lib/video-progress"
import { getTaskScenario, type AnalysisScoreDefinition } from "@/config/task-scenarios"
import { CheckCircle2, Clock } from "lucide-react"
import Image from "next/image"

const CONSULTING_OPTION_FALLBACK_LABELS: Record<string, string> = {
  A: "I am okay but feeling a bit nervous!",
  B: "Review Market Intelligence",
  C: "Take a Nap",
}

type ScoreState = Record<string, number | null>

const formatTime = (secs: number | null, defaultMinutes = 5) => {
  const defaultSeconds = Math.max(1, defaultMinutes * 60)
  const value = typeof secs === "number" ? Math.max(0, secs) : defaultSeconds
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

const createInitialScoreState = (scores: AnalysisScoreDefinition[]): ScoreState => {
  return scores.reduce<ScoreState>((acc, score) => {
    acc[score.label] = null
    return acc
  }, {})
}

export default function TaskSimulationPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
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
  const scenarioKey = `${scenario.id}:${subject}:${displayOptionLabel ?? "base"}`
  const simulationVideoId = `simulation-${subject}`
  const streamTag = displayOptionLabel
    ? `${subject}:${displayOptionLabel}`
    : optionKey
      ? `${subject}:Option${optionKey}`
      : subject

  const totalSeconds = Math.max(1, scenario.timerMinutes * 60)
  const initialScores = useMemo(() => createInitialScoreState(scenario.analysisScores), [scenario.analysisScores])

  const [scoreValues, setScoreValues] = useState<ScoreState>(initialScores)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(totalSeconds)

  const { recordScore } = useScore()
  const timeLeftRef = useRef(totalSeconds)
  const completionLoggedRef = useRef(false)

  useEffect(() => {
    setScoreValues(initialScores)
    setIsAnalyzing(false)
    setAnalysisComplete(false)
    setTimeLeft(totalSeconds)
    timeLeftRef.current = totalSeconds
    completionLoggedRef.current = false
  }, [initialScores, totalSeconds, scenarioKey])

  useEffect(() => {
    timeLeftRef.current = timeLeft
    if (timeLeft <= 0) return
    const timer = window.setTimeout(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0
        return prev - 1
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [timeLeft])

  const revealScenarioScores = useCallback(() => {
    setScoreValues(
      scenario.analysisScores.reduce<ScoreState>((acc, score) => {
        acc[score.label] = score.value
        return acc
      }, {}),
    )
  }, [scenario.analysisScores])

  const sendProgressEvent = useCallback(
    (eventName: string, progressOverride?: number, status: "in_progress" | "completed" = "in_progress") => {
      const elapsed = totalSeconds - timeLeftRef.current
      const derivedProgress = totalSeconds > 0 ? Math.min(1, Math.max(0, elapsed / totalSeconds)) : 0
      const progress = progressOverride ?? derivedProgress
      void recordVideoProgressEvent({
        videoId: simulationVideoId,
        videoUrl: undefined,
        progress,
        positionSeconds: Math.max(0, totalSeconds - timeLeftRef.current),
        durationSeconds: totalSeconds,
        streamSelected: streamTag,
        taskStatus: status,
        eventName,
      })
    },
    [simulationVideoId, streamTag, totalSeconds],
  )

  useEffect(() => {
    if (timeLeft > 0) return
    if (completionLoggedRef.current) return
    setIsAnalyzing(false)
    setAnalysisComplete(true)
    revealScenarioScores()
    completionLoggedRef.current = true
    sendProgressEvent("analysis_completed", 1, "completed")
  }, [revealScenarioScores, sendProgressEvent, timeLeft])

  const handleBeginAnalysis = () => {
    if (isAnalyzing || analysisComplete) return
    setIsAnalyzing(true)
    sendProgressEvent("analysis_started", 0.05, "in_progress")
    window.setTimeout(() => {
      revealScenarioScores()
      setIsAnalyzing(false)
      setAnalysisComplete(true)
      completionLoggedRef.current = true
      const total = scenario.analysisScores.reduce((sum, score) => sum + score.value, 0)
      const average = scenario.analysisScores.length
        ? Math.round(total / scenario.analysisScores.length)
        : 0
      void recordScore({
        pointsEarned: average,
        pointsPossible: 100,
        source: `analysis:${subject || "unknown"}:${optionKey ?? "default"}`,
      })
      sendProgressEvent("analysis_completed", 1, "completed")
    }, 1200)
  }

  const handleStartNextVideo = () => {
    sendProgressEvent("next_video_started", 1, "completed")
    router.push(`/next-video/${subject}`)
  }

  const averageScore = useMemo(() => {
    const values = scenario.analysisScores
      .map((score) => scoreValues[score.label])
      .filter((value): value is number => typeof value === "number")
    if (!values.length) return null
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  }, [scoreValues, scenario.analysisScores])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header title={scenario.subjectTitle} variant="on-dark" />

      <main className="mx-auto max-w-6xl space-y-10 px-6 pb-16 pt-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40">
          <div className="absolute inset-0">
            <Image
              src={scenario.heroImageUrl}
              alt="Analysts reviewing market intelligence"
              fill
              sizes="(min-width: 1024px) 1200px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/70" />
          </div>

          <div className="relative z-10 grid gap-10 p-8 lg:grid-cols-[1.7fr,1fr] lg:p-12">
            <div className="space-y-5">
              <div className="space-y-2 text-white/60">
                <p className="text-xs font-semibold uppercase tracking-[0.3em]">{scenario.projectName}</p>
                <p className="text-sm font-medium">{scenario.activity}</p>
              </div>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {scenario.heroHeading}
                </h1>
                <p className="text-base text-white/70 md:text-lg">{scenario.heroSubheading}</p>
                {displayOptionLabel ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Selected Path: {displayOptionLabel}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-white/15 bg-slate-900/70 p-6 backdrop-blur">
              <div className="space-y-4">
                {scenario.metrics.map((metric) => (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                      <span>{metric.label}</span>
                      <span className="font-semibold text-white">{metric.value}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className={`h-2 rounded-full ${metric.colorClass}`}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-3 text-white">
                <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/70">
                  <Clock className="h-5 w-5 text-white/80" aria-hidden="true" />
                  {scenario.timerLabel}
                </div>
                <span className="font-mono text-2xl">{formatTime(timeLeft, scenario.timerMinutes)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[1.95fr,1.05fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-blue-500/25 bg-blue-500/10 p-6 text-blue-100">
              <h2 className="text-lg font-semibold text-blue-100">{scenario.callout.title}</h2>
              <p className="mt-2 text-sm text-blue-100/80">
                {scenario.callout.description}
                {displayOptionLabel ? ` You selected "${displayOptionLabel}" from the video.` : ""}
              </p>
            </div>

            {scenario.sections.map((section) => (
              <div key={section.title} className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                {section.intro ? <p className="mt-2 text-sm text-white/70">{section.intro}</p> : null}
                {section.layout === "bullets" ? (
                  <ul className="mt-4 space-y-3 text-sm text-white/80">
                    {section.items.map((item) => (
                      <li key={`${section.title}-${item.label ?? item.text}`} className="flex gap-3">
                        <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-indigo-400" />
                        <span>
                          {item.label ? <span className="font-semibold text-white">{item.label}: </span> : null}
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 space-y-3 text-sm text-white/75">
                    {section.items.map((item) => (
                      <p key={`${section.title}-${item.label ?? item.text}`}>
                        {item.label ? <span className="font-semibold text-white">{item.label}: </span> : null}
                        {item.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Analysis Prompts</h3>
              <div className="mt-4 space-y-4">
                {scenario.analysisPrompts.map((prompt, index) => (
                  <div key={prompt.title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-sm font-semibold uppercase tracking-wide text-white/70">{prompt.title}</p>
                      <span className="text-xs font-medium text-white/40">Step {index + 1}</span>
                    </div>
                    {prompt.subtitle ? (
                      <p className="mt-2 text-sm text-white/65">{prompt.subtitle}</p>
                    ) : null}
                    <ul className="mt-3 space-y-2 text-sm text-white/80">
                      {prompt.steps.map((step) => (
                        <li key={step} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-emerald-400" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Deliverables Checklist</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                {scenario.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Performance Dashboard</h3>
                {averageScore !== null ? (
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-medium text-emerald-300">
                    Avg {averageScore}%
                  </span>
                ) : null}
              </div>
              <div className="mt-5 space-y-5">
                {scenario.analysisScores.map((score) => {
                  const value = scoreValues[score.label]
                  return (
                    <div key={score.label} className="space-y-2">
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                        <span>{score.label}</span>
                        <span className="font-semibold text-white">{value != null ? `${value}%` : "--"}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-emerald-400 transition-all"
                          style={{ width: `${value ?? 0}%` }}
                        />
                      </div>
                      {value != null && score.description ? (
                        <p className="text-xs text-white/50">{score.description}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <Button
                className="mt-6 w-full rounded-xl bg-violet-500 text-white hover:bg-violet-400"
                onClick={handleBeginAnalysis}
                disabled={isAnalyzing || analysisComplete}
              >
                {analysisComplete ? "Analysis Ready" : isAnalyzing ? "Analyzing..." : "Begin Data Analysis"}
              </Button>
              {analysisComplete ? (
                <p className="mt-3 text-xs text-emerald-300">
                  Scores captured and synced to your profile. Review the insights before moving on.
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">How to Impress the Client</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {scenario.tips.map((tip) => (
                  <li key={tip.title} className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                    <p className="font-semibold text-white">{tip.title}</p>
                    <p className="mt-1 text-white/65">{tip.description}</p>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              variant="outline"
              className="mt-auto w-full rounded-xl border-white/40 text-white hover:bg-white/10"
              onClick={handleStartNextVideo}
            >
              Start Next Video
            </Button>
          </aside>
        </section>
      </main>
    </div>
  )
}
