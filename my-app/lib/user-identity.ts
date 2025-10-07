"use client"

import { loadAuthProfile } from "@/lib/auth-storage"
import { createClient } from "@/lib/client"

export interface UserIdentity {
  userId: string | null
  email: string | null
}

const IDENTITY_CACHE_KEY = "exploreyou.identity"
const IDENTITY_CACHE_TTL_MS = 5 * 60 * 1000

let identityPromise: Promise<UserIdentity> | null = null

function readCachedIdentity(): UserIdentity | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(IDENTITY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { value: UserIdentity; expires: number }
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.expires === "number" && parsed.expires > Date.now()) {
      return parsed.value
    }
  } catch {
    // ignore storage errors
  }
  return null
}

function writeCachedIdentity(value: UserIdentity) {
  if (typeof window === "undefined") return
  try {
    const payload = {
      value,
      expires: Date.now() + IDENTITY_CACHE_TTL_MS,
    }
    window.sessionStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

export function clearIdentityCache() {
  identityPromise = null
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(IDENTITY_CACHE_KEY)
    } catch {
      // ignore
    }
  }
}

export async function resolveUserIdentity(forceRefresh = false): Promise<UserIdentity> {
  if (!forceRefresh) {
    const cached = readCachedIdentity()
    if (cached) {
      return cached
    }
    if (identityPromise) {
      return identityPromise
    }
  } else {
    clearIdentityCache()
  }

  identityPromise = (async () => {
    let identity: UserIdentity = { userId: null, email: null }
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getUser()
      if (!error && data?.user) {
        identity = {
          userId: `user:${data.user.id}`,
          email: data.user.email ?? null,
        }
      }
    } catch {
      // ignore supabase errors; fall back to local profile
    }

    if (!identity.userId) {
      const profile = loadAuthProfile()
      if (profile?.email) {
        identity = {
          userId: `email:${profile.email}`,
          email: profile.email,
        }
      }
    }

    writeCachedIdentity(identity)
    return identity
  })()

  return identityPromise
}
