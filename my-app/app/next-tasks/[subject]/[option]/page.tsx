"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

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

export default function NextTasksOptionPage() {
  const params = useParams()
  const router = useRouter()
  const subject = (params.subject as string) ?? ""
  const optionSlug = ((params.option as string) ?? "option-a").toLowerCase()
  const optionLabel = optionSlug.endsWith("c") ? "C" : optionSlug.endsWith("b") ? "B" : "A"
  const videoId = `next-tasks-${subject}-${optionSlug}`

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
