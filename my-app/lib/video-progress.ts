import { resolveUserIdentity } from "@/lib/user-identity"
export type VideoProgressEventName =
  | "video_started"
  | "video_paused"
  | "video_completed"
  | "next_video_started"
  | "next_video_completed"
  | "task_option_selected"
  | "resume_playback"
  | string

export type TaskStatus = "in_progress" | "completed" | "paused" | string

export interface VideoProgressRecord {
  id: string
  user_id: string
  user_email?: string | null
  video_id: string
  video_url?: string | null
  progress: number
  position_seconds: number
  duration_seconds?: number | null
  stream_selected?: string | null
  task_status?: TaskStatus | null
  event_name?: VideoProgressEventName | null
  last_event_at: string
  updated_at: string
  created_at: string
}

export interface RecordVideoProgressOptions {
  videoId: string
  videoUrl?: string
  progress: number
  positionSeconds: number
  durationSeconds?: number
  streamSelected?: string
  taskStatus?: TaskStatus
  eventName?: VideoProgressEventName
}

export interface FetchVideoProgressOptions {
  videoId?: string
  limit?: number
}

interface CachedProgressEntry {
  record: VideoProgressRecord
  expires: number
}

const CACHE_TTL_MS = 60_000
const CACHE_PREFIX = "exploreyou.progress"

function storageAvailable(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function makeCacheKey(userKey: string, videoId: string) {
  return `${CACHE_PREFIX}:${userKey}:${videoId}`
}

function getUserKey(identity: { userId: string | null; email: string | null }) {
  return identity.userId ?? (identity.email ? `email:${identity.email}` : "")
}

function readCachedRecord(cacheKey: string): VideoProgressRecord | null {
  const storage = storageAvailable()
  if (!storage) return null
  try {
    const raw = storage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedProgressEntry
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.expires === "number" && parsed.expires > Date.now() && parsed.record) {
      return parsed.record as VideoProgressRecord
    }
  } catch {
    // ignore JSON errors
  }
  return null
}

function writeCachedRecord(cacheKey: string, record: VideoProgressRecord) {
  const storage = storageAvailable()
  if (!storage) return
  try {
    const payload: CachedProgressEntry = {
      record,
      expires: Date.now() + CACHE_TTL_MS,
    }
    storage.setItem(cacheKey, JSON.stringify(payload))
  } catch {
    // ignore storage failures
  }
}

export async function recordVideoProgressEvent(options: RecordVideoProgressOptions) {
  const identity = await resolveUserIdentity()
  if (!identity.userId && !identity.email) {
    console.warn("No user identity available for progress tracking")
    return null
  }

  const payload = {
    user_id: identity.userId ?? undefined,
    user_email: identity.email ?? undefined,
    video_id: options.videoId,
    video_url: options.videoUrl ?? undefined,
    progress: Math.max(0, Math.min(1, Number.isFinite(options.progress) ? options.progress : 0)),
    position_seconds: Math.max(0, Number.isFinite(options.positionSeconds) ? options.positionSeconds : 0),
    duration_seconds:
      options.durationSeconds !== undefined && Number.isFinite(options.durationSeconds)
        ? Math.max(0, options.durationSeconds)
        : undefined,
    stream_selected: options.streamSelected ?? undefined,
    task_status: options.taskStatus ?? undefined,
    event_name: options.eventName ?? undefined,
    event_timestamp: new Date().toISOString(),
  }

  try {
    const res = await fetch("/api/video-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Request failed with status ${res.status}`)
    }

    const data = (await res.json()) as VideoProgressRecord
    const userKey = getUserKey(identity)
    if (userKey) {
      writeCachedRecord(makeCacheKey(userKey, options.videoId), data)
    }
    return data
  } catch (error) {
    console.warn("Failed to record video progress", error)
    return null
  }
}

export async function fetchVideoProgress(options: FetchVideoProgressOptions = {}) {
  const identity = await resolveUserIdentity()
  if (!identity.userId && !identity.email) {
    return []
  }

  const params = new URLSearchParams()
  if (identity.userId) params.set("user_id", identity.userId)
  if (identity.email) params.set("user_email", identity.email)
  if (options.videoId) params.set("video_id", options.videoId)
  if (options.limit) params.set("limit", String(options.limit))

  const url = `/api/video-progress?${params.toString()}`

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Request failed with status ${res.status}`)
    }
    const data = (await res.json()) as VideoProgressRecord[]
    if (options.videoId && data.length) {
      const userKey = getUserKey(identity)
      if (userKey) {
        writeCachedRecord(makeCacheKey(userKey, options.videoId), data[0])
      }
    }
    return data
  } catch (error) {
    console.warn("Failed to fetch video progress", error)
    return []
  }
}

export async function fetchLatestProgressForVideo(videoId: string) {
  const identity = await resolveUserIdentity()
  if (!identity.userId && !identity.email) {
    return null
  }
  const userKey = getUserKey(identity)
  if (userKey) {
    const cached = readCachedRecord(makeCacheKey(userKey, videoId))
    if (cached) {
      return cached
    }
  }
  const records = await fetchVideoProgress({ videoId, limit: 1 })
  const latest = records[0] ?? null
  if (userKey && latest) {
    writeCachedRecord(makeCacheKey(userKey, videoId), latest)
  }
  return latest
}
