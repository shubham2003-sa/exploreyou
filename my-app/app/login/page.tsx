"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { saveAuthProfile } from "@/lib/auth-storage"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        let message = "Login failed"
        try {
          const body = await res.clone().json()
          message = body.detail || message
        } catch {
          try {
            const text = await res.text()
            if (text) message = text
          } catch {}
        }
        setError(message)
        setIsLoading(false)
        return
      }

      try {
        const profileResponse = await fetch("/api/me", { credentials: "include" })
        if (profileResponse.ok) {
          const data = (await profileResponse.json()) as { email?: string; name?: string } | null
          if (data?.email) {
            saveAuthProfile({ email: data.email, name: data.name ?? null })
          }
        }
      } catch {
        saveAuthProfile({ email })
      }

      router.push("/study-streams")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-4 mt-4 flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-6">
        <h1 className="text-lg font-medium text-gray-900">LOGIN</h1>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-gray-900 hover:bg-gray-100"
            onClick={() => router.push("/")}
          >
            Home
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center justify-center px-8 py-16">
        <h2 className="mb-12 text-center text-2xl font-medium text-gray-900">Enter Your details</h2>

        <form onSubmit={handleLogin} className="w-full space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base text-gray-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border-2 border-gray-300 bg-white p-3 text-gray-900"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base text-gray-700">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border-2 border-gray-300 bg-white p-3 text-gray-900"
              required
            />
          </div>

          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-gray-900 hover:bg-gray-100"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>

          <div className="text-center text-sm text-gray-700">
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="text-blue-600 underline underline-offset-4">
              Sign up
            </Link>
          </div>

          <div className="text-center text-sm text-gray-700">
            <Link href="#" className="text-gray-400 underline underline-offset-4">
              Forgot Password?
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
