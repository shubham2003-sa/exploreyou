"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"

type StoredUser = {
  username?: string | null
  email?: string | null
}

export default function ProtectedPage() {
  const router = useRouter()
  const [user, setUser] = useState<StoredUser | null>(null)

  useEffect(() => {
    try {
      const userData = localStorage.getItem("user")
      if (!userData) {
        router.push("/login")
        return
      }
      const parsed = JSON.parse(userData) as StoredUser
      setUser({
        username: parsed.username ?? null,
        email: parsed.email ?? null,
      })
    } catch {
      router.push("/login")
    }
  }, [router])

  if (!user) {
    return <div>Loading...</div>
  }

  const displayName = user.username?.trim() || user.email || "Explorer"

  return (
    <div className="min-h-screen bg-background">
      <Header title="Dashboard" />

      <main className="flex flex-col items-center justify-center px-8 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-medium mb-8 text-center">Welcome, {displayName}!</h2>

        <p className="text-lg text-muted-foreground mb-8 text-center">You have successfully logged in to ExploreYou.</p>

        <div className="flex gap-4">
          <Button
            className="border-2 border-foreground rounded-lg px-6 py-3 bg-background text-foreground hover:bg-muted"
            onClick={() => router.push("/study-streams")}
          >
            Explore Study Streams
          </Button>
        </div>
      </main>
    </div>
  )
}
