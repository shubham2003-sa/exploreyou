import React, { useEffect, useState } from "react"

import { loadAuthProfile } from "@/lib/auth-storage"

type UserScore = {
  name: string
  email: string
  score: number
}

const ScorePage: React.FC = () => {
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const profile = loadAuthProfile()
    if (!profile?.email) {
      setError("No user email found. Please log in.")
      setLoading(false)
      return
    }

    let cancelled = false

    const loadScore = async () => {
      try {
        const res = await fetch(`/api/users/${profile.email}`)
        if (!res.ok) {
          throw new Error("Failed to fetch user")
        }
        const data = (await res.json()) as UserScore
        if (!cancelled) {
          setScore(data.score)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch user")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadScore()

    return () => {
      cancelled = true
    }
  }, [])

  const updateScore = async (newScore: number) => {
    const profile = loadAuthProfile()
    if (!profile?.email) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${profile.email}/score`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: newScore }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || "Failed to update score")
      }
      setScore(newScore)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading score...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <h1>Your Score</h1>
      <div style={{ fontSize: 32, margin: "20px 0" }}>{score}</div>
      <button onClick={() => updateScore((score || 0) + 1)}>Add Point</button>
    </div>
  )
}

export default ScorePage
