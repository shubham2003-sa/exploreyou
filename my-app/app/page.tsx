"use client"

import React from "react"
import { resolveVideoUrl } from "@/lib/video-url"
import { INTRO_VIDEO_FALLBACK_URL } from "@/lib/video-constants"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import VideoPlayer from "@/components/video-player"

export default function HomePage() {
  const router = useRouter()

  const defaultHeroSource = "videos/ExploreYou Intro.mp4"
  const debugVideo = typeof process !== "undefined" && (process.env.NEXT_PUBLIC_DEBUG_VIDEO === "1" || process.env.NEXT_PUBLIC_DEBUG_VIDEO === "true")

  const [isMuted, setIsMuted] = React.useState(true)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [heroVideoUrl, setHeroVideoUrl] = React.useState<string>(INTRO_VIDEO_FALLBACK_URL)
  const playerApiRef = React.useRef<{ togglePlay: () => Promise<boolean>; setMuted: (muted: boolean) => void; play: () => Promise<boolean>; element?: HTMLVideoElement | null } | null>(null)
  const hasAutoplayedRef = React.useRef(false)

  React.useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const resolved = await resolveVideoUrl(defaultHeroSource, INTRO_VIDEO_FALLBACK_URL)
        if (active) setHeroVideoUrl(resolved || INTRO_VIDEO_FALLBACK_URL)
      } catch {
        if (active) setHeroVideoUrl(INTRO_VIDEO_FALLBACK_URL)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const toggleHeroPlay = async () => {
    const api = playerApiRef.current
    if (!api?.element) return
    
    // Toggle the video directly
    if (api.element.paused) {
      await api.play()
    } else {
      api.element.pause()
    }
    // State will update via onPlaybackChange
  }

  const toggleHeroMute = () => {
    playerApiRef.current?.setMuted(!isMuted)
  }

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="fixed inset-0 -z-10 h-full w-full overflow-hidden">
        <VideoPlayer
          src={heroVideoUrl}
          className="h-full w-full object-cover"
          autoplay={false}
          loop={true}
          poster=""
          showOptions={false}
          startFullscreen={false}
          controlsType={debugVideo ? "default" : "mute-only"}
          hideControls={!debugVideo}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          onPlaybackChange={(playing) => {
            setIsPlaying(playing)
          }}
          registerApi={(api) => {
            playerApiRef.current = {
              togglePlay: api.togglePlay,
              setMuted: api.setMuted,
              play: api.play,
              element: api.element,
            }
            
            // Autoplay on first load
            if (!hasAutoplayedRef.current && api.element) {
              hasAutoplayedRef.current = true
              // Small delay to ensure video is ready
              setTimeout(() => {
                void api.play().then((success) => {
                  // State will be updated via onPlaybackChange
                  console.log('[HomePage] Autoplay result:', success)
                })
              }, 100)
            }
          }}
        />
        <div className="pointer-events-none absolute inset-0 h-full w-full bg-black/60" />
      </div>

      <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-3">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-white bg-white/10 px-5 text-white shadow hover:bg-white/20"
          onClick={() => {
            void toggleHeroPlay()
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-white bg-white/10 px-5 text-white shadow hover:bg-white/20"
          onClick={toggleHeroMute}
        >
          {isMuted ? "Unmute" : "Mute"}
        </Button>
      </div>

      <div className="z-10 mx-4 mt-4 text-white">
        <Header title="ExploreYou Home" variant="on-dark" />
      </div>

      <main className="z-10 mx-auto flex max-w-4xl flex-col items-center justify-center px-8 py-16 text-center text-white">
        <h2 className="mb-8 text-balance text-5xl font-bold text-white md:text-6xl">
          Discover More About Yourself
          <br />
          And Your Journey
        </h2>

        <p className="mb-12 max-w-2xl text-2xl leading-relaxed text-white">
          ExploreYou helps you discover more about yourself and your journey. We bring together creativity, data, and
          technology to make self-exploration simple and meaningful. Our goal is to give you clarity, confidence, and
          inspiration as you grow.
        </p>

        <Button
          size="lg"
          variant="outline"
          className="rounded-lg border-2 border-white bg-transparent px-8 py-3 text-white hover:bg-white/10"
          onClick={async () => {
            let loggedIn = false
            try {
              if (typeof window !== "undefined") {
                const email = localStorage.getItem("userEmail")
                if (email) loggedIn = true
              }
            } catch {}
            if (!loggedIn) {
              try {
                const res = await fetch("/api/me", { credentials: "include" })
                if (res.ok) loggedIn = true
              } catch {}
            }
            router.push(loggedIn ? "/study-streams" : "/login")
          }}
        >
          Start Your Journey
        </Button>
      </main>
    </div>
  )
}

