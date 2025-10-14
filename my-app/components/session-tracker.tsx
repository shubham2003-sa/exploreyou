"use client"

import { useCallback, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  CURSOR_TARGET_CLEAR_EVENT,
  CURSOR_TARGET_SET_EVENT,
  CursorTargetDefinition,
  CursorTargetEventDetail,
} from "@/lib/cursor-targets"
import { getCursorTargetsForPath } from "@/config/cursor-targets"

type QueuedEvent = {
  event_type: string
  x?: number
  y?: number
  data?: Record<string, unknown>
  ts_ms: number
}

type CursorDwellUpdate = {
  target_key: string
  duration_ms: number
  entry_count: number
  label?: string
  center_x?: number
  center_y?: number
  radius?: number
  metadata?: Record<string, unknown>
}

type CursorTargetState = {
  def: CursorTargetDefinition
  inside: boolean
  enteredAt: number | null
  pendingMs: number
  pendingEntries: number
}

const MIN_CURSOR_BATCH_MS = 250
const DEFAULT_SOURCE_KEY = "__default__"

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()

export default function SessionTracker() {
  const pathname = usePathname()
  const psidRef = useRef<string | null>(null)
  const startRef = useRef<number | null>(null)
  const flushTimerRef = useRef<number | null>(null)
  const queueRef = useRef<QueuedEvent[]>([])
  const prevPathRef = useRef<string | null>(null)

  const targetSourcesRef = useRef(new Map<string, CursorTargetDefinition[]>())
  const cursorStatesRef = useRef(new Map<string, CursorTargetState>())
  const cursorPendingRef = useRef<CursorDwellUpdate[]>([])
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

  const finalizeState = useCallback((state: CursorTargetState) => {
    const now = nowMs()
    if (state.inside && state.enteredAt != null) {
      state.pendingMs += now - state.enteredAt
    }
    const duration = Math.round(state.pendingMs)
    const entries = state.pendingEntries
    if (duration > 0 || entries > 0) {
      cursorPendingRef.current.push({
        target_key: state.def.id,
        duration_ms: duration,
        entry_count: entries,
        label: state.def.label,
        center_x: Math.round(state.def.x),
        center_y: Math.round(state.def.y),
        radius: Math.round(state.def.radius),
        metadata: state.def.metadata,
      })
    }
    state.inside = false
    state.enteredAt = null
    state.pendingMs = 0
    state.pendingEntries = 0
  }, [])

  const markEntered = useCallback((state: CursorTargetState, at: number) => {
    state.inside = true
    state.enteredAt = at
    state.pendingEntries += 1
  }, [])

  const markLeft = useCallback((state: CursorTargetState, at: number) => {
    if (state.enteredAt != null) {
      state.pendingMs += at - state.enteredAt
    }
    state.enteredAt = null
    state.inside = false
  }, [])

  const reconcileTargets = useCallback(
    (targets: CursorTargetDefinition[]) => {
      const prevStates = cursorStatesRef.current
      const nextStates = new Map<string, CursorTargetState>()
      const targetMap = new Map(targets.map((target) => [target.id, target]))
      const timestamp = nowMs()

      prevStates.forEach((state, id) => {
        const nextDef = targetMap.get(id)
        if (!nextDef) {
          finalizeState(state)
          return
        }
        const changed =
          state.def.x !== nextDef.x ||
          state.def.y !== nextDef.y ||
          state.def.radius !== nextDef.radius ||
          state.def.label !== nextDef.label
        if (changed) {
          finalizeState(state)
        }
        state.def = nextDef
        nextStates.set(id, state)
        targetMap.delete(id)
      })

      targetMap.forEach((def, id) => {
        nextStates.set(id, {
          def,
          inside: false,
          enteredAt: null,
          pendingMs: 0,
          pendingEntries: 0,
        })
      })

      cursorStatesRef.current = nextStates

      const pointer = lastPointerRef.current
      if (pointer) {
        nextStates.forEach((state) => {
          const dx = pointer.x - state.def.x
          const dy = pointer.y - state.def.y
          const inside = dx * dx + dy * dy <= state.def.radius * state.def.radius
          if (inside && !state.inside) {
            markEntered(state, timestamp)
          } else if (!inside && state.inside) {
            markLeft(state, timestamp)
          }
        })
      }
    },
    [finalizeState, markEntered, markLeft]
  )

  const gatherCursorUpdates = useCallback(
    (force = false) => {
      const states = cursorStatesRef.current
      if (!states.size) return [] as CursorDwellUpdate[]

      const timestamp = nowMs()
      const updates: CursorDwellUpdate[] = []

      states.forEach((state) => {
        if (state.inside && state.enteredAt != null) {
          state.pendingMs += timestamp - state.enteredAt
          state.enteredAt = force ? null : timestamp
          if (force) {
            state.inside = false
          }
        } else if (force) {
          state.enteredAt = null
          state.inside = false
        }

        const shouldFlush = force || state.pendingMs >= MIN_CURSOR_BATCH_MS || state.pendingEntries > 0
        if (shouldFlush) {
          const duration = Math.round(state.pendingMs)
          const entries = state.pendingEntries
          if (duration > 0 || entries > 0) {
            updates.push({
              target_key: state.def.id,
              duration_ms: duration,
              entry_count: entries,
              label: state.def.label,
              center_x: Math.round(state.def.x),
              center_y: Math.round(state.def.y),
              radius: Math.round(state.def.radius),
              metadata: state.def.metadata,
            })
          }
          state.pendingMs = 0
          state.pendingEntries = 0
        }
      })

      return updates
    },
    []
  )

  const flushQueue = useCallback(
    async (forceCursor = false) => {
      const psid = psidRef.current
      if (!psid) return

      const events = queueRef.current
      queueRef.current = []

      const cursorUpdates = cursorPendingRef.current.concat(gatherCursorUpdates(forceCursor))
      cursorPendingRef.current = []

      if (!events.length && !cursorUpdates.length) {
        return
      }

      if (events.length) {
        try {
          await fetch(`/api/page-sessions/${psid}/events-batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events }),
            keepalive: true,
          })
        } catch {
          queueRef.current.unshift(...events)
        }
      }

      if (cursorUpdates.length) {
        try {
          await fetch(`/api/page-sessions/${psid}/cursor-dwell`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cursorUpdates }),
            keepalive: true,
          })
        } catch {
          cursorPendingRef.current.unshift(...cursorUpdates)
        }
      }
    },
    [gatherCursorUpdates]
  )

  const endSession = useCallback(
    async (useBeacon = false, forceCursorFlush = false) => {
      const psid = psidRef.current
      if (!psid) return
      await flushQueue(forceCursorFlush)
      const endedAt = new Date().toISOString()
      const duration = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : null
      const body = JSON.stringify({ ended_at: endedAt, duration_seconds: duration })
      if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          const blob = new Blob([body], { type: "application/json" })
          navigator.sendBeacon(`/api/page-sessions/${psid}/end`, blob)
        } catch {
          try {
            await fetch(`/api/page-sessions/${psid}/end`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              keepalive: true,
            })
          } catch {
            // ignore
          }
        }
      } else {
        try {
          await fetch(`/api/page-sessions/${psid}/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          })
        } catch {
          // ignore
        }
      }
      psidRef.current = null
      startRef.current = null
    },
    [flushQueue]
  )

  const startSession = useCallback(async (path: string) => {
    startRef.current = Date.now()
    try {
      const res = await fetch("/api/page-sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: path }),
      })
      if (res.ok) {
        const data = await res.json()
        psidRef.current = data.id
      } else {
        psidRef.current = null
      }
    } catch {
      psidRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleSet = (event: Event) => {
      const detail = (event as CustomEvent<CursorTargetEventDetail>).detail
      if (!detail?.sourceId) return
      targetSourcesRef.current.set(detail.sourceId, (detail.targets ?? []).map((target) => ({ ...target })))
      reconcileTargets(Array.from(targetSourcesRef.current.values()).flat())
    }

    const handleClear = (event: Event) => {
      const detail = (event as CustomEvent<CursorTargetEventDetail>).detail
      if (!detail?.sourceId) return
      targetSourcesRef.current.delete(detail.sourceId)
      reconcileTargets(Array.from(targetSourcesRef.current.values()).flat())
    }

    window.addEventListener(CURSOR_TARGET_SET_EVENT, handleSet as EventListener)
    window.addEventListener(CURSOR_TARGET_CLEAR_EVENT, handleClear as EventListener)

    return () => {
      window.removeEventListener(CURSOR_TARGET_SET_EVENT, handleSet as EventListener)
      window.removeEventListener(CURSOR_TARGET_CLEAR_EVENT, handleClear as EventListener)
    }
  }, [reconcileTargets])

  useEffect(() => {
    targetSourcesRef.current.set(
      DEFAULT_SOURCE_KEY,
      getCursorTargetsForPath(pathname).map((target) => ({ ...target }))
    )
    reconcileTargets(Array.from(targetSourcesRef.current.values()).flat())
  }, [pathname, reconcileTargets])

  useEffect(() => {
    let cancelled = false
    const handleNavigation = async () => {
      if (prevPathRef.current && prevPathRef.current !== pathname) {
        await endSession(false, true)
      }
      if (!cancelled) {
        await startSession(pathname)
        if (!cancelled) {
          prevPathRef.current = pathname
        }
      }
    }
    void handleNavigation()

    return () => {
      cancelled = true
    }
  }, [pathname, endSession, startSession])

  // PAUSED: Mouse movement tracking disabled to save memory/bandwidth
  // useEffect(() => {
  //   if (typeof window === "undefined") return

  //   const handleMouseMove = (event: MouseEvent) => {
  //     lastPointerRef.current = { x: event.clientX, y: event.clientY }
  //     const states = cursorStatesRef.current
  //     if (!states.size) return
  //     const timestamp = nowMs()
  //     states.forEach((state) => {
  //       const dx = event.clientX - state.def.x
  //       const dy = event.clientY - state.def.y
  //       const inside = dx * dx + dy * dy <= state.def.radius * state.def.radius
  //       if (inside && !state.inside) {
  //         markEntered(state, timestamp)
  //       } else if (!inside && state.inside) {
  //         markLeft(state, timestamp)
  //       }
  //     })
  //   }

  //   const handleMouseLeave = () => {
  //     const states = cursorStatesRef.current
  //     if (!states.size) return
  //     const timestamp = nowMs()
  //     states.forEach((state) => {
  //       if (state.inside) {
  //         markLeft(state, timestamp)
  //       }
  //     })
  //   }

  //   const handleMouseOut = (event: MouseEvent) => {
  //     if (!event.relatedTarget) {
  //       handleMouseLeave()
  //     }
  //   }

  //   window.addEventListener("mousemove", handleMouseMove)
  //   window.addEventListener("mouseout", handleMouseOut)
  //   window.addEventListener("blur", handleMouseLeave)

  //   return () => {
  //     window.removeEventListener("mousemove", handleMouseMove)
  //     window.removeEventListener("mouseout", handleMouseOut)
  //     window.removeEventListener("blur", handleMouseLeave)
  //   }
  // }, [markEntered, markLeft])

  // PAUSED: Click tracking disabled to save memory/bandwidth
  // useEffect(() => {
  //   const clickHandler = (e: MouseEvent) => {
  //     if (!psidRef.current) return
  //     queueRef.current.push({
  //       event_type: "click",
  //       x: Math.floor(e.clientX),
  //       y: Math.floor(e.clientY),
  //       ts_ms: Date.now(),
  //     })
  //   }

  //   window.addEventListener("click", clickHandler)

  //   return () => {
  //     window.removeEventListener("click", clickHandler)
  //   }
  // }, [])

  // PAUSED: Event queue flushing disabled to save memory/bandwidth
  // useEffect(() => {
  //   flushTimerRef.current = window.setInterval(() => {
  //     void flushQueue()
  //   }, 2000) as unknown as number

  //   return () => {
  //     if (flushTimerRef.current) {
  //       clearInterval(flushTimerRef.current as unknown as number)
  //       flushTimerRef.current = null
  //     }
  //   }
  // }, [flushQueue])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushQueue(true)
      }
    }

    const handleBeforeUnload = () => {
      void endSession(true, true)
    }

    const handlePageHide = () => {
      void endSession(true, true)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [endSession, flushQueue])

  useEffect(() => {
    return () => {
      void endSession(true, true)
    }
  }, [endSession])

  return null
}
