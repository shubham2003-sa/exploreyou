"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import VideoPlayer from "@/components/video-player"
import { STUDY_STREAMS_VIDEO_FALLBACK_URL } from "@/lib/video-constants"
import { resolveVideoUrl } from "@/lib/video-url"

type FlowChoice = {
  label: string
  next?: string
  isCorrect?: boolean
  feedbackHtml?: string
}

type FlowOverlay = {
  html?: string
  label?: string
}

type BaseFlowNode = {
  title: string
  notes?: string
  choices?: FlowChoice[]
}

type VideoFlowNode = BaseFlowNode & {
  type: "video" | "sim"
  video?: string
  overlays?: FlowOverlay[]
  autoNext?: string | null
}

type QuizFlowNode = BaseFlowNode & {
  type: "quiz"
  question: string
  options: FlowChoice[]
}

type MessageFlowNode = BaseFlowNode & {
  type: "message"
  html?: string
}

type FlowNode = VideoFlowNode | QuizFlowNode | MessageFlowNode

type FlowDefinition = {
  id: string
  title: string
  start: string
  nodes: Record<string, FlowNode>
}

type CareerFlowRunnerProps = {
  subject: string
  className?: string
}

type VideoState =
  | { status: "idle"; url: string; missing: boolean }
  | { status: "loading"; url: string; missing: boolean }
  | { status: "ready"; url: string; missing: boolean }

function isPlaceholder(value?: string | null): boolean {
  return !value || /^PASTE_/i.test(value.trim())
}

function isLikelyHtml(value: string): boolean {
  const trimmed = value.trim()
  return /^</.test(trimmed) && /<\/?[a-z]/i.test(trimmed)
}

function FlowHtmlContent({ html }: { html?: string }) {
  if (!html || isPlaceholder(html)) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        HTML overlay pending. Add content to flow.json to replace this placeholder.
      </div>
    )
  }

  if (isLikelyHtml(html)) {
    return (
      <div
        className="prose prose-sm max-w-none rounded-lg border border-slate-200 bg-white px-4 py-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  if (/\.html?$/i.test(html) || /^https?:\/\//i.test(html)) {
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={html}
          title="flow-overlay"
          className="h-72 w-full rounded-lg border border-slate-200"
          loading="lazy"
        />
        <p className="text-xs text-slate-500">
          Embedded overlay sourced from <span className="break-all font-medium text-slate-600">{html}</span>
        </p>
      </div>
    )
  }

  return (
    <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      {html}
    </pre>
  )
}

function useResolvedVideoSource(source: string | undefined) {
  const [state, setState] = useState<VideoState>({
    status: "idle",
    url: STUDY_STREAMS_VIDEO_FALLBACK_URL,
    missing: true,
  })

  useEffect(() => {
    if (!source || isPlaceholder(source)) {
      setState({
        status: "idle",
        url: STUDY_STREAMS_VIDEO_FALLBACK_URL,
        missing: true,
      })
      return
    }

    let cancelled = false
    setState({ status: "loading", url: STUDY_STREAMS_VIDEO_FALLBACK_URL, missing: false })

    const resolve = async () => {
      try {
        const resolved = await resolveVideoUrl(source, STUDY_STREAMS_VIDEO_FALLBACK_URL)
        if (!cancelled) {
          setState({ status: "ready", url: resolved ?? STUDY_STREAMS_VIDEO_FALLBACK_URL, missing: false })
        }
      } catch (error) {
        console.warn("[career-flow] Failed to resolve video", error)
        if (!cancelled) {
          setState({ status: "ready", url: STUDY_STREAMS_VIDEO_FALLBACK_URL, missing: false })
        }
      }
    }

    void resolve()

    return () => {
      cancelled = true
    }
  }, [source])

  return state
}

export function CareerFlowRunner({ subject, className }: CareerFlowRunnerProps) {
  const [flow, setFlow] = useState<FlowDefinition | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const autoNextTargetRef = useRef<string | null>(null)
  const autoAdvanceTriggeredRef = useRef(false)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    if (!subject) {
      setFlow(null)
      setActiveNodeId(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const fetchFlow = async () => {
      try {
        const response = await fetch(`/api/career-flow/${subject}`)
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error ?? `Unable to load ${subject} flow`)
        }
        const parsed = (await response.json()) as FlowDefinition
        if (!cancelled) {
          setFlow(parsed)
          setActiveNodeId(parsed.start ?? null)
          setHistory([])
          autoNextTargetRef.current = null
          autoAdvanceTriggeredRef.current = false
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[career-flow] Failed to load flow", err)
          setError(err instanceof Error ? err.message : "Failed to load flow data")
          setFlow(null)
          setActiveNodeId(null)
          autoNextTargetRef.current = null
          autoAdvanceTriggeredRef.current = false
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchFlow()
    return () => {
      cancelled = true
    }
  }, [subject])

  const activeNode = useMemo<FlowNode | null>(() => {
    if (!flow || !activeNodeId) return null
    return flow.nodes[activeNodeId] ?? null
  }, [flow, activeNodeId])

  const resolvedVideo = useResolvedVideoSource(
    activeNode && (activeNode.type === "video" || activeNode.type === "sim") ? activeNode.video : undefined,
  )

  const handleNavigate = useCallback(
    (nextId?: string) => {
      if (!nextId || !flow?.nodes[nextId]) {
        return
      }
      setHistory((prev) => (activeNodeId ? [...prev, activeNodeId] : prev))
      setActiveNodeId(nextId)
      autoNextTargetRef.current = null
      autoAdvanceTriggeredRef.current = false
    },
    [activeNodeId, flow?.nodes],
  )

  const handleRestart = useCallback(() => {
    if (!flow) return
    setActiveNodeId(flow.start ?? null)
    setHistory([])
    autoNextTargetRef.current = null
    autoAdvanceTriggeredRef.current = false
  }, [flow])

  const handleBack = useCallback(() => {
    setHistory((prev) => {
      if (!prev.length) return prev
      const nextHistory = [...prev]
      const previous = nextHistory.pop()
      if (previous) {
        setActiveNodeId(previous)
      }
      return nextHistory
    })
  }, [])

  useEffect(() => {
    autoAdvanceTriggeredRef.current = false
    if (!activeNode || (activeNode.type !== "video" && activeNode.type !== "sim")) {
      autoNextTargetRef.current = null
      return
    }
    const hasChoices =
      Array.isArray(activeNode.choices) && activeNode.choices.some((choice) => Boolean(choice?.next))
    if (!hasChoices && "autoNext" in activeNode && activeNode.autoNext) {
      autoNextTargetRef.current = activeNode.autoNext
    } else {
      autoNextTargetRef.current = null
    }
  }, [activeNode])

  const renderChoices = useCallback(
    (choices: FlowChoice[] | undefined) => {
      if (!choices || choices.length === 0) {
        return (
          <p className="text-sm text-slate-500">No further branches configured. Use restart to explore again.</p>
        )
      }

      return (
        <div className="flex flex-col gap-2">
          {choices.map((choice) => (
            <Button
              key={choice.label}
              className="justify-start rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-100"
              onClick={() => handleNavigate(choice.next)}
            >
              {choice.label}
              {choice.isCorrect ? (
                <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Correct
                </span>
              ) : null}
            </Button>
          ))}
        </div>
      )
    },
    [handleNavigate],
  )

  const renderNodeContent = () => {
    if (!activeNode) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          Flow node not available. Please add entries to <code className="font-mono">flow.json</code>.
        </div>
      )
    }

    const nodeBadge = (
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Node: <span className="font-semibold text-slate-500">{activeNodeId}</span>
      </div>
    )

    if (activeNode.type === "quiz") {
      return (
        <div className="space-y-4">
          {nodeBadge}
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{activeNode.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{activeNode.question}</p>
          </div>
          {renderChoices(activeNode.options)}
        </div>
      )
    }

    if (activeNode.type === "message") {
      return (
        <div className="space-y-4">
          {nodeBadge}
          <h3 className="text-lg font-semibold text-slate-900">{activeNode.title}</h3>
          <FlowHtmlContent html={activeNode.html} />
          {renderChoices(activeNode.choices)}
        </div>
      )
    }

    // video or sim
    return (
      <div className="space-y-4">
        {nodeBadge}
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-slate-900">{activeNode.title}</h3>
          {activeNode.type === "sim" ? (
            <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">Simulation</span>
          ) : null}
          {activeNode.notes ? <p className="text-sm text-slate-500">{activeNode.notes}</p> : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <VideoPlayer
            src={resolvedVideo.url}
            className="h-full w-full"
            showOptions={false}
            hideControls={false}
            autoplay
            startFullscreen={false}
            trackingConfig={{
              videoId: `${subject}:${activeNodeId ?? "unknown"}`,
              videoUrl: resolvedVideo.url,
              streamSelected: subject,
            }}
            onTrackedEvent={(_, eventName) => {
              if (eventName === "video_completed" && autoNextTargetRef.current && !autoAdvanceTriggeredRef.current) {
                autoAdvanceTriggeredRef.current = true
                const target = autoNextTargetRef.current
                autoNextTargetRef.current = null
                if (target) {
                  handleNavigate(target)
                }
              }
            }}
          />
        </div>
        {resolvedVideo.missing ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Video link not configured yet. Update the <code className="font-mono">{activeNodeId}</code> node in
            <code className="font-mono"> flow.json</code> to add the correct file.
          </p>
        ) : null}
        {activeNode.overlays && activeNode.overlays.length > 0 ? (
          <div className="space-y-3">
            {activeNode.overlays.map((overlay, index) => (
              <div key={overlay.label ?? overlay.html ?? index} className="space-y-2">
                {overlay.label ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{overlay.label}</p>
                ) : null}
                <FlowHtmlContent html={overlay.html} />
              </div>
            ))}
          </div>
        ) : null}
        {renderChoices(activeNode.choices)}
      </div>
    )
  }

  if (error) {
    return null
  }

  if (!flow && !loading) {
    return null
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            {flow?.title ?? `Simulation Flow${subject ? ` • ${subject}` : ""}`}
          </h2>
          <p className="text-sm text-slate-500">
            Step through the interactive exercise. Links marked as pending still require video or HTML assets.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleBack} disabled={!history.length}>
            Back
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRestart} disabled={!flow}>
            Restart
          </Button>
        </div>
      </div>
      <div className="space-y-4 px-6 py-5">
        {loading ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-600">
            <span className="h-3 w-3 animate-ping rounded-full bg-indigo-500" />
            Loading flow definition…
          </div>
        ) : (
          renderNodeContent()
        )}
      </div>
    </Card>
  )
}
