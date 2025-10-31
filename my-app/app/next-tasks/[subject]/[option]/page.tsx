"use client"

import clsx from "clsx"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Clock } from "lucide-react"

import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { useScore } from "@/components/score-provider"
import {
  fetchLatestProgressForVideo,
  recordVideoProgressEvent,
} from "@/lib/video-progress"

const OPTION_CONTENT: Record<string, { headline: string; description: string }> = {
  "option-a": {
    headline: "Own In-Store Experience",
    description:
      "Design the refreshed customer journey: prioritize ambiance, service rituals, and in-store storytelling that rebuilds the Starbucks 'third place'.",
  },
  "option-b": {
    headline: "Lead Supply Chain & Logistics",
    description:
      "Stabilize product availability and cost structure. Build a rapid plan for sourcing, inventory, and barista workflows that restores reliability.",
  },
  "option-c": {
    headline: "Focus on Financials & Store Portfolio",
    description:
      "Model the turnaround economics. Evaluate store closures, capital allocation, and pricing levers that protect viability while funding the reset.",
  },
}

const LOGISTICS_METRICS = [
  { label: "Client Confidence", value: 50, color: "bg-sky-500" },
  { label: "Team Morale", value: 50, color: "bg-emerald-400" },
  { label: "Quality of Insight", value: 10, color: "bg-purple-400" },
  { label: "Work-Life Balance", value: 75, color: "bg-orange-400" },
] as const

const LOGISTICS_COST_ITEMS = [
  { label: "Logistics", cost: 0.75, color: "bg-red-500", valueClass: "text-red-300" },
  { label: "Labor", cost: 0.6, color: "bg-slate-500", valueClass: "text-slate-200" },
  { label: "Rent & Utilities", cost: 0.55, color: "bg-slate-500", valueClass: "text-slate-200" },
  { label: "Milk & Syrup", cost: 0.3, color: "bg-slate-500", valueClass: "text-slate-200" },
  { label: "Coffee Beans", cost: 0.2, color: "bg-emerald-500", valueClass: "text-emerald-300" },
] as const

const LOGISTICS_OPTIONS = [
  "...that we should immediately cut barista hours, since labor ($0.60) is a major cost.",
  "...that the price of milk ($0.30) is the real issue, since it's higher than the core ingredient, coffee beans ($0.20).",
  "...that it's absurd for a coffee company to spend more than triple on shipping the coffee ($0.75) than on the coffee beans themselves ($0.20).",
] as const

const LOGISTICS_INSIGHT =
  "Exactly. This is the critical insight. For a premium coffee company, spending over three times as much on logistics as on its core ingredient is a massive red flag. It signals a major problem in the supply chain that needs immediate investigation. Therefore, operational complexity has become so inefficient that it's destroying Starbuck's profitability."

export default function NextTasksOptionPage() {
  const params = useParams()
  const router = useRouter()
  const subject = (params.subject as string) ?? ""
  const optionSlug = ((params.option as string) ?? "option-a").toLowerCase()
  const optionLabel = optionSlug.endsWith("c") ? "C" : optionSlug.endsWith("b") ? "B" : "A"
  const videoId = `next-tasks-${subject}-${optionSlug}`

  if (subject === "consulting" && optionSlug === "option-b") {
    return (
      <ConsultingLogisticsTask
        subject={subject}
        optionLabel={optionLabel}
        videoId={videoId}
      />
    )
  }

  return (
    <DefaultNextTasksOption
      subject={subject}
      optionSlug={optionSlug}
      optionLabel={optionLabel}
      videoId={videoId}
      router={router}
    />
  )
}

type DefaultProps = {
  subject: string
  optionSlug: string
  optionLabel: string
  videoId: string
  router: ReturnType<typeof useRouter>
}

function DefaultNextTasksOption({ subject, optionSlug, optionLabel, videoId, router }: DefaultProps) {
  const [completed, setCompleted] = useState(false)
  const { recordScore } = useScore()
  const optionContent = useMemo(
    () => OPTION_CONTENT[optionSlug] ?? OPTION_CONTENT["option-a"],
    [optionSlug],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const record = await fetchLatestProgressForVideo(videoId)
        if (cancelled) return
        const alreadyCompleted = record?.task_status === "completed"
        setCompleted(alreadyCompleted)
        void recordVideoProgressEvent({
          videoId,
          videoUrl: undefined,
          progress: alreadyCompleted ? 1 : record?.progress ?? 0,
          positionSeconds: alreadyCompleted ? 1 : record?.position_seconds ?? 0,
          durationSeconds: record?.duration_seconds ?? undefined,
          streamSelected: `${subject}:Next:${optionLabel}`,
          taskStatus: alreadyCompleted ? "completed" : "in_progress",
          eventName: alreadyCompleted ? "next_task_resumed" : "next_task_started",
        })
      } catch (error) {
        if (!cancelled) {
          console.warn("[next-tasks] failed to load prior task progress", error)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [optionLabel, subject, videoId])

  const handleComplete = () => {
    if (completed) return
    setCompleted(true)
    void recordVideoProgressEvent({
      videoId,
      videoUrl: undefined,
      progress: 1,
      positionSeconds: 1,
      durationSeconds: undefined,
      streamSelected: `${subject}:Next:${optionLabel}`,
      taskStatus: "completed",
      eventName: "next_task_completed",
    })
    void recordScore({ pointsEarned: 100, pointsPossible: 100, source: `next-task:${subject}:${optionLabel}` })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title={`${subject} - Next Tasks`} />

      <main className="px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">
              Option {optionLabel}: {optionContent.headline}
            </h2>
            <p className="text-muted-foreground">{optionContent.description}</p>
            <p className="text-sm text-muted-foreground">
              Status: {completed ? "Completed" : "In progress"}
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-medium">Task Checklist</h3>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Review the scenario brief and highlight the critical data points.</li>
              <li>Draft your recommended approach and potential trade-offs.</li>
              <li>Summarize the expected outcomes before submitting for review.</li>
            </ul>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button
              className="rounded-lg border-2 border-foreground bg-background text-foreground hover:bg-muted"
              onClick={() => router.push("/study-streams")}
            >
              Back to Study Streams
            </Button>
            <Button
              variant="outline"
              className="rounded-lg border-2 border-foreground text-foreground hover:bg-muted"
              onClick={() => router.push(`/task-simulation/${subject}?option=${optionLabel}`)}
            >
              Revisit Simulation Tasks
            </Button>
            <Button
              className="rounded-lg border-2 border-foreground bg-foreground text-background hover:bg-foreground/90"
              onClick={handleComplete}
            >
              Mark Task As Complete
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

type LogisticsTaskProps = {
  subject: string
  optionLabel: string
  videoId: string
}

function ConsultingLogisticsTask({ subject, optionLabel, videoId }: LogisticsTaskProps) {
  const { recordScore } = useScore()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [completed, setCompleted] = useState(false)
  const [showOverlay, setShowOverlay] = useState<{ text: string; onContinue?: () => void } | null>(null)
  const optionLetters = ["A", "B", "C"] as const
  const correctIndex = 2

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const record = await fetchLatestProgressForVideo(videoId)
        if (cancelled) return
        const alreadyCompleted = record?.task_status === "completed"
        setCompleted(alreadyCompleted)
        if (alreadyCompleted) {
          setSelectedIndex(correctIndex)
        }
        void recordVideoProgressEvent({
          videoId,
          videoUrl: undefined,
          progress: alreadyCompleted ? 1 : record?.progress ?? 0,
          positionSeconds: alreadyCompleted ? 1 : record?.position_seconds ?? 0,
          durationSeconds: record?.duration_seconds ?? undefined,
          streamSelected: `${subject}:Next:${optionLabel}`,
          taskStatus: alreadyCompleted ? "completed" : "in_progress",
          eventName: alreadyCompleted ? "next_task_resumed" : "next_task_started",
        })
      } catch (error) {
        if (!cancelled) {
          console.warn("[next-tasks] failed to load prior task progress", error)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [optionLabel, subject, videoId, correctIndex])

  const completeTask = useCallback(() => {
    if (completed) return
    setCompleted(true)
    setSelectedIndex(correctIndex)
    void recordVideoProgressEvent({
      videoId,
      videoUrl: undefined,
      progress: 1,
      positionSeconds: 1,
      durationSeconds: undefined,
      streamSelected: `${subject}:Next:${optionLabel}`,
      taskStatus: "completed",
      eventName: "next_task_completed",
    })
    void recordScore({ pointsEarned: 120, pointsPossible: 120, source: `next-task:${subject}:${optionLabel}` })
  }, [completed, correctIndex, optionLabel, recordScore, subject, videoId])

  const handleOptionSelect = (index: number) => {
    setSelectedIndex(index)
    if (index === correctIndex) {
      completeTask()
      setShowOverlay({ text: LOGISTICS_INSIGHT })
      return
    }

    void recordVideoProgressEvent({
      videoId,
      videoUrl: undefined,
      progress: completed ? 1 : 0.5,
      positionSeconds: 1,
      durationSeconds: undefined,
      streamSelected: `${subject}:Next:${optionLabel}`,
      taskStatus: completed ? "completed" : "in_progress",
      eventName: `next_task_option_selected:${optionLetters[index]}`,
    })

    if (index === 0) {
      setShowOverlay({
        text: "Exactly. This is the critical insight. For a premium coffee company, spending over three times as much on logistics as on its core ingredient is a massive red flag. It signals a major problem in the supply chain that needs immediate investigation. Therefore, operational complexity has become so inefficient that it's destroying Starbuck's profitability.",
      })
    } else {
      setShowOverlay({
        text: "While it's true that milk costs more than the beans in this cup, this comparison is a distraction. The absolute difference is small, and it overlooks the much more significant cost anomaly in the data. Therefore, focusing on this small-scale inefficiency means missing the multi-million dollar problem.",
      })
    }
  }

  const showResults = selectedIndex !== null

  return (
    <div className="relative min-h-screen bg-[#0b1220] text-slate-100">
      <Header title="Project: Phoenix (Starbucks 2008)" variant="on-dark" />
      <main className={clsx("relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-12", showOverlay && "pointer-events-none blur-sm")}>
        <section className="rounded-3xl border border-slate-700 bg-[linear-gradient(135deg,#0f1729,#141f35)] p-8 shadow-lg">
          <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">Project: Phoenix (Starbucks 2008)</p>
              <p className="text-sm font-medium text-slate-200">Activity: Preliminary Analysis</p>
            </div>
            <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
              <div className="space-y-3">
                {LOGISTICS_METRICS.map((metric) => (
                  <div key={metric.label} className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">{metric.label}</div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
                      <div
                        className={clsx("absolute inset-y-0 left-0 rounded-full", metric.color)}
                        style={{ width: `${metric.value}%` }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-100">
                        {metric.value}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-300">
                  <Clock className="h-4 w-4 text-slate-300" aria-hidden />
                  Market Analysis Timer
                </div>
                <span className="font-mono text-lg text-white">03:21</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-[#0f1729] p-8 shadow-lg">
          <div className="rounded-2xl bg-gradient-to-r from-[#1b2a52] to-[#1c2d56] px-6 py-6 text-center shadow-inner">
            <h2 className="text-xl font-semibold text-white">A Day in the Life: The Data Puzzle</h2>
            <p className="mt-3 text-sm text-slate-200">
              Consultants spend nearly 40% of their time on data analysis. The ability to find the story behind the numbers is what separates a good analyst from a great consultant.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr,1fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
              <div className="border-b border-slate-700 bg-slate-900/80 px-6 py-4 text-lg font-semibold text-white">
                Cost Breakdown per Latte (Simplified)
              </div>
              <div className="divide-y divide-slate-700 text-sm">
                {LOGISTICS_COST_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-6 py-3 font-medium">
                    <span className={clsx(item.label === "Logistics" && "text-red-400", item.label === "Coffee Beans" && "text-emerald-400")}>
                      {item.label}
                    </span>
                    <span className={clsx("font-semibold", item.valueClass)}>${item.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/60 px-6 py-6">
              {LOGISTICS_COST_ITEMS.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-200">
                    <span>{item.label}</span>
                    <span className={clsx("rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-100", item.label === "Logistics" && "bg-red-500/20 text-red-200", item.label === "Coffee Beans" && "bg-emerald-500/20 text-emerald-200")}>
                      ${item.cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800/80">
                    <div
                      className={clsx("absolute inset-y-0 left-0 rounded-full", item.color)}
                      style={{ width: `${Math.round((item.cost / 0.75) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 space-y-5">
            <h3 className="text-xl font-semibold text-white">Our initial hypothesis is:</h3>
            <div className="space-y-3">
              {LOGISTICS_OPTIONS.map((option, index) => {
                const isCorrect = index === correctIndex
                const isSelected = selectedIndex === index
                const classes = clsx(
                  "w-full rounded-2xl border border-slate-700 bg-slate-800/60 px-6 py-4 text-left text-base font-medium text-slate-100 transition-colors hover:bg-slate-800 focus:outline-none",
                  showResults && isCorrect && "border-emerald-400 bg-emerald-500/10 text-emerald-100",
                  showResults && !isCorrect && isSelected && "border-red-500 bg-red-500/10 text-red-200",
                  showResults && !isCorrect && !isSelected && "opacity-80",
                )
                return (
                  <button
                    key={option}
                    type="button"
                    className={classes}
                    onClick={() => handleOptionSelect(index)}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      {showOverlay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-600 bg-slate-900 px-8 py-8 text-slate-100 shadow-2xl">
            <p className="text-base leading-relaxed text-slate-100">
              {showOverlay.text}
            </p>
            <Button
              className="mt-6 w-full rounded-xl bg-blue-500 text-white hover:bg-blue-500/90"
              onClick={() => {
                setShowOverlay(null)
              }}
            >
              {selectedIndex === correctIndex ? "Continue" : "Try Again"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
