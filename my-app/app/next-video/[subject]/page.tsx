"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import VideoPlayer from "@/components/video-player"
import { STUDY_STREAMS_VIDEO_FALLBACK_URL } from "@/lib/video-constants"
import { resolveVideoUrl } from "@/lib/video-url"
import { Button } from "@/components/ui/button"
import {
  fetchLatestProgressForVideo,
  recordVideoProgressEvent,
  type VideoProgressRecord,
} from "@/lib/video-progress"

const CONSULTING_NEXT_SEQUENCE = [
  "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/task2%20partner%20first%20day.mp4",
  "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/2.2%20Monday10am.mp4",
]

type FullscreenCapableElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
  mozRequestFullScreen?: () => Promise<void>
}

function requestFullscreenSafe(element: FullscreenCapableElement): Promise<void> {
  const request =
    element.requestFullscreen?.bind(element) ||
    element.webkitRequestFullscreen?.bind(element) ||
    element.msRequestFullscreen?.bind(element) ||
    element.mozRequestFullScreen?.bind(element)
  const result = request?.()
  return result instanceof Promise ? result : Promise.resolve()
}

export default function NextVideoPage() {
  const params = useParams()
  const router = useRouter()
  const subject = (params.subject as string) ?? ""
  const videoId = `next-video-${subject}`
  const sequence = useMemo(() => (subject === "consulting" ? CONSULTING_NEXT_SEQUENCE : null), [subject])
  const [sequenceIndex, setSequenceIndex] = useState(0)

  const progressVideoId = sequence ? `${videoId}-segment-${sequenceIndex + 1}` : videoId

  const [videoUrl, setVideoUrl] = useState(STUDY_STREAMS_VIDEO_FALLBACK_URL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialPosition, setInitialPosition] = useState<number | null>(null)
  const lastRecordRef = useRef<VideoProgressRecord | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [timerVisible, setTimerVisible] = useState(false)
  const [timerProgress, setTimerProgress] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [navigating, setNavigating] = useState<"A" | "B" | null>(null)

  useEffect(() => {
    if (sequence) {
      const targetUrl = sequence[sequenceIndex] ?? sequence[0]
      setVideoUrl(targetUrl ?? STUDY_STREAMS_VIDEO_FALLBACK_URL)
      setLoading(false)
      setError(null)
      setInitialPosition(null)
      lastRecordRef.current = null
      return
    }

    let active = true

    const load = async () => {
      try {
        const res = await fetch("/api/videos")
        if (!res.ok) throw new Error("Failed to fetch videos")
        const videos = (await res.json()) as { file_url: string }[]
        if (!active) return

        if (videos.length) {
          const rawUrl = videos[1]?.file_url ?? videos[0].file_url
          const resolved = await resolveVideoUrl(rawUrl, STUDY_STREAMS_VIDEO_FALLBACK_URL)
          setVideoUrl(resolved ?? STUDY_STREAMS_VIDEO_FALLBACK_URL)
        } else {
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

    void load()
    return () => {
      active = false
    }
  }, [sequence, sequenceIndex])

  useEffect(() => {
    let cancelled = false

    const loadProgress = async () => {
      try {
        const record = await fetchLatestProgressForVideo(progressVideoId)
        if (cancelled) return
        if (record) {
          setInitialPosition(record.position_seconds ?? null)
          lastRecordRef.current = record
        } else {
          setInitialPosition(null)
          lastRecordRef.current = null
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[next-video] failed to load resume point", err)
        }
      }
    }

    if (progressVideoId) {
      void loadProgress()
    }

    return () => {
      cancelled = true
    }
  }, [progressVideoId])

  const handleOptionSelect = async (option: "A" | "B") => {
    if (navigating) return
    setNavigating(option)
    const latest = lastRecordRef.current
    void recordVideoProgressEvent({
      videoId: progressVideoId,
      videoUrl,
      progress: latest?.progress ?? 1,
      positionSeconds: latest?.position_seconds ?? 0,
      durationSeconds: latest?.duration_seconds ?? undefined,
      streamSelected: `${subject}:Next:${option}`,
      taskStatus: "in_progress",
      eventName: `next_task_option_selected:Option${option}`,
    })
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => undefined)
      }
    } finally {
      const target = `/next-tasks/${subject}/option-${option.toLowerCase()}`
      setTimeout(() => router.push(target), 0)
    }
  }

  useEffect(() => {
    const container = containerRef.current as FullscreenCapableElement | null
    if (!container) return
    requestFullscreenSafe(container).catch(() => undefined)
  }, [])

  useEffect(() => {
    setTimerVisible(false)
    setTimerProgress(1)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const timeoutId = window.setTimeout(() => {
      setTimerVisible(true)
      const startedAt = Date.now()
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt
        const progress = Math.max(0, 1 - elapsed / 10000)
        setTimerProgress(progress)
        if (progress <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          setTimerVisible(false)
          setTimerProgress(1)
        }
      }, 50)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [sequenceIndex])

  const handleNextSegment = () => {
    if (!sequence) return
    if (sequenceIndex >= sequence.length - 1) return
    setSequenceIndex((prev) => prev + 1)
  }

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-black text-white">Loading next video...</div>
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-[1000000] bg-black text-white">
      <div className="absolute right-4 top-4 z-[1000001] flex gap-3">
        <Button
          className="rounded bg-black/80 px-4 py-2 text-white hover:bg-black/90 border border-white/20"
          onClick={() => {
            if (window.history.length > 1) router.back()
            else router.push("/study-streams")
          }}
        >
          Close
        </Button>
        {sequence && sequenceIndex < sequence.length - 1 && (
          <Button
            className="rounded bg-white/10 px-4 py-2 text-white hover:bg-white/20 border border-white/20"
            onClick={handleNextSegment}
          >
            Next Play
          </Button>
        )}
      </div>

      <div className="relative flex h-full w-full items-center justify-center z-[1000001]">
        {error && (
          <div className="absolute top-4 left-4 text-sm text-white/80">{error} – showing default stream video.</div>
        )}
        <VideoPlayer
          key={progressVideoId}
          src={videoUrl}
          className="h-full w-full object-cover"
          showOptions={false}
          hideControls
          autoplay
          startFullscreen={false}
          trackingConfig={{
            videoId: progressVideoId,
            videoUrl,
            streamSelected: `${subject}:Next${sequence ? `:Segment${sequenceIndex + 1}` : ""}`,
          }}
          initialPositionSeconds={initialPosition}
          onTrackedEvent={(record) => {
            if (record) {
              lastRecordRef.current = record
            }
          }}
        />
      </div>

      {timerVisible && (
        <div className="absolute left-0 right-0 flex w-full justify-center z-[1000002]" style={{ bottom: "9.5rem" }}>
          <div
            style={{
              height: "3px",
              background: "white",
              borderRadius: "2px",
              width: `${Math.max(0, timerProgress * 100)}%`,
              transition: "width 0.05s linear",
            }}
          />
        </div>
      )}

      <div className="pointer-events-auto fixed left-0 right-0 bottom-0 z-[1000003]" style={{ height: "9.5rem" }}>
        <div className="flex h-full w-full items-start bg-black/95">
          <button
            aria-label="Option A"
            className="flex-1 h-full pt-6 text-xl font-normal tracking-normal text-white hover:bg-black/95 md:text-2xl"
            style={{ background: "transparent", border: "none" }}
            onClick={() => handleOptionSelect("A")}
          >
            <span className="mt-0">{navigating === "A" ? "Loading…" : "Option A"}</span>
          </button>
          <div className="w-px bg-white/20" />
          <button
            aria-label="Option B"
            className="flex-1 h-full pt-6 text-xl font-normal tracking-normal text-white hover:bg-black/95 md:text-2xl"
            style={{ background: "transparent", border: "none" }}
            onClick={() => handleOptionSelect("B")}
          >
            <span className="mt-0">{navigating === "B" ? "Loading…" : "Option B"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
