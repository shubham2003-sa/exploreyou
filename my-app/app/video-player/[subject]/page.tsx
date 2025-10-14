"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter } from "next/navigation"

import Header from "@/components/header"
import VideoPlayer from "@/components/video-player"
import { STUDY_STREAMS_VIDEO_FALLBACK_URL } from "@/lib/video-constants"
import { resolveVideoUrl } from "@/lib/video-url"
import {
  fetchLatestProgressForVideo,
  recordVideoProgressEvent,
  type VideoProgressRecord,
} from "@/lib/video-progress"

const SUBJECT_TITLES: Record<string, string> = {
  consulting: "Consulting",
  commerce: "Commerce",
  math: "Math",
  arts: "Arts",
}

export default function VideoPlayerPage() {
  const router = useRouter()
  const params = useParams()
  const subject = (params.subject as string) ?? ""

  const [videoUrl, setVideoUrl] = useState(STUDY_STREAMS_VIDEO_FALLBACK_URL)
  const [autoplayFlag, setAutoplayFlag] = useState(false)
  const [fullscreenFlag, setFullscreenFlag] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialPosition, setInitialPosition] = useState<number | null>(null)
  const lastRecordRef = useRef<VideoProgressRecord | null>(null)

  useEffect(() => {
    try {
      const auto = sessionStorage.getItem("video_autoplay") === "true"
      const full = sessionStorage.getItem("video_fullscreen") === "true"
      setAutoplayFlag(auto)
      setFullscreenFlag(full)
      sessionStorage.removeItem("video_autoplay")
      sessionStorage.removeItem("video_fullscreen")
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadVideo = async () => {
      try {
        const res = await fetch("/api/videos")
        if (!res.ok) throw new Error("Failed to fetch videos")
        const videos = (await res.json()) as { file_url: string }[]
        if (!active) return

        if (videos.length > 0) {
          const rawUrl = videos[0].file_url
          const resolved = await resolveVideoUrl(rawUrl, STUDY_STREAMS_VIDEO_FALLBACK_URL)
          setVideoUrl(resolved ?? STUDY_STREAMS_VIDEO_FALLBACK_URL)
        } else {
          setError("No video found")
          setVideoUrl(STUDY_STREAMS_VIDEO_FALLBACK_URL)
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Failed to load video")
        setVideoUrl(STUDY_STREAMS_VIDEO_FALLBACK_URL)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadVideo()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadProgress = async () => {
      try {
        const record = await fetchLatestProgressForVideo(subject)
        if (cancelled) return
        if (record) {
          setInitialPosition(record.position_seconds ?? null)
          lastRecordRef.current = record
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[video-player] failed to load saved progress", err)
        }
      }
    }

    if (subject) {
      void loadProgress()
    }

    return () => {
      cancelled = true
    }
  }, [subject])

  const handleOptionClick = (option: string) => {
    const latest = lastRecordRef.current
    void recordVideoProgressEvent({
      videoId: subject,
      videoUrl,
      progress: latest?.progress ?? 1,
      positionSeconds: latest?.position_seconds ?? 0,
      durationSeconds: latest?.duration_seconds ?? undefined,
      streamSelected: `${subject}:Option${option}`,
      taskStatus: "in_progress",
      eventName: `task_option_selected:Option${option}`,
    })
    router.push(`/task-simulation/${subject}?option=${option}`)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading video...</div>
  }

  const title = SUBJECT_TITLES[subject] ?? subject

  return (
    <div className="min-h-screen bg-background">
      <Header title={title} />

      <main className="px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <h2 className="text-xl font-medium">Educational Content</h2>
            {error && <p className="mt-2 text-sm text-muted-foreground">{error} – showing default stream video.</p>}
          </div>

          <div className="relative border-2 border-foreground rounded-lg overflow-hidden aspect-video mb-8">
            <VideoPlayer
              src={videoUrl}
              poster={`/placeholder.svg?height=400&width=800&query=${subject} educational content`}
              className="w-full h-full"
              showOptions={false}
              showNativeControls={false}
              hideControls={false}
              onOptionClick={handleOptionClick}
              autoplay={autoplayFlag}
              startFullscreen={fullscreenFlag}
              trackingConfig={{
                videoId: subject,
                videoUrl,
                streamSelected: subject,
              }}
              initialPositionSeconds={initialPosition}
              onTrackedEvent={(record) => {
                if (record) {
                  lastRecordRef.current = record
                }
              }}
            />
            {typeof document !== "undefined" &&
              createPortal(
                <button
                  className="fixed top-4 right-4 z-[1000005] rounded bg-black/80 px-4 py-2 text-white transition hover:bg-black/90"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    if (window.history.length > 1) {
                      router.back()
                    } else {
                      router.push("/study-streams")
                    }
                  }}
                >
                  Close
                </button>,
                document.body,
              )}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>{subject} educational content</p>
          </div>
        </div>
      </main>
    </div>
  )
}
