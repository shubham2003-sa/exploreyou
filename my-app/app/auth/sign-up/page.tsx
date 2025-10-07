"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Header from "@/components/header"
import Link from "next/link"
import { saveAuthProfile } from "@/lib/auth-storage"

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username, email, password }),
      })
      if (!res.ok) {
        let errorMsg = "Sign up failed"
        try {
          const body = await res.clone().json()
          errorMsg = body.detail || errorMsg
        } catch {
          try {
            const body = await res.text()
            if (body) errorMsg = body
          } catch {}
        }
        setError(errorMsg)
        setIsLoading(false)
        return
      }
      saveAuthProfile({ email, name: username })
      router.push("/study-streams")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="SIGN UP" />

      <main className="mx-auto flex max-w-md flex-col items-center justify-center px-8 py-16">
        <h2 className="mb-12 text-center text-2xl font-medium">Create Your Account</h2>

        <form onSubmit={handleSignUp} className="w-full space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-base">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-lg border-2 border-foreground p-3"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border-2 border-foreground p-3"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border-2 border-foreground p-3"
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-base">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-lg border-2 border-foreground p-3"
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full rounded-lg border-2 border-foreground bg-background px-6 py-3 text-foreground hover:bg-muted"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Sign Up"}
            </Button>
          </div>

          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Login
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
