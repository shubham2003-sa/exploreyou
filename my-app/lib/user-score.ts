import { resolveUserIdentity } from "@/lib/user-identity"

export interface ScoreSummary {
  totalPoints: number
  totalPossible: number
  scorePercent: number
}

export interface ScoreEventOptions {
  pointsEarned: number
  pointsPossible: number
  source?: string
}

const SCORE_CACHE_PREFIX = "exploreyou.score"
const SCORE_CACHE_TTL_MS = 60_000

function storageAvailable(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function makeCacheKey(userKey: string) {
  return `${SCORE_CACHE_PREFIX}:${userKey}`
}

function getUserKey(identity: { userId: string | null; email: string | null }) {
  return identity.userId ?? (identity.email ? `email:${identity.email}` : "")
}

function readCachedSummary(cacheKey: string): ScoreSummary | null {
  const storage = storageAvailable()
  if (!storage) return null
  try {
    const raw = storage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { value: ScoreSummary; expires: number }
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.expires === "number" && parsed.expires > Date.now() && parsed.value) {
      return parsed.value
    }
  } catch {
    // ignore
  }
  return null
}

function writeCachedSummary(cacheKey: string, value: ScoreSummary) {
  const storage = storageAvailable()
  if (!storage) return
  try {
    storage.setItem(
      cacheKey,
      JSON.stringify({
        value,
        expires: Date.now() + SCORE_CACHE_TTL_MS,
      }),
    )
  } catch {
    // ignore
  }
}

export async function fetchScoreSummary(force = false): Promise<ScoreSummary | null> {
  const identity = await resolveUserIdentity(force)
  if (!identity.userId && !identity.email) {
    return null
  }
  const userKey = getUserKey(identity)
  const cacheKey = userKey ? makeCacheKey(userKey) : null

  if (!force && cacheKey) {
    const cached = readCachedSummary(cacheKey)
    if (cached) {
      return cached
    }
  }

  try {
    const params = new URLSearchParams()
    if (identity.email) {
      params.set("user_email", identity.email)
    }
    const url = params.size ? `/api/scores/me?${params}` : "/api/scores/me"
    const res = await fetch(url, { credentials: "include" })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Request failed with status ${res.status}`)
    }
    const summary = (await res.json()) as ScoreSummary
    if (cacheKey) {
      writeCachedSummary(cacheKey, summary)
    }
    return summary
  } catch (error) {
    console.warn("Failed to fetch score summary", error)
    return null
  }
}

export async function recordScoreEvent(options: ScoreEventOptions): Promise<ScoreSummary | null> {
  const identity = await resolveUserIdentity()
  if (!identity.userId && !identity.email) {
    console.warn("No identity available for score recording")
    return null
  }
  const userKey = getUserKey(identity)
  const cacheKey = userKey ? makeCacheKey(userKey) : null

  try {
    const res = await fetch("/api/scores/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        points_earned: Math.max(0, options.pointsEarned),
        points_possible: Math.max(0, options.pointsPossible),
        source: options.source,
        user_email: identity.email ?? undefined,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Request failed with status ${res.status}`)
    }
    const summary = (await res.json()) as ScoreSummary
    if (cacheKey) {
      writeCachedSummary(cacheKey, summary)
    }
    return summary
  } catch (error) {
    console.warn("Failed to record score event", error)
    if (cacheKey) {
      const cached = readCachedSummary(cacheKey)
      if (cached) {
        return cached
      }
    }
    return null
  }
}
