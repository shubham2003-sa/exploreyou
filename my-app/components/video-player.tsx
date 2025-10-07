  "use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"

import { Button } from "@/components/ui/button"
import {
  recordVideoProgressEvent,
  TaskStatus,
  VideoProgressEventName,
  VideoProgressRecord,
} from "@/lib/video-progress"

interface PlayerApi {
  play: () => Promise<boolean>
  pause: () => void
  togglePlay: () => Promise<boolean>
  setMuted: (muted: boolean) => void
  element: HTMLVideoElement | null
}

export interface VideoTrackingConfig {
  videoId: string
  videoUrl?: string
  streamSelected?: string
  taskStatus?: TaskStatus
}

interface VideoPlayerProps {
  src: string
  poster?: string
  className?: string
  showOptions?: boolean
  onOptionClick?: (option: string) => void
  autoplay?: boolean
  startFullscreen?: boolean
  controlsType?: "default" | "mute-only"
  showNativeControls?: boolean
  hideControls?: boolean
  isMuted?: boolean
  setIsMuted?: (muted: boolean) => void
  forceMuted?: boolean
  onPlaybackChange?: (playing: boolean) => void
  onMuteChange?: (muted: boolean) => void
  registerApi?: (api: PlayerApi) => void
  trackingConfig?: VideoTrackingConfig
  initialPositionSeconds?: number | null
  onTrackedEvent?: (record: VideoProgressRecord | null, event: VideoProgressEventName) => void
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "00:00"
  }
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function VideoPlayer({
  src,
  poster,
  className = "",
  showOptions = false,
  onOptionClick,
  autoplay = false,
  startFullscreen = false,
  controlsType = "default",
  showNativeControls = false,
  hideControls = false,
  isMuted,
  setIsMuted,
  forceMuted = false,
  onPlaybackChange,
  onMuteChange,
  registerApi,
  trackingConfig,
  initialPositionSeconds = null,
  onTrackedEvent,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hasError, setHasError] = useState(false)

  const hasStartedRef = useRef(false)
  const trackingRef = useRef<VideoTrackingConfig | undefined>(trackingConfig)
  const trackedCallbackRef = useRef(onTrackedEvent)
  const initialSeekAppliedRef = useRef(false)

  const effectiveMuted = useMemo(() => forceMuted || !!isMuted, [forceMuted, isMuted])

  const emitPlayback = useCallback(
    (playing: boolean) => {
      setIsPlaying(playing)
      onPlaybackChange?.(playing)
    },
    [onPlaybackChange],
  )

  const emitMute = useCallback(
    (muted: boolean) => {
      onMuteChange?.(muted)
      setIsMuted?.(muted)
    },
    [onMuteChange, setIsMuted],
  )

  const lastPlayEmitRef = useRef(0)
  const lastPauseEmitRef = useRef(0)

  useEffect(() => {
    trackingRef.current = trackingConfig
  }, [trackingConfig])

  useEffect(() => {
    trackedCallbackRef.current = onTrackedEvent
  }, [onTrackedEvent])

  const sendProgressEvent = useCallback(
    async (eventName: VideoProgressEventName, overrides?: { status?: TaskStatus; position?: number; duration?: number; progress?: number }) => {
      const tracking = trackingRef.current
      if (!tracking) return null
      const video = videoRef.current

      const resolvedDuration = (() => {
        if (overrides?.duration !== undefined && Number.isFinite(overrides.duration)) {
          return overrides.duration
        }
        if (Number.isFinite(duration) && duration > 0) {
          return duration
        }
        if (video?.duration && Number.isFinite(video.duration)) {
          return video.duration
        }
        return undefined
      })()

      const resolvedPosition = (() => {
        if (overrides?.position !== undefined && Number.isFinite(overrides.position)) {
          return overrides.position
        }
        if (video?.currentTime && Number.isFinite(video.currentTime)) {
          return video.currentTime
        }
        return currentTime
      })()

      const derivedProgress = (() => {
        if (overrides?.progress !== undefined && Number.isFinite(overrides.progress)) {
          return overrides.progress
        }
        if (resolvedDuration && resolvedDuration > 0) {
          return Math.min(1, Math.max(0, resolvedPosition / resolvedDuration))
        }
        return 0
      })()

      const inferredStatus: TaskStatus = overrides?.status
        ?? (eventName === "video_completed"
          ? "completed"
          : eventName === "video_paused"
            ? "paused"
            : tracking.taskStatus ?? "in_progress")

      const record = await recordVideoProgressEvent({
        videoId: tracking.videoId,
        videoUrl: tracking.videoUrl ?? src,
        progress: derivedProgress,
        positionSeconds: resolvedPosition,
        durationSeconds: resolvedDuration,
        streamSelected: tracking.streamSelected,
        taskStatus: inferredStatus,
        eventName,
      })

      trackedCallbackRef.current?.(record, eventName)
      return record
    },
    [currentTime, duration, src],
  )

  useEffect(() => {
    if (forceMuted) {
      emitMute(true)
    }
  }, [forceMuted, emitMute])

  const applyInitialSeek = useCallback(() => {
    if (initialPositionSeconds == null || !Number.isFinite(initialPositionSeconds)) {
      return
    }
    if (initialSeekAppliedRef.current) {
      return
    }
    const video = videoRef.current
    if (!video) return

    const durationValue = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration
    if (!durationValue || durationValue <= 0) {
      return
    }

    const clamped = Math.max(0, Math.min(initialPositionSeconds, durationValue - 0.25))
    try {
      video.currentTime = clamped
      setCurrentTime(clamped)
      initialSeekAppliedRef.current = true
    } catch (error) {
      console.warn("Failed to apply initial seek", error)
    }
  }, [duration, initialPositionSeconds])

  useEffect(() => {
    applyInitialSeek()
  }, [applyInitialSeek])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      emitPlayback(true)
      const eventName: VideoProgressEventName = hasStartedRef.current ? "resume_playback" : "video_started"
      hasStartedRef.current = true
      const now = Date.now()
      if (now - (lastPlayEmitRef.current || 0) > 5000) {
        lastPlayEmitRef.current = now
        void sendProgressEvent(eventName, { status: "in_progress" })
      }
    }

    const handlePause = () => {
      emitPlayback(false)
      if (video.ended) {
        return
      }
      const sincePlay = Date.now() - (lastUserPlayTsRef.current || 0)
      if (sincePlay < 800) {
        return
      }
      const now = Date.now()
      if (now - (lastPauseEmitRef.current || 0) > 1000) {
        lastPauseEmitRef.current = now
        void sendProgressEvent("video_paused", { status: "paused" })
      }
    }

    const handleTime = () => {
      setCurrentTime(video.currentTime)
    }

    const handleDuration = () => {
      const nextDuration = Number.isFinite(video.duration) ? video.duration : 0
      setDuration(nextDuration)
      setHasError(false)
      applyInitialSeek()
    }

    const handleCanPlay = () => setHasError(false)
    const handleError = () => setHasError(true)
    const handleEnded = () => {
      emitPlayback(false)
      hasStartedRef.current = false
      const finalDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration
      const finalPosition = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : currentTime
      setCurrentTime(finalPosition)
      void sendProgressEvent("video_completed", {
        status: "completed",
        position: finalPosition,
        duration: finalDuration,
        progress: 1,
      })
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("timeupdate", handleTime)
    video.addEventListener("loadedmetadata", handleDuration)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("error", handleError)
    video.addEventListener("ended", handleEnded)

    video.muted = effectiveMuted
    if (autoplay) {
      // Rely on native 'play'/'pause' events to update state; avoid double state flips
      video.play().catch(() => undefined)
    }

    if (startFullscreen) {
      const container = containerRef.current
      if (container?.requestFullscreen) {
        container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(false))
      }
    }

    return () => {
      video.pause()
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("timeupdate", handleTime)
      video.removeEventListener("loadedmetadata", handleDuration)
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("error", handleError)
      video.removeEventListener("ended", handleEnded)
    }
  }, [applyInitialSeek, autoplay, effectiveMuted, emitPlayback, sendProgressEvent, startFullscreen])

  const togglingRef = useRef(false)
  const lastUserPlayTsRef = useRef(0)

  const attemptPlay = useCallback(async () => {
    const video = videoRef.current
    if (!video) return false
    try {
      const playResult = video.play()
      if (playResult && typeof playResult.then === "function") {
        await playResult
      }
      return !video.paused
    } catch (error) {
      console.warn("Video playback failed", error)
      return false
    }
  }, [])

  const ensurePlayback = useCallback(async () => {
    let attempts = 0
    const maxAttempts = 6
    while (attempts < maxAttempts) {
      const playing = await attemptPlay()
      if (playing) {
        return true
      }
      attempts += 1
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 150)
      })
    }
    return false
  }, [attemptPlay])

  const togglePlay = useCallback(async () => {
    if (togglingRef.current) {
      return !(videoRef.current?.paused ?? true)
    }
    togglingRef.current = true
    const video = videoRef.current
    if (!video) {
      togglingRef.current = false
      return false
    }

    try {
      if (video.paused || video.ended) {
        lastUserPlayTsRef.current = Date.now()
        const success = await ensurePlayback()
        if (!success) {
          emitPlayback(false)
        }
        return success
      }
      video.pause()
      return false
    } finally {
      window.setTimeout(() => {
        togglingRef.current = false
      }, 150)
    }
  }, [emitPlayback, ensurePlayback])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !registerApi) return

    const api: PlayerApi = {
      play: async () => {
        lastUserPlayTsRef.current = Date.now()
        const success = await ensurePlayback()
        if (!success) {
          emitPlayback(false)
        }
        return success
      },
      pause: () => {
        video.pause()
      },
      togglePlay: () => togglePlay(),
      setMuted: (muted: boolean) => {
        video.muted = muted
        emitMute(muted)
      },
      get element() {
        return video
      },
    }

    registerApi(api)
  }, [emitMute, emitPlayback, ensurePlayback, registerApi, togglePlay])

  const handleSeek: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const video = videoRef.current
    if (!video || !duration) return

    const nextTime = (Number(event.target.value) / 100) * duration
    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => setIsFullscreen(false))
      setIsFullscreen(false)
      return
    }

    if (container.requestFullscreen) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(false))
    }
  }

  const handleMuteToggle = () => {
    if (forceMuted) return
    const video = videoRef.current
    const nextMuted = !effectiveMuted
    if (video) {
      video.muted = nextMuted
    }
    emitMute(nextMuted)
  }

  const renderOptions = showOptions && onOptionClick && !hideControls
  const showMuteOverlay = controlsType === "mute-only" && !showNativeControls && !hideControls
  const showDefaultOverlay = controlsType === "default" && !showNativeControls && !hideControls

  return (
    <div ref={containerRef} className={`relative group ${className ?? ""}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-cover rounded-lg"
        muted={effectiveMuted}
        autoPlay={autoplay}
        playsInline
        controls={showNativeControls}
      />

      {hasError && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 text-white">
          <p>Unable to load video.</p>
        </div>
      )}

      {showMuteOverlay && (
        <div className="pointer-events-auto absolute left-1/2 bottom-4 z-[1000002] w-full max-w-4xl -translate-x-1/2 px-4">
          <div className="flex items-center gap-4 rounded-lg bg-black/60 px-4 py-3 text-white backdrop-blur-sm">
            <Button type="button" variant="ghost" className="h-10 w-10 rounded-full bg-white/10 text-white" onClick={() => { void togglePlay() }} aria-label={isPlaying ? "Pause video" : "Play video"}>
              {isPlaying ? "II" : "Play"}
            </Button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={100}
                value={duration ? (currentTime / duration) * 100 : 0}
                onChange={handleSeek}
                className="w-full"
                aria-label="Video progress"
              />
              <div className="mt-1 text-right text-xs text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
            <Button type="button" variant="ghost" className="h-10 w-10 rounded-full bg-white/10 text-white" onClick={handleMuteToggle} aria-label={effectiveMuted ? "Unmute video" : "Mute video"}>
              {effectiveMuted ? "Mute" : "Sound"}
            </Button>
          </div>
        </div>
      )}

      {showDefaultOverlay && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-6 text-white">
          <div className="pointer-events-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" className="rounded-full bg-white/10 text-white" onClick={() => { void togglePlay() }}>
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <span className="text-sm">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" className="rounded-full bg-white/10 text-white" onClick={handleMuteToggle}>
                {effectiveMuted ? "Unmute" : "Mute"}
              </Button>
              <Button type="button" variant="ghost" className="rounded-full bg-white/10 text-white" onClick={toggleFullscreen}>
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </Button>
            </div>
          </div>
          {renderOptions && (
            <div className="pointer-events-auto mt-4 grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => onOptionClick("A")} className="bg-white/10 text-white hover:bg-white/20">
                Option A
              </Button>
              <Button type="button" onClick={() => onOptionClick("B")} className="bg-white/10 text-white hover:bg-white/20">
                Option B
              </Button>
            </div>
          )}
        </div>
      )}

      {renderOptions && !showDefaultOverlay && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-2">
          <Button type="button" onClick={() => onOptionClick("A")} className="bg-white/10 text-white hover:bg-white/20">
            Option A
          </Button>
          <Button type="button" onClick={() => onOptionClick("B")} className="bg-white/10 text-white hover:bg-white/20">
            Option B
          </Button>
        </div>
      )}
    </div>
  )
}
