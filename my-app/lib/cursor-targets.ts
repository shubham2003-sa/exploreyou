"use client"

import { useEffect, useMemo, useRef } from "react"

export const CURSOR_TARGET_SET_EVENT = "exploreyou:set-cursor-targets"
export const CURSOR_TARGET_CLEAR_EVENT = "exploreyou:clear-cursor-targets"

export type CursorTargetDefinition = {
  id: string
  x: number
  y: number
  radius: number
  label?: string
  metadata?: Record<string, unknown>
}

export type CursorTargetEventDetail = {
  sourceId: string
  targets?: CursorTargetDefinition[]
}

const makeSourceId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `cursor-${Math.random().toString(36).slice(2)}`

export function useCursorTargets(targets: CursorTargetDefinition[] | undefined) {
  const sourceRef = useRef<string>()
  const stableTargets = useMemo(() => targets?.map((target) => ({ ...target })), [targets])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!sourceRef.current) {
      sourceRef.current = makeSourceId()
    }
    const sourceId = sourceRef.current

    if (!stableTargets || stableTargets.length === 0) {
      window.dispatchEvent(
        new CustomEvent<CursorTargetEventDetail>(CURSOR_TARGET_CLEAR_EVENT, {
          detail: { sourceId },
        })
      )
      return () => {
        window.dispatchEvent(
          new CustomEvent<CursorTargetEventDetail>(CURSOR_TARGET_CLEAR_EVENT, {
            detail: { sourceId },
          })
        )
      }
    }

    window.dispatchEvent(
      new CustomEvent<CursorTargetEventDetail>(CURSOR_TARGET_SET_EVENT, {
        detail: { sourceId, targets: stableTargets },
      })
    )

    return () => {
      window.dispatchEvent(
        new CustomEvent<CursorTargetEventDetail>(CURSOR_TARGET_CLEAR_EVENT, {
          detail: { sourceId },
        })
      )
    }
  }, [stableTargets])

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return
      const sourceId = sourceRef.current
      if (sourceId) {
        window.dispatchEvent(
          new CustomEvent<CursorTargetEventDetail>(CURSOR_TARGET_CLEAR_EVENT, {
            detail: { sourceId },
          })
        )
      }
    }
  }, [])
}
