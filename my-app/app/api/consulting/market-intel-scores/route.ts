import { NextRequest, NextResponse } from "next/server"

import {
  applyCookieUpdates,
  ensureClientSessionId,
  makeSupabaseServer,
  parseTimestamp,
} from "@/app/api/page-sessions/_utils"

export const runtime = "nodejs"

const TABLE_NAME = process.env.NEXT_PUBLIC_SUPABASE_MARKET_SCORES_TABLE || "market_intel_scores"

type IncomingStats = {
  clientConfidence?: number
  teamMorale?: number
  qualityOfInsight?: number
  workLifeBalance?: number
}

type IncomingPayload = {
  flowId?: string | null
  nodeId?: string | null
  pageId?: string | null
  reason?: string | null
  stats?: IncomingStats | null
  remainingSeconds?: number | null
  capturedAt?: number | string | null
  metadata?: Record<string, unknown> | null
  pageSessionId?: string | null
}

type StoredScoreRow = {
  id: string
  user_id: string | null
  user_email: string | null
  session_id: string | null
  page_session_id: string | null
  page_id: string | null
  flow_id: string | null
  node_id: string | null
  reason: string | null
  client_confidence: number | null
  team_morale: number | null
  quality_of_insight: number | null
  work_life_balance: number | null
  time_remaining_seconds: number | null
  captured_at: string | null
  metadata: Record<string, unknown> | null
}

const clampScore = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

const parseUuid = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : null
}

const normaliseRow = (row: StoredScoreRow) => ({
  id: row.id,
  flowId: row.flow_id ?? null,
  nodeId: row.node_id ?? null,
  pageId: row.page_id ?? null,
  reason: row.reason ?? null,
  capturedAt: row.captured_at ?? null,
  remainingSeconds:
    typeof row.time_remaining_seconds === "number" ? Math.max(0, row.time_remaining_seconds) : null,
  stats: {
    clientConfidence:
      typeof row.client_confidence === "number" ? Math.max(0, Math.min(100, row.client_confidence)) : null,
    teamMorale: typeof row.team_morale === "number" ? Math.max(0, Math.min(100, row.team_morale)) : null,
    qualityOfInsight:
      typeof row.quality_of_insight === "number" ? Math.max(0, Math.min(100, row.quality_of_insight)) : null,
    workLifeBalance:
      typeof row.work_life_balance === "number" ? Math.max(0, Math.min(100, row.work_life_balance)) : null,
  },
  metadata: row.metadata ?? null,
  pageSessionId: row.page_session_id ?? null,
  sessionId: row.session_id ?? null,
})

export async function GET(request: NextRequest) {
  const { supabase, cookieUpdates } = makeSupabaseServer(request)
  const clientSessionId = ensureClientSessionId(request, cookieUpdates)
  const { searchParams } = new URL(request.url)
  const flowId = searchParams.get("flowId")
  const nodeId = searchParams.get("nodeId")
  const limitParam = Number(searchParams.get("limit") ?? "1")
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, limitParam)) : 1

  const { data: userData } = await supabase.auth.getUser()
  const filters: string[] = []
  if (userData.user?.id) {
    filters.push(`user_id.eq.${userData.user.id}`)
  }
  if (clientSessionId) {
    filters.push(`session_id.eq.${clientSessionId}`)
  }

  let query = supabase.from(TABLE_NAME).select("*").order("captured_at", { ascending: false })
  if (filters.length > 0) {
    query = query.or(filters.join(","))
  }
  if (flowId) {
    query = query.eq("flow_id", flowId)
  }
  if (nodeId) {
    query = query.eq("node_id", nodeId)
  }

  const { data, error } = await query.limit(limit)
  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 })
    applyCookieUpdates(response, cookieUpdates)
    return response
  }

  const payload = (data ?? []).map((row) => normaliseRow(row as StoredScoreRow))
  const response = NextResponse.json(payload, { status: 200 })
  applyCookieUpdates(response, cookieUpdates)
  return response
}

export async function POST(request: NextRequest) {
  const { supabase, cookieUpdates } = makeSupabaseServer(request)
  const clientSessionId = ensureClientSessionId(request, cookieUpdates)

  let body: IncomingPayload
  try {
    body = (await request.json()) as IncomingPayload
  } catch {
    body = {}
  }

  if (!body.stats) {
    const response = NextResponse.json({ error: "stats payload missing" }, { status: 400 })
    applyCookieUpdates(response, cookieUpdates)
    return response
  }

  const { data: userData } = await supabase.auth.getUser()

  const capturedAt = parseTimestamp(body.capturedAt ?? Date.now()) ?? new Date()
  const remainingSeconds =
    typeof body.remainingSeconds === "number" && Number.isFinite(body.remainingSeconds)
      ? Math.max(0, Math.round(body.remainingSeconds))
      : null

  const payload = {
    user_id: userData.user?.id ?? null,
    user_email: userData.user?.email ?? null,
    session_id: parseUuid(clientSessionId),
    page_session_id: parseUuid(body.pageSessionId ?? undefined),
    page_id: body.pageId ?? "career-streams",
    flow_id: body.flowId ?? "consulting",
    node_id: body.nodeId ?? null,
    reason: body.reason ?? null,
    client_confidence: clampScore(body.stats.clientConfidence),
    team_morale: clampScore(body.stats.teamMorale),
    quality_of_insight: clampScore(body.stats.qualityOfInsight),
    work_life_balance: clampScore(body.stats.workLifeBalance),
    time_remaining_seconds: remainingSeconds,
    captured_at: capturedAt.toISOString(),
    metadata: body.metadata ?? null,
  }

  const { error } = await supabase.from(TABLE_NAME).insert(payload)
  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 })
    applyCookieUpdates(response, cookieUpdates)
    return response
  }

  const response = NextResponse.json({ ok: true }, { status: 201 })
  applyCookieUpdates(response, cookieUpdates)
  return response
}
