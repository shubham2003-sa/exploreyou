"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { loadAuthProfile } from "@/lib/auth-storage"
import { useEffect, useState } from "react"
import Header from "@/components/header"
import { useScore } from "@/components/score-provider"
import { recordVideoProgressEvent } from "@/lib/video-progress"

const SUBJECT_TITLES: Record<string, string> = {
  consulting: "Consulting",
  commerce: "Commerce",
  math: "Math",
  arts: "Arts",
}

const CONSULTING_OPTION_FALLBACK_LABELS: Record<string, string> = {
  A: "I am okay but feeling a bit nervous!",
  B: "Review Market Intelligence",
  C: "Take a Nap",
}

const INITIAL_SCORES = {
  score1: "---",
  score2: "---",
  score3: "---",
  score4: "---",
}

const formatTime = (secs: number | null) => {
  if (secs === null) return "05:00"
  const minutes = Math.floor(secs / 60)
  const seconds = secs % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function TaskSimulationPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const subject = (params.subject as string) ?? ""
  const option = searchParams.get("option")
  const optionKey = option ? option.toUpperCase() : null
  const optionLabelParam = searchParams.get("label")
  const displaySubject = SUBJECT_TITLES[subject] || subject
  const displayOptionLabel =
    optionLabelParam ??
    (subject === "consulting" && optionKey ? CONSULTING_OPTION_FALLBACK_LABELS[optionKey] ?? `Option ${optionKey}` : optionKey ? `Option ${optionKey}` : null)
  const simulationVideoId = `simulation-${subject}`
  const streamTag = displayOptionLabel ? `${subject}:${displayOptionLabel}` : optionKey ? `${subject}:Option${optionKey}` : subject

  const [scores, setScores] = useState(INITIAL_SCORES)
  const { recordScore } = useScore()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(300)

  const generateAndPersistScores = async () => {
    const nextScores = {
      score1: Math.floor(Math.random() * 40 + 60).toString(),
      score2: Math.floor(Math.random() * 40 + 60).toString(),
      score3: Math.floor(Math.random() * 40 + 60).toString(),
      score4: Math.floor(Math.random() * 40 + 60).toString(),
    }
    setScores(nextScores)
    setIsAnalyzing(true)
    void recordVideoProgressEvent({
      videoId: simulationVideoId,
      videoUrl: undefined,
      progress: 0,
      positionSeconds: 0,
      durationSeconds: undefined,
      streamSelected: streamTag,
      taskStatus: 'in_progress',
      eventName: 'analysis_started',
    })

    const average = Math.round(
      (parseInt(nextScores.score1, 10) +
        parseInt(nextScores.score2, 10) +
        parseInt(nextScores.score3, 10) +
        parseInt(nextScores.score4, 10)) /
        4,
    )
    void recordScore({ pointsEarned: average, pointsPossible: 100, source: `analysis:${subject}:${optionKey ?? "default"}` })
    const profile = loadAuthProfile()
    const email = profile?.email
    if (!email) {
      console.warn("No user email found; skipping score persistence.")
      return
    }

    try {
      await fetch(
        `http://127.0.0.1:8000/users/${encodeURIComponent(email)}/stream-scores/${encodeURIComponent(subject || "default")}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: average }),
        },
      )
    } catch (err) {
      console.warn("Failed to persist stream score:", err)
    }
  }

  const handleBeginAnalysis = () => {
    generateAndPersistScores()
  }

  const handleStartNextVideo = () => {
    void recordVideoProgressEvent({
      videoId: simulationVideoId,
      videoUrl: undefined,
      progress: 1,
      positionSeconds: 1,
      durationSeconds: undefined,
      streamSelected: streamTag,
      taskStatus: 'completed',
      eventName: 'next_video_started',
    })
    router.push(`/next-video/${subject}`)
  }

  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft === 0) return

    const timer = window.setTimeout(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) return prev
        return prev - 1
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [timeLeft])

  useEffect(() => {
    if (timeLeft === 0) {
      setIsAnalyzing(false)
      void recordVideoProgressEvent({
        videoId: simulationVideoId,
        videoUrl: undefined,
        progress: 1,
        positionSeconds: 1,
        durationSeconds: undefined,
        streamSelected: streamTag,
        taskStatus: 'completed',
        eventName: 'analysis_completed',
      })
    }
  }, [timeLeft, simulationVideoId, streamTag])

  return (
    <div className="min-h-screen bg-background">
      <Header title={displaySubject} />

      <main className="px-8 py-8">
        <div className="mx-auto max-w-6xl">
          {displayOptionLabel && (
            <div className="mb-6 text-sm text-muted-foreground">Selected path: {displayOptionLabel}</div>
          )}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-lg border-2 border-foreground p-6">
                <h2 className="mb-4 text-xl font-medium">Topic 1</h2>
                <p className="leading-relaxed text-muted-foreground">
                  This is where the task description will go. Users will read this to understand what they need to do
                  for the simulation.
                  {displayOptionLabel && ` You selected ${displayOptionLabel} from the video.`} The task involves
                  analyzing data patterns and making informed decisions based on the information provided. Your
                  performance will be evaluated across multiple criteria to give you comprehensive feedback on your
                  analytical skills.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Performance Scores</h3>
              <div className="mb-4 mt-2 flex items-center gap-3">
                <div className="text-sm text-muted-foreground">Market Analysis Timer</div>
                <div className="rounded bg-muted/20 px-3 py-1 font-mono text-lg">{formatTime(timeLeft)}</div>
              </div>
              <div className="space-y-3">
                {(["score1", "score2", "score3", "score4"] as const).map((key) => (
                  <div key={key}>
                    <Label htmlFor={key} className="text-sm text-muted-foreground">
                      {key.replace("score", "Score ")}
                    </Label>
                    <Input
                      id={key}
                      value={scores[key]}
                      readOnly
                      className="rounded-lg border-2 border-foreground bg-muted/20"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-4">
            <Button
              size="lg"
              className="rounded-lg border-2 border-foreground px-8 py-3 bg-background text-foreground hover:bg-muted"
              onClick={handleBeginAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "Analyzing..." : "Begin data analysis"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-lg border-2 border-foreground px-8 py-3 text-foreground hover:bg-muted"
              onClick={handleStartNextVideo}
            >
              Start Next Video
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
