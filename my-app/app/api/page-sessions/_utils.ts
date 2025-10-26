import { createServerClient } from "@supabase/ssr"
import type { NextRequest, NextResponse } from "next/server"
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"

export type CookieUpdate = { name: string; value: string; options?: Partial<ResponseCookie> }

export function assertSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase configuration missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  return { supabaseUrl, supabaseAnonKey }
}

export function makeSupabaseServer(request: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseConfig()
  const cookieUpdates: CookieUpdate[] = []
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(updates: { name: string; value: string; options?: Partial<ResponseCookie> }[]) {
        updates.forEach(({ name, value, options }) => {
          cookieUpdates.push({ name, value, options })
        })
      },
    },
  })
  return { supabase, cookieUpdates }
}

export function applyCookieUpdates(response: NextResponse, updates: CookieUpdate[]) {
  updates.forEach(({ name, value, options }) => {
    const baseOptions: Partial<ResponseCookie> = { ...(options || {}) }
    if (process.env.NODE_ENV !== "production") {
      baseOptions.secure = false
      baseOptions.sameSite = "lax"
    }
    if (!baseOptions.path) {
      baseOptions.path = "/"
    }
    response.cookies.set({ name, value, ...baseOptions })
  })
}

export function parseJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}))
}

export function parseTimestamp(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const fromMs = new Date(value)
    return Number.isNaN(fromMs.getTime()) ? null : fromMs
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  return null
}

export function eventTimestampFromItem(item: Record<string, unknown>): Date {
  const candidate = parseTimestamp(item.ts_ms)
  if (candidate) return candidate
  const fromTimestamp = parseTimestamp(item.timestamp)
  if (fromTimestamp) return fromTimestamp
  const fromEvent = parseTimestamp(item.event_timestamp)
  if (fromEvent) return fromEvent
  return new Date()
}

export function serialiseMetadata(value: unknown) {
  if (value == null) return null
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
