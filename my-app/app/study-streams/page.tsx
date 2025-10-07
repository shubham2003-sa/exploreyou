"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Atom, Calculator, Palette, TrendingUp, Briefcase } from "lucide-react"

import Header from "@/components/header"
import VideoPlayer from "@/components/video-player"
import { STUDY_STREAMS_VIDEO_FALLBACK_URL } from "@/lib/video-constants"
import { resolveVideoUrl } from "@/lib/video-url"
import { recordVideoProgressEvent, fetchLatestProgressForVideo, fetchVideoProgress, type VideoProgressRecord } from "@/lib/video-progress"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type Stream = {
  id: string
  title: string
  icon: LucideIcon
  bgColor: string
  iconColor: string
  description: string
}

type FullscreenCapableElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
  mozRequestFullScreen?: () => Promise<void>
}

const STREAMS: Stream[] = [
  {
    id: "science",
    title: "Consulting",
    icon: Briefcase,
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    description: "Practice case interviews, problem structuring, and stakeholder communication",
  },
  {
    id: "commerce",
    title: "Commerce",
    icon: TrendingUp,
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
    description: "Learn business, economics, and finance",
  },
  {
    id: "math",
    title: "Math",
    icon: Calculator,
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
    description: "Master algebra, geometry, and calculus",
  },
  {
    id: "arts",
    title: "Arts",
    icon: Palette,
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600",
    description: "Discover literature, history, and creative arts",
  },
]

const SELECTION_STORAGE_KEY = "exploreyou.streamChoices"

const requestFullscreenSafe = (element: FullscreenCapableElement): Promise<void> => {
  const request =
    element.requestFullscreen?.bind(element) ??
    element.webkitRequestFullscreen?.bind(element) ??
    element.msRequestFullscreen?.bind(element) ??
    element.mozRequestFullScreen?.bind(element)

  const result = request?.()
  return result instanceof Promise ? result : Promise.resolve()
}

export default function StudyStreamsPage() {
  const [timerVisible, setTimerVisible] = useState(false)
  const [timerProgress, setTimerProgress] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStartedRef = useRef(false)
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [pendingStream, setPendingStream] = useState<string | null>(null)
  const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null)
  const [overlayStream, setOverlayStream] = useState<string | null>(null)
  const [overlayVideoUrl, setOverlayVideoUrl] = useState<string>(STUDY_STREAMS_VIDEO_FALLBACK_URL)
  const [overlayIntroUrl, setOverlayIntroUrl] = useState<string | null>(null)
  const [overlayIntroPlaying, setOverlayIntroPlaying] = useState(false)
  const [selectionMap, setSelectionMap] = useState<Record<string, string>>({})
  const [overlayInitialPosition, setOverlayInitialPosition] = useState<number | null>(null)
  const overlayLastRecordRef = useRef<VideoProgressRecord | null>(null)
  const autoResumeRef = useRef(false)
  const navigatingRef = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      STREAMS.forEach((stream) => {
        try {
          router.prefetch(`/task-simulation/${stream.id}`)
          router.prefetch(`/next-video/${stream.id}`)
        } catch {
          // ignore prefetch errors
        }
      })
    }
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>
        setSelectionMap(parsed)
      }
    } catch (error) {
      console.warn('failed to load selections', error)
    }
  }, [])

  useEffect(() => {
    if (!overlayStream) {
      setOverlayInitialPosition(null)
      overlayLastRecordRef.current = null
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const record = await fetchLatestProgressForVideo(overlayStream)
        if (!cancelled) {
          setOverlayInitialPosition(record?.position_seconds ?? null)
          overlayLastRecordRef.current = record ?? null
        }
      } catch (error) {
        console.warn('[study-streams] failed to load saved progress', error)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [overlayStream])

    const rememberSelection = useCallback((streamId: string, option: string) => {
    if (typeof window === 'undefined') return
    setSelectionMap((prev) => {
      const next = { ...prev, [streamId]: option }
      try {
        window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.warn('failed to persist selection', error)
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!overlayStream) {
      setOverlayInitialPosition(null)
      overlayLastRecordRef.current = null
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const record = await fetchLatestProgressForVideo(overlayStream)
        if (!cancelled) {
          setOverlayInitialPosition(record?.position_seconds ?? null)
          overlayLastRecordRef.current = record ?? null
        }
      } catch (error) {
        console.warn('[study-streams] failed to load saved progress', error)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [overlayStream])

const closeOverlay = useCallback(() => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        const exitResult = document.exitFullscreen()
        if (exitResult instanceof Promise) {
          exitResult.catch(() => {})
        }
      }
    } catch (error) {
      console.error("Failed to exit fullscreen", error)
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    timerStartedRef.current = false
    setTimerVisible(false)
    setTimerProgress(1)

    if (overlayContainer) {
      try {
        if (overlayContainer.parentNode) {
          overlayContainer.parentNode.removeChild(overlayContainer)
        }
      } catch (error) {
        console.error("Failed to remove overlay container", error)
      }
    }

    setOverlayContainer(null)
    setOverlayStream(null)
    setOverlayInitialPosition(null)
    overlayLastRecordRef.current = null
    setIsLoading(false)
    setPendingStream(null)
  }, [overlayContainer])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const resolved = await resolveVideoUrl('/videos/generated_video_20250917_0737.mp4', STUDY_STREAMS_VIDEO_FALLBACK_URL)
        if (active && resolved) {
          setOverlayVideoUrl(resolved)
        } else if (active) {
          setOverlayVideoUrl(STUDY_STREAMS_VIDEO_FALLBACK_URL)
        }
      } catch (error) {
        if (active) setOverlayVideoUrl(STUDY_STREAMS_VIDEO_FALLBACK_URL)
        console.warn('[study-streams] failed to resolve overlay video', error)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!overlayStream) {
      setOverlayInitialPosition(null)
      overlayLastRecordRef.current = null
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const record = await fetchLatestProgressForVideo(overlayStream)
        if (!cancelled) {
          setOverlayInitialPosition(record?.position_seconds ?? null)
          overlayLastRecordRef.current = record ?? null
        }
      } catch (error) {
        console.warn('[study-streams] failed to load saved progress', error)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [overlayStream])

  useEffect(() => {
    if (!overlayContainer || !overlayStream || timerStartedRef.current) {
      return
    }

    timerStartedRef.current = true
    const timeoutId = window.setTimeout(() => {
      setTimerVisible(true)
      const startedAt = Date.now()
      timerRef.current = setInterval(() => {
        if (navigatingRef.current) return
        const elapsed = Date.now() - startedAt
        const progress = Math.max(0, 1 - elapsed / 10000)
        setTimerProgress(progress)
        if (progress <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          setTimerVisible(false)
          closeOverlay()
          if (!navigatingRef.current) {
            router.push("/study-streams")
          }
        }
      }, 50)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      timerStartedRef.current = false
      setTimerVisible(false)
      setTimerProgress(1)
    }
  }, [overlayContainer, overlayStream, closeOverlay, router])

  const handleExplore = useCallback((streamId: string) => {
    if (overlayContainer) {
      closeOverlay()
    }

    setPendingStream(streamId)
    setIsLoading(true)
    setTimerVisible(false)
    setTimerProgress(1)
    timerStartedRef.current = false

    window.setTimeout(() => {
      try {
        const div = document.createElement("div")
        div.id = "video-overlay"
        div.style.position = "fixed"
        div.style.top = "0"
        div.style.left = "0"
        div.style.width = "100%"
        div.style.height = "100%"
        div.style.zIndex = "99999"
        div.style.background = "black"
        document.body.appendChild(div)

        requestFullscreenSafe(div as FullscreenCapableElement)
          .catch((err: unknown) => {
            console.log("requestFullscreen blocked", err)
          })
          .finally(() => {
            setOverlayContainer(div)
            setOverlayStream(streamId)
            // Consulting: play an extra intro video first, then fall back to the resolved stream video
            if (streamId === 'science') {
              setOverlayIntroUrl('https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/in%20flight%20option%20for%20excited.mp4')
              setOverlayIntroPlaying(true)
              // After intro, play this specific Airplane Video instead of the default generated clip
              setOverlayVideoUrl('https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Airplane%20Video.mp4')
            } else {
              setOverlayIntroUrl(null)
              setOverlayIntroPlaying(false)
            }
            setIsLoading(false)
            setPendingStream(null)
          })
      } catch (error) {
        console.error("Failed to create fullscreen overlay", error)
        setIsLoading(false)
        setPendingStream(null)
        router.push(`/video-player/${streamId}`)
      }
    }, 250)
  }, [overlayContainer, closeOverlay, router])

  useEffect(() => {
    if (autoResumeRef.current) return
    autoResumeRef.current = true

    let cancelled = false

    const resume = async () => {
      try {
        const records = await fetchVideoProgress({ limit: 5 })
        if (cancelled || !records.length) return
        const latest = records[0]
        if (!latest) return

        const videoId = latest.video_id ?? ''
        const status = latest.task_status ?? ''
        const progressValue = latest.progress ?? 0
        const needsResume = progressValue < 0.95 || status !== 'completed'

        if (!needsResume) return

        if (videoId.startsWith('next-video-')) {
          const subject = videoId.replace('next-video-', '')
          if (subject) {
            router.replace(`/next-video/${subject}`)
          }
          return
        }

        if (videoId.startsWith('simulation-')) {
          const subject = videoId.replace('simulation-', '')
          if (subject) {
            const optionToken = latest.event_name?.split(':')[1]
            const optionValue = optionToken?.replace('Option', '') ?? selectionMap[subject] ?? 'A'
            router.replace(`/task-simulation/${subject}?option=${optionValue}`)
          }
          return
        }

        if (videoId.startsWith('next-tasks-')) {
          const match = videoId.match(/^next-tasks-(.+?)-(option-[ab])$/i)
          if (match) {
            const subjectSlug = match[1]
            const optionSlug = match[2].toLowerCase()
            router.replace(`/next-tasks/${subjectSlug}/${optionSlug}`)
          }
          return
        }

        if (STREAMS.some((stream) => stream.id === videoId)) {
          handleExplore(videoId)
        }
      } catch (error) {
        console.warn('[study-streams] failed to auto resume progress', error)
      }
    }

    void resume()

    return () => {
      cancelled = true
    }
  }, [handleExplore, router, selectionMap])

  const spinnerOverlay = isLoading ? (
    <div className="fixed inset-0 z-[1000100] flex items-center justify-center bg-black/70 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        {pendingStream ? (
          <span className="text-lg font-medium capitalize">Preparing {pendingStream}</span>
        ) : (
          <span className="text-lg font-medium">Loading</span>
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header title="Study Streams" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-semibold sm:text-5xl">Choose Your Stream</h2>
          <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
            Pick a stream to dive into curated lessons and task simulations tailored to your interests.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {STREAMS.map((stream) => {
            const IconComponent = stream.icon
            const isPending = pendingStream === stream.id && isLoading

            return (
              <Card
                key={stream.id}
                className="relative cursor-pointer border border-border/60 shadow-sm transition hover:border-foreground/40"
                onClick={() => handleExplore(stream.id)}
              >
                <div className="flex h-full flex-col items-center gap-6 p-8 text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-lg ${stream.bgColor}`}>
                    <IconComponent className={`h-8 w-8 ${stream.iconColor}`} />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{stream.title}</h3>
                    <p className="text-sm text-muted-foreground">{stream.description}</p>
                    {selectionMap[stream.id] && (
                      <p className="text-xs text-muted-foreground">Last option: Option {selectionMap[stream.id]}</p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="border-2 border-foreground rounded-lg px-6 py-2 hover:bg-muted bg-transparent"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleExplore(stream.id)
                    }}
                  >
                    Explore
                  </Button>
                </div>

                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 backdrop-blur-sm">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </main>

      {overlayContainer && overlayStream &&
        createPortal(
          <div className="relative flex h-full w-full items-center justify-center text-white">
            <div className="absolute right-4 top-4 z-[1000000]">
              <Button onClick={closeOverlay}>Close</Button>
            </div>
            <div className="relative flex h-full w-full items-center justify-center z-[1000001]">
              <VideoPlayer
                src={overlayIntroPlaying && overlayIntroUrl ? overlayIntroUrl : overlayVideoUrl}
                className="h-full w-full object-cover"
                showOptions={false}
                hideControls={false}
                autoplay
                startFullscreen={false}
                forceMuted={overlayIntroPlaying}
                trackingConfig={{
                  videoId: overlayIntroPlaying ? `${overlayStream}-intro` : overlayStream,
                  videoUrl: overlayIntroPlaying && overlayIntroUrl ? overlayIntroUrl : overlayVideoUrl,
                  streamSelected: overlayStream ?? undefined,
                }}
                initialPositionSeconds={overlayInitialPosition}
                onTrackedEvent={(record, eventName) => {
                  if (record) {
                    overlayLastRecordRef.current = record
                  }
                  if (overlayIntroPlaying && eventName === 'video_completed') {
                    // switch to main overlay video when intro finishes
                    setOverlayIntroPlaying(false)
                  }
                }}
              />
            </div>

            {timerVisible && (
              <div className="absolute left-0 right-0 flex w-full justify-center" style={{ bottom: "9.5rem" }}>
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

            {!overlayIntroPlaying && (
            <div className="pointer-events-auto fixed left-0 right-0 bottom-0 z-[1000003]" style={{ height: "9.5rem" }}>
              <div className="flex h-full w-full items-start bg-black/95">
                <button
                  aria-label="How to Play"
                  className="flex-1 h-full pt-6 text-xl font-normal tracking-normal text-white hover:bg-black/95 md:text-2xl"
                  style={{ background: "transparent", border: "none" }}
                  onClick={() => {
                    if (!overlayStream) return
                    rememberSelection(overlayStream, 'A')
                    const option = 'A'
                    const latest = overlayLastRecordRef.current
                    void recordVideoProgressEvent({
                      videoId: overlayStream,
                      videoUrl: overlayVideoUrl,
                      progress: latest?.progress ?? 1,
                      positionSeconds: latest?.position_seconds ?? 0,
                      durationSeconds: latest?.duration_seconds ?? undefined,
                      streamSelected: `${overlayStream}:Option${option}`,
                      taskStatus: 'in_progress',
                      eventName: `task_option_selected:Option${option}`,
                    })
                    navigatingRef.current = true
                    closeOverlay()
                    if (document.fullscreenElement && document.exitFullscreen) {
                      document.exitFullscreen().catch(() => undefined).finally(() => {
                        router.push(`/task-simulation/${overlayStream}?option=${option}`)
                      })
                    } else {
                      router.push(`/task-simulation/${overlayStream}?option=${option}`)
                    }
                  }}
                >
                  <span className="mt-0">How to Play</span>
                </button>
                <div className="w-px bg-white/20" />
                <button
                  aria-label="Start Simulation"
                  className="flex-1 h-full pt-6 text-xl font-normal tracking-normal text-white hover:bg-black/95 md:text-2xl"
                  style={{ background: "transparent", border: "none" }}
                  onClick={() => {
                    if (!overlayStream) return
                    rememberSelection(overlayStream, 'B')
                    const option = 'B'
                    const latest = overlayLastRecordRef.current
                    void recordVideoProgressEvent({
                      videoId: overlayStream,
                      videoUrl: overlayVideoUrl,
                      progress: latest?.progress ?? 1,
                      positionSeconds: latest?.position_seconds ?? 0,
                      durationSeconds: latest?.duration_seconds ?? undefined,
                      streamSelected: `${overlayStream}:Option${option}`,
                      taskStatus: 'in_progress',
                      eventName: `task_option_selected:Option${option}`,
                    })
                    navigatingRef.current = true
                    closeOverlay()
                    if (document.fullscreenElement && document.exitFullscreen) {
                      document.exitFullscreen().catch(() => undefined).finally(() => {
                        router.push(`/task-simulation/${overlayStream}?option=${option}`)
                      })
                    } else {
                      router.push(`/task-simulation/${overlayStream}?option=${option}`)
                    }
                  }}
                >
                  <span className="mt-0">Start Simulation</span>
                </button>
              </div>
            </div>
            )}
          </div>,
          overlayContainer
        )}

      {spinnerOverlay}
    </div>
  )
}



