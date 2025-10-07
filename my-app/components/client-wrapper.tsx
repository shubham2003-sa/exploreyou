"use client"

import SessionTracker from "@/components/session-tracker"
import ScoreBar from "@/components/score-bar"
import { ScoreProvider } from "@/components/score-provider"
import React from "react"

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ScoreProvider>
      <SessionTracker />
      <ScoreBar />
      {children}
    </ScoreProvider>
  )
}
