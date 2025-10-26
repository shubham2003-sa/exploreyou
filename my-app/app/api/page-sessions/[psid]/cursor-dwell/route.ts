import { NextResponse, type NextRequest } from "next/server"

import {
  applyCookieUpdates,
  makeSupabaseServer,
  parseJson,
  parseTimestamp,
  serialiseMetadata,
} from "../../_utils"

export const runtime = "nodejs"

type CursorPayload = {
  target_key?: unknown
  duration_ms?: unknown
  entry_count?: unknown
  label?: unknown
  center_x?: unknown
  center_y?: unknown
  radius?: unknown
  metadata?: unknown
}

export async function POST(request: NextRequest, { params }: { params: { psid: string } }) {
  const psid = params.psid
  if (!psid) {
    return NextResponse.json({ detail: "Missing page session id" }, { status: 400 })
  }

  try {
    const { supabase, cookieUpdates } = makeSupabaseServer(request)
    const body = (await parseJson(request)) as { items?: unknown }
    const rawItems = Array.isArray(body.items) ? (body.items as CursorPayload[]) : []

    const filtered = rawItems
      .map((item) => {
        if (!item || typeof item.target_key !== "string" || !item.target_key.trim()) {
          return null
        }
        const duration = Number(item.duration_ms ?? 0)
        const entries = Number(item.entry_count ?? 0)
        if (!Number.isFinite(duration) || !Number.isFinite(entries)) {
          return null
        }
        if (duration <= 0 && entries <= 0) {
          return null
        }
        return {
          target_key: item.target_key.trim().slice(0, 128),
          duration_ms: Math.max(0, Math.round(duration)),
          entry_count: Math.max(0, Math.round(entries)),
          label: typeof item.label === "string" ? item.label.slice(0, 256) : null,
          center_x:
            typeof item.center_x === "number" && Number.isFinite(item.center_x)
              ? Math.round(item.center_x)
              : null,
          center_y:
            typeof item.center_y === "number" && Number.isFinite(item.center_y)
              ? Math.round(item.center_y)
              : null,
          radius:
            typeof item.radius === "number" && Number.isFinite(item.radius)
              ? Math.round(Math.max(0, item.radius))
              : null,
          metadata: item.metadata,
        }
      })
      .filter((item): item is {
        target_key: string
        duration_ms: number
        entry_count: number
        label: string | null
        center_x: number | null
        center_y: number | null
        radius: number | null
        metadata: unknown
      } => Boolean(item))

    if (!filtered.length) {
      const response = NextResponse.json({ updated: 0 }, { status: 200 })
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const targetKeys = Array.from(new Set(filtered.map((item) => item.target_key)))

    let existing: Record<string, unknown>[] = []
    if (targetKeys.length) {
      const { data, error } = await supabase
        .from("cursor_dwell_metrics")
        .select(
          "target_key,total_duration_ms,total_entries,target_label,center_x,center_y,radius,extra_metadata,first_seen",
        )
        .eq("page_session_id", psid)
        .in("target_key", targetKeys)
      if (error) {
        const response = NextResponse.json(
          { detail: error.message || "Failed to load existing cursor dwell metrics" },
          { status: 500 },
        )
        applyCookieUpdates(response, cookieUpdates)
        return response
      }
      existing = data ?? []
    }

    const existingMap = new Map<string, Record<string, unknown>>()
    existing.forEach((row) => {
      const key = typeof row.target_key === "string" ? row.target_key : null
      if (key) {
        existingMap.set(key, row)
      }
    })

    const now = new Date()
    const nowIso = now.toISOString()

    let durationTotal = 0
    let entryTotal = 0

    const upserts = filtered.map((item) => {
      const previous = existingMap.get(item.target_key) ?? {}
      const prevDuration = Number(previous.total_duration_ms ?? 0)
      const prevEntries = Number(previous.total_entries ?? 0)
      const totalDuration = prevDuration + item.duration_ms
      const totalEntries = prevEntries + item.entry_count
      durationTotal += item.duration_ms
      entryTotal += item.entry_count

      const firstSeenRaw = previous.first_seen ?? null
      const firstSeen = parseTimestamp(firstSeenRaw) ?? now

      return {
        page_session_id: psid,
        target_key: item.target_key,
        target_label: item.label ?? (typeof previous.target_label === "string" ? previous.target_label : null),
        center_x: item.center_x ?? (Number.isFinite(Number(previous.center_x)) ? Number(previous.center_x) : null),
        center_y: item.center_y ?? (Number.isFinite(Number(previous.center_y)) ? Number(previous.center_y) : null),
        radius: item.radius ?? (Number.isFinite(Number(previous.radius)) ? Number(previous.radius) : null),
        extra_metadata:
          item.metadata != null ? serialiseMetadata(item.metadata) : serialiseMetadata(previous.extra_metadata),
        total_duration_ms: totalDuration,
        total_entries: totalEntries,
        first_seen: firstSeen.toISOString(),
        last_updated: nowIso,
      }
    })

    const { error: upsertError } = await supabase
      .from("cursor_dwell_metrics")
      .upsert(upserts, { onConflict: "page_session_id,target_key" })

    if (upsertError) {
      const response = NextResponse.json(
        { detail: upsertError.message || "Failed to upsert cursor dwell metrics" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const { data: authData } = await supabase.auth.getUser()
    const authUser = authData?.user ?? null

    const { data: session, error: sessionError } = await supabase
      .from("page_sessions")
      .select("event_count, last_event_at, user_id, user_email")
      .eq("id", psid)
      .maybeSingle()

    if (sessionError) {
      const response = NextResponse.json(
        { detail: sessionError.message || "Failed to load page session" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    if (!session) {
      const response = NextResponse.json({ detail: "Page session not found" }, { status: 404 })
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const currentEvents = Number(session.event_count ?? 0)
    const lastEvent = parseTimestamp(session.last_event_at) ?? now
    const lastEventIso = (durationTotal || entryTotal ? now : lastEvent).toISOString()

    const updates: Record<string, unknown> = {
      event_count: currentEvents + entryTotal,
      last_event_at: lastEventIso,
    }

    if (authUser && (!session.user_id || session.user_id !== authUser.id || !session.user_email)) {
      updates.user_id = authUser.id
      updates.user_email = authUser.email ?? session.user_email ?? null
    }

    const { error: updateError } = await supabase.from("page_sessions").update(updates).eq("id", psid)
    if (updateError) {
      const response = NextResponse.json(
        { detail: updateError.message || "Failed to update session counters" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const response = NextResponse.json({ updated: upserts.length }, { status: 200 })
    applyCookieUpdates(response, cookieUpdates)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
