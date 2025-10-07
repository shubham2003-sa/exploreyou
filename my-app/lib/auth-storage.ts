export type AuthProfile = {
  email: string
  name?: string | null
}

const STORAGE_KEY = "exploreyou.authProfile"

const isBrowser = () => typeof window !== "undefined"

export function saveAuthProfile(profile: AuthProfile) {
  if (!isBrowser()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    localStorage.setItem("userEmail", profile.email)
    if (profile.name) {
      localStorage.setItem("userName", profile.name)
    } else {
      localStorage.removeItem("userName")
    }
  } catch (error) {
    console.warn("Failed to persist auth profile", error)
  }
}

export function loadAuthProfile(): AuthProfile | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthProfile
  } catch {
    return null
  }
}

export function clearAuthProfile() {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userName")
  } catch (error) {
    console.warn("Failed to clear auth profile", error)
  }
}
