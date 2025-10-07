"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { clearAuthProfile, loadAuthProfile, saveAuthProfile, type AuthProfile } from "@/lib/auth-storage"

interface HeaderProps {
  title: string
  variant?: "default" | "on-dark"
}

export default function Header({ title, variant = "default" }: HeaderProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<AuthProfile | null>(null)

  useEffect(() => {
    setProfile(loadAuthProfile())

    let cancelled = false

    const syncSession = async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" })
        if (!res.ok) {
          if (!cancelled) {
            clearAuthProfile()
            setProfile(null)
          }
          return
        }
        const data = (await res.json()) as { email?: string; name?: string } | null
        if (!cancelled && data?.email) {
          const nextProfile: AuthProfile = { email: data.email, name: data.name ?? null }
          saveAuthProfile(nextProfile)
          setProfile(nextProfile)
        }
      } catch {
        if (!cancelled) {
          clearAuthProfile()
          setProfile(null)
        }
      }
    }

    void syncSession()

    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" })
    } catch {
      // ignore network errors on logout
    }
    clearAuthProfile()
    setProfile(null)
    router.push("/")
  }

  const isOnDark = variant === "on-dark"
  const headerClass = `flex items-center justify-between p-6 border-2 rounded-lg mx-4 mt-4 ${isOnDark ? "border-white text-white" : "border-foreground"}`
  const btnClass = `border-2 rounded-lg px-4 py-2 bg-transparent ${isOnDark ? "border-white text-white hover:bg-white/10" : "border-foreground"}`

  return (
    <header className={headerClass}>
      <div>
        <h1 className="text-lg font-medium">{title}</h1>
        {profile?.name && <p className="text-xs opacity-80">Signed in as {profile.name}</p>}
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className={btnClass}
          onClick={() => router.push("/")}
        >
          Home
        </Button>
        {profile ? (
          <Button variant="outline" className={btnClass} onClick={handleLogout}>
            Logout
          </Button>
        ) : (
          <Button variant="outline" className={btnClass} onClick={() => router.push("/login")}
          >
            Login
          </Button>
        )}
      </div>
    </header>
  )
}
