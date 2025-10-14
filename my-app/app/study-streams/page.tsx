"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Calculator, Palette, TrendingUp, Briefcase } from "lucide-react"

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

type OptionKey = 'A' | 'B' | 'C'
type OptionConfig = { key: OptionKey; label: string }
type SelectionSnapshot = { key: OptionKey; label: string }

const CONSULTING_MARKET_INTEL_URL = 'https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Monday%20630%20am.mp4'
const CONSULTING_INTRO_LABELS: Partial<Record<OptionKey, string>> = {
  A: "How to Play",
  B: "Start Simulation",
}
const CONSULTING_PROMPT_DEFAULT_LABELS: Partial<Record<OptionKey, string>> = {
  A: "I am okay but feeling a bit nervous!",
  B: "I am really excited! whats next?",
}
const CONSULTING_PROMPT_EXCITED_LABELS: Partial<Record<OptionKey, string>> = {
  A: "Clear Inbox",
  B: "Review Market Intelligence",
  C: "Take a Nap",
}

const getConsultingOptionLabel = (
  stage: "intro" | "prompt" | "mid" | "main",
  mode: "default" | "excitedFollowup",
  option: OptionKey,
): string | null => {
  if (stage === "intro") {
    return CONSULTING_INTRO_LABELS[option] ?? null
  }
  if (stage === "prompt") {
    const lookup = mode === "excitedFollowup" ? CONSULTING_PROMPT_EXCITED_LABELS : CONSULTING_PROMPT_DEFAULT_LABELS
    return lookup[option] ?? null
  }
  return null
}

const STREAMS: Stream[] = [
  {
    id: "consulting",
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
  const [overlayPromptUrl, setOverlayPromptUrl] = useState<string | null>(null)
  const [overlayMidUrl, setOverlayMidUrl] = useState<string | null>(null)
  const [overlayStage, setOverlayStage] = useState<"intro" | "prompt" | "mid" | "main">("main")
  const overlayIntroPlaying = overlayStage !== "main"
  const overlayIntroPlayingRef = useRef(overlayIntroPlaying)
  const overlayPlayerApiRef = useRef<{ play: () => Promise<boolean>; pause: () => void; element?: HTMLVideoElement | null } | null>(null)
  const overlayVideoElementRef = useRef<HTMLVideoElement | null>(null)
  const pendingMainPlaybackRef = useRef(false)
  const selectedOptionRef = useRef<OptionKey | null>(null)
  const selectedOptionLabelRef = useRef<string | null>(null)
  const [activeOptionKey, setActiveOptionKey] = useState<OptionKey | null>(null)
  const [selectionMap, setSelectionMap] = useState<Record<string, SelectionSnapshot>>({})
  const [consultingPromptMode, setConsultingPromptMode] = useState<"default" | "excitedFollowup">("default")
  const [overlayInitialPosition, setOverlayInitialPosition] = useState<number | null>(null)
  const overlayLastRecordRef = useRef<VideoProgressRecord | null>(null)
  const autoResumeRef = useRef(false)
  const navigatingRef = useRef(false)
  const unmountedRef = useRef(false)

  useEffect(() => {
    overlayIntroPlayingRef.current = overlayIntroPlaying
  }, [overlayIntroPlaying])

  useEffect(() => {
    setActiveOptionKey(null)
  }, [overlayStage, consultingPromptMode, overlayStream])

  useEffect(() => {
    return () => {
      unmountedRef.current = true
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => undefined)
        }
      } catch {
        // ignore exit fullscreen errors during unmount
      }
      if (overlayContainer && overlayContainer.parentNode) {
        try {
          overlayContainer.parentNode.removeChild(overlayContainer)
        } catch {
          // ignore removal errors during unmount
        }
      }
    }
  }, [overlayContainer])

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    timerStartedRef.current = false
    setTimerVisible(false)
    setTimerProgress(1)
  }, [])

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

    resetTimer()

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
    setOverlayIntroUrl(null)
    setOverlayPromptUrl(null)
    setOverlayMidUrl(null)
    setOverlayStage("main")
    setConsultingPromptMode("default")
    overlayIntroPlayingRef.current = false
    overlayPlayerApiRef.current = null
    overlayVideoElementRef.current = null
    pendingMainPlaybackRef.current = false
    selectedOptionRef.current = null
    selectedOptionLabelRef.current = null
    setActiveOptionKey(null)
    setIsLoading(false)
    setPendingStream(null)
  }, [overlayContainer, resetTimer])

  const transitionToMainStage = useCallback(() => {
    pendingMainPlaybackRef.current = true
    overlayIntroPlayingRef.current = false
    resetTimer()
    setOverlayMidUrl(null)
    setOverlayStage("main")
    setConsultingPromptMode("default")
    overlayVideoElementRef.current = null
    overlayPlayerApiRef.current = null
  }, [resetTimer])

  const rememberSelection = useCallback((streamId: string, option: OptionKey, optionLabel?: string) => {
    if (typeof window === 'undefined') return
    setSelectionMap((prev) => {
      const record: SelectionSnapshot = {
        key: option,
        label: optionLabel ?? `Option ${option}`,
      }
      const next = { ...prev, [streamId]: record }
      try {
        window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.warn('failed to persist selection', error)
      }
      return next
    })
  }, [])

  const navigateWithOption = useCallback((option: OptionKey, optionLabel?: string | null) => {
    const streamId = overlayStream
    if (!streamId) return

    const labelSegment = optionLabel ? `&label=${encodeURIComponent(optionLabel)}` : ""
    const target = `/task-simulation/${streamId}?option=${option}${labelSegment}`
    navigatingRef.current = true
    pendingMainPlaybackRef.current = false
    selectedOptionRef.current = null
    selectedOptionLabelRef.current = null
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimerVisible(false)
    setTimerProgress(1)
    setIsLoading(true)

    try {
      overlayPlayerApiRef.current?.pause()
      const currentVideo = overlayVideoElementRef.current
      if (currentVideo) {
        currentVideo.pause()
      }
    } catch {
      // ignore pause errors
    }

    const pushTarget = () => {
      void router.push(target)
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => undefined).finally(pushTarget)
    } else {
      pushTarget()
    }
  }, [overlayStream, router])

  const handleOptionSelection = useCallback((option: OptionKey) => {
    const streamId = overlayStream
    if (!streamId) return
    setActiveOptionKey(option)

    const fallbackLabel = `Option ${option}`
    const optionLabel =
      streamId === "consulting"
        ? getConsultingOptionLabel(overlayStage, consultingPromptMode, option) ?? fallbackLabel
        : fallbackLabel

    const latest = overlayLastRecordRef.current
    const activeVideoUrl =
      overlayStage === "intro" && overlayIntroUrl
        ? overlayIntroUrl
        : overlayStage === "prompt" && overlayPromptUrl
          ? overlayPromptUrl
          : overlayStage === "mid" && overlayMidUrl
            ? overlayMidUrl
            : overlayVideoUrl
    void recordVideoProgressEvent({
      videoId: streamId,
      videoUrl: activeVideoUrl,
      progress: latest?.progress ?? 1,
      positionSeconds: latest?.position_seconds ?? 0,
      durationSeconds: latest?.duration_seconds ?? undefined,
      streamSelected: `${streamId}:Option${option}`,
      taskStatus: 'in_progress',
      eventName: `task_option_selected:Option${option}`,
    })
    rememberSelection(streamId, option, optionLabel)

    const pauseCurrentVideo = (resetTime = true) => {
      overlayPlayerApiRef.current?.pause()
      const currentVideo = overlayVideoElementRef.current
      if (!currentVideo) return
      try {
        currentVideo.pause()
        if (resetTime) {
          currentVideo.currentTime = 0
        }
      } catch {
        // ignore reset errors
      }
    }

    const isConsultingStreamSelection = streamId === "consulting"

    if (isConsultingStreamSelection) {
      if (overlayStage === "intro") {
        pauseCurrentVideo()
        setConsultingPromptMode("default")
        overlayIntroPlayingRef.current = true
        setOverlayStage("prompt")
        pendingMainPlaybackRef.current = false
        selectedOptionRef.current = null
        selectedOptionLabelRef.current = null
        return
      }

      if (overlayStage === "prompt") {
        if (consultingPromptMode === "default") {
          if (option === "B") {
            setConsultingPromptMode("excitedFollowup")
            selectedOptionRef.current = null
            selectedOptionLabelRef.current = null
            return
          }
          pauseCurrentVideo()
          selectedOptionRef.current = option
          selectedOptionLabelRef.current = optionLabel
          transitionToMainStage()
          return
        }

        if (consultingPromptMode === "excitedFollowup") {
          if (option === "B") {
            pauseCurrentVideo(false)
            selectedOptionRef.current = "B"
            selectedOptionLabelRef.current = optionLabel
            setOverlayMidUrl(CONSULTING_MARKET_INTEL_URL)
            setOverlayStage("mid")
            overlayIntroPlayingRef.current = true
            pendingMainPlaybackRef.current = false
            return
          }
          if (option === "A") {
            pauseCurrentVideo(false)
            selectedOptionRef.current = "A"
            selectedOptionLabelRef.current = optionLabel
            navigateWithOption("A", optionLabel)
            return
          }
          if (option === "C") {
            pauseCurrentVideo(false)
            selectedOptionRef.current = "C"
            selectedOptionLabelRef.current = optionLabel
            navigateWithOption("C", optionLabel)
            return
          }
          return
        }
      }
    }

    if (overlayStage !== "main") {
      pauseCurrentVideo()
      selectedOptionRef.current = option
      selectedOptionLabelRef.current = optionLabel
      transitionToMainStage()
      return
    }

    selectedOptionRef.current = option
    selectedOptionLabelRef.current = optionLabel
    navigateWithOption(option, optionLabel)
  }, [
    overlayStream,
    overlayStage,
    consultingPromptMode,
    overlayIntroUrl,
    overlayPromptUrl,
    overlayMidUrl,
    overlayVideoUrl,
    rememberSelection,
    navigateWithOption,
    transitionToMainStage,
  ])

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
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, SelectionSnapshot | string>
      const normalized: Record<string, SelectionSnapshot> = {}
      for (const [streamId, value] of Object.entries(parsed)) {
        if (value && typeof value === "object" && "key" in value && "label" in value) {
          const keyCandidate = String(value.key).toUpperCase()
          const key: OptionKey = keyCandidate === "B" ? "B" : keyCandidate === "C" ? "C" : "A"
          normalized[streamId] = {
            key,
            label: typeof value.label === "string" && value.label.length > 0 ? value.label : `Option ${key}`,
          }
          continue
        }
        if (typeof value === "string" && value.length > 0) {
          const trimmed = value.trim()
          const keyCandidate = trimmed.charAt(0).toUpperCase()
          const key: OptionKey = keyCandidate === "B" ? "B" : keyCandidate === "C" ? "C" : "A"
          normalized[streamId] = {
            key,
            label: trimmed.length === 1 ? `Option ${key}` : trimmed,
          }
        }
      }
      setSelectionMap(normalized)
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
    const timerEligible =
      overlayStage === "main" ||
      (overlayStage === "prompt" && overlayStream === "consulting" && consultingPromptMode === "excitedFollowup")

    if (!timerEligible) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      timerStartedRef.current = false
      setTimerVisible(false)
      setTimerProgress(1)
      return
    }

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
  }, [overlayContainer, overlayStream, overlayStage, consultingPromptMode, closeOverlay, router])

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
            pendingMainPlaybackRef.current = false
            selectedOptionRef.current = null
            if (streamId === 'consulting') {
              setOverlayIntroUrl('https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/ExploreYou%20Intro.mp4')
              setOverlayPromptUrl('https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/in%20flight%20option%20for%20excited.mp4')
              setOverlayMidUrl(null)
              setConsultingPromptMode("default")
              setOverlayStage("intro")
              overlayIntroPlayingRef.current = true
              // After prompt, play this specific Airplane Video instead of the default generated clip
              setOverlayVideoUrl('https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Airplane%20Video.mp4')
            } else {
              setOverlayIntroUrl(null)
              setOverlayPromptUrl(null)
              setOverlayMidUrl(null)
              setConsultingPromptMode("default")
              setOverlayStage("main")
              overlayIntroPlayingRef.current = false
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
            const storedSelection = selectionMap[subject]
            const tokenValue = optionToken ? optionToken.replace('Option', '').trim() : null
            const normalizedOption = tokenValue && tokenValue.length > 0 ? tokenValue.charAt(0).toUpperCase() : null
            const optionValue = (normalizedOption ?? storedSelection?.key ?? 'A') as OptionKey
            const labelValue = storedSelection?.label
            const labelSegment = labelValue ? `&label=${encodeURIComponent(labelValue)}` : ""
            router.replace(`/task-simulation/${subject}?option=${optionValue}${labelSegment}`)
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

  const isConsultingStream = overlayStream === "consulting"
  const isIntroStage = overlayStage === "intro"
  const shouldShowOptionBar =
    (overlayStage !== "intro" || (isConsultingStream && isIntroStage)) &&
    !(isConsultingStream && overlayStage === "main")
  const optionConfigs = useMemo<OptionConfig[]>(() => {
    if (!shouldShowOptionBar) return []
    if (!isConsultingStream) {
      return [
        { key: "A", label: "How to Play" },
        { key: "B", label: "Start Simulation" },
      ]
    }
    if (overlayStage === "intro") {
      return [
        { key: "A", label: "How to Play" },
        { key: "B", label: "Start Simulation" },
      ]
    }
    if (overlayStage === "mid") {
      return []
    }
    if (overlayStage === "prompt") {
      if (consultingPromptMode === "excitedFollowup") {
        return [
          { key: "A", label: "Clear Inbox" },
          { key: "B", label: "Review Market Intelligence" },
          { key: "C", label: "Take a Nap" },
        ]
      }
      return [
        { key: "A", label: "I am okay but feeling a bit nervous!" },
        { key: "B", label: "I am really excited! whats next?" },
      ]
    }
    if (overlayStage === "main" && isConsultingStream) {
      return []
    }
    return [
      { key: "A", label: "I am okay but feeling a bit nervous!" },
      { key: "B", label: "I am really excited! whats next?" },
    ]
  }, [shouldShowOptionBar, isConsultingStream, overlayStage, consultingPromptMode])

  const spinnerOverlay = isLoading ? (
    <div className="fixed inset-0 z-[1000100] flex items-center justify-center bg-black/70 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        {pendingStream ? (
          <span className="text-lg font-medium capitalize">
            Preparing {STREAMS.find((stream) => stream.id === pendingStream)?.title ?? pendingStream}
          </span>
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
                      <p className="text-xs text-muted-foreground">Last option: {selectionMap[stream.id].label}</p>
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
                key={`${overlayStream ?? "unknown"}-${overlayStage}`}
                src={
                  overlayStage === "intro" && overlayIntroUrl
                    ? overlayIntroUrl
                    : overlayStage === "prompt" && overlayPromptUrl
                      ? overlayPromptUrl
                      : overlayStage === "mid" && overlayMidUrl
                        ? overlayMidUrl
                        : overlayVideoUrl
                }
                className="h-full w-full object-cover"
                showOptions={false}
                hideControls={false}
                autoplay
                startFullscreen={false}
                registerApi={(api) => {
                  overlayPlayerApiRef.current = {
                    play: api.play,
                    pause: api.pause,
                    element: api.element ?? null,
                  }
                  overlayVideoElementRef.current = api.element ?? null
                  if (overlayStage === "main") {
                    if (pendingMainPlaybackRef.current) {
                      pendingMainPlaybackRef.current = false
                      void api.play().catch(() => undefined)
                    }
                  }
                }}
                trackingConfig={{
                  videoId:
                    overlayStage === "intro"
                      ? `${overlayStream}-intro`
                      : overlayStage === "prompt"
                        ? `${overlayStream}-prompt`
                        : overlayStage === "mid"
                          ? `${overlayStream}-market-intel`
                          : overlayStream ?? "",
                  videoUrl:
                    overlayStage === "intro" && overlayIntroUrl
                      ? overlayIntroUrl
                      : overlayStage === "prompt" && overlayPromptUrl
                        ? overlayPromptUrl
                        : overlayStage === "mid" && overlayMidUrl
                          ? overlayMidUrl
                          : overlayVideoUrl,
                  streamSelected: overlayStream ?? undefined,
                }}
                initialPositionSeconds={overlayStage === "main" ? overlayInitialPosition : null}
                onTrackedEvent={(record, eventName) => {
                  if (record) {
                    overlayLastRecordRef.current = record
                  }
                  if (overlayStage === "intro" && eventName === 'video_completed') {
                    if (overlayPromptUrl) {
                      setConsultingPromptMode("default")
                      setOverlayStage("prompt")
                      overlayIntroPlayingRef.current = true
                    } else {
                      transitionToMainStage()
                    }
                    return
                  }
                  if (overlayStage === "prompt" && eventName === 'video_completed') {
                    transitionToMainStage()
                    return
                  }
                  if (overlayStage === "mid" && eventName === 'video_completed') {
                    transitionToMainStage()
                    return
                  }
                  if (overlayStage === "main" && eventName === 'video_completed') {
                    if (selectedOptionRef.current) {
                      navigateWithOption(selectedOptionRef.current, selectedOptionLabelRef.current)
                    } else {
                      closeOverlay()
                      if (!navigatingRef.current) {
                        router.push("/study-streams")
                      }
                    }
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

            {shouldShowOptionBar && optionConfigs.length > 0 && (
            <div className="pointer-events-auto fixed left-0 right-0 bottom-0 z-[1000003]" style={{ height: "9.5rem" }}>
              <div className="flex h-full w-full items-start bg-black/95">
                {optionConfigs.map((config, index) => {
                  const isSelected = activeOptionKey === config.key
                  return (
                    <Fragment key={config.key}>
                      {index > 0 && <div className="w-px bg-white/20" />}
                      <button
                        aria-label={config.label}
                        className={`flex-1 h-full px-6 py-6 text-xl font-normal tracking-normal md:text-2xl transition-colors flex items-center justify-center text-center ${
                          isSelected
                            ? "bg-white text-black hover:bg-white focus:bg-white"
                            : "bg-transparent text-white hover:bg-white/10"
                        }`}
                        style={{ border: "none" }}
                        onClick={() => handleOptionSelection(config.key)}
                      >
                        <span className="leading-snug">{config.label}</span>
                      </button>
                    </Fragment>
                  )
                })}
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



