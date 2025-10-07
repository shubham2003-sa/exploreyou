"use client"

import { createClient } from "@/lib/client"

const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET ?? "videos"
const SIGNED_URL_TTL_SECONDS = Number(process.env.NEXT_PUBLIC_SUPABASE_SIGNED_URL_TTL ?? "3600")
const MEMORY_CACHE = new Map<string, { url: string; expiresAt: number }>()
const CACHE_PREFIX = "exploreyou.video-url"
const CACHE_BUFFER_SECONDS = 60

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function makeCacheKey(path: string) {
  return `${CACHE_PREFIX}:${path}`
}

function readCache(path: string): string | null {
  const now = Date.now()
  const cached = MEMORY_CACHE.get(path)
  if (cached && cached.expiresAt > now) {
    return cached.url
  }

  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(makeCacheKey(path))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { url: string; expiresAt: number }
    if (parsed && parsed.expiresAt > now && parsed.url) {
      MEMORY_CACHE.set(path, parsed)
      return parsed.url
    }
  } catch {
    // ignore
  }
  return null
}

function writeCache(path: string, url: string, ttlSeconds: number) {
  const expiresAt = Date.now() + Math.max(30, ttlSeconds) * 1000
  const entry = { url, expiresAt }
  MEMORY_CACHE.set(path, entry)
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(makeCacheKey(path), JSON.stringify(entry))
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Resolve a video URL, applying client-side caching so repeated navigations do
 * not regenerate signed URLs unless they are near expiry.
 */
export async function resolveVideoUrl(
  rawUrl: string | null | undefined,
  fallback?: string,
): Promise<string> {
  const fallbackUrl = fallback ?? (rawUrl ?? "")

  if (!rawUrl) {
    return fallbackUrl
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return fallbackUrl
  }

  const supabase = createClient()

  const normalised = rawUrl
    .replace(/^\/api\//, "/")
    .replace(/^\/?videos\//, "")
    .trim()

  if (!normalised) {
    return fallbackUrl
  }

  const objectPath = decodeURIComponent(normalised.replace(/^\//, ""))
  const cached = readCache(objectPath)
  if (cached) {
    return cached
  }

  try {
    const { data, error } = await supabase.storage
      .from(DEFAULT_BUCKET)
      .createSignedUrl(
        objectPath,
        SIGNED_URL_TTL_SECONDS,
      )

    if (!error && data?.signedUrl) {
      const ttl = Math.max(0, SIGNED_URL_TTL_SECONDS - CACHE_BUFFER_SECONDS)
      writeCache(objectPath, data.signedUrl, ttl)
      return data.signedUrl
    }
  } catch (error) {
    console.warn("[video-url] Failed to create signed URL", error)
  }

  const { data: publicData } = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(objectPath)
  if (publicData?.publicUrl) {
    writeCache(objectPath, publicData.publicUrl, 3600)
    return publicData.publicUrl
  }

  return fallbackUrl
}
