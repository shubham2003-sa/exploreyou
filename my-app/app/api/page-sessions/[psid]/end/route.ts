import { NextResponse, type NextRequest } from "next/server"

import {
  applyCookieUpdates,
  makeSupabaseServer,
  parseJson,
  parseTimestamp,
} from "../../_utils"

export const runtime = "nodejs"

function calculateScore(clickCount: number, eventCount: number, durationSeconds: number | null) {
  const clicks = Number.isFinite(clickCount) ? Math.max(clickCount, 0) : 0
  const events = Number.isFinite(eventCount) ? Math.max(eventCount, 0) : 0
  const duration = Number.isFinite(durationSeconds ?? NaN) ? Math.max(durationSeconds ?? 0, 0) : 0
  const durationComponent = Math.min(duration, 3600) / 12
  return clicks * 3 + events * 1.5 + durationComponent
}

export async function POST(request: NextRequest, { params }: { params: { psid: string } }) {
  const psid = params.psid
  if (!psid) {
    return NextResponse.json({ detail: "Missing page session id" }, { status: 400 })
  }

  try {
    const { supabase, cookieUpdates } = makeSupabaseServer(request)
    const body = (await parseJson(request)) as {
      ended_at?: unknown
      duration_seconds?: unknown
    }

    const requestedEndedAt = parseTimestamp(body?.ended_at) ?? new Date()

    const { data: session, error: sessionError } = await supabase
      .from("page_sessions")
      .select("created_at, event_count, click_count, last_event_at")
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

    const createdAt = parseTimestamp(session.created_at)
    const providedDuration = typeof body?.duration_seconds === "number" ? body.duration_seconds : null
    let durationSeconds: number | null = null

    if (typeof providedDuration === "number" && Number.isFinite(providedDuration)) {
      durationSeconds = Math.max(Math.round(providedDuration), 0)
    } else if (createdAt) {
      durationSeconds = Math.max(Math.round((requestedEndedAt.getTime() - createdAt.getTime()) / 1000), 0)
    }

    const lastEvent = parseTimestamp(session.last_event_at) ?? requestedEndedAt
    const updates = {
      ended_at: requestedEndedAt.toISOString(),
      duration_seconds: durationSeconds,
      last_event_at: (lastEvent > requestedEndedAt ? lastEvent : requestedEndedAt).toISOString(),
      score: calculateScore(Number(session.click_count ?? 0), Number(session.event_count ?? 0), durationSeconds),
    }

    const { error: updateError } = await supabase.from("page_sessions").update(updates).eq("id", psid)
    if (updateError) {
      const response = NextResponse.json(
        { detail: updateError.message || "Failed to end page session" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const response = NextResponse.json({ detail: "session ended" }, { status: 200 })
    applyCookieUpdates(response, cookieUpdates)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
