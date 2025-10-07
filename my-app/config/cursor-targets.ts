import { CursorTargetDefinition } from "@/lib/cursor-targets"

type ConfigMatcher = string | RegExp | ((path: string) => boolean)

interface ConfigEntry {
  matcher: ConfigMatcher
  targets: CursorTargetDefinition[]
}

const CURSOR_TARGET_CONFIG: ConfigEntry[] = [
  // Example configuration:
  // {
  //   matcher: "/score",
  //   targets: [
  //     { id: "score-chart", x: 512, y: 320, radius: 120, label: "Score Chart" },
  //   ],
  // },
]

const matches = (pathname: string, matcher: ConfigMatcher) => {
  if (typeof matcher === "string") {
    if (matcher.endsWith("*")) {
      const prefix = matcher.slice(0, -1)
      return pathname.startsWith(prefix)
    }
    return pathname === matcher
  }
  if (matcher instanceof RegExp) {
    return matcher.test(pathname)
  }
  return matcher(pathname)
}

export function getCursorTargetsForPath(pathname: string): CursorTargetDefinition[] {
  for (const entry of CURSOR_TARGET_CONFIG) {
    if (matches(pathname, entry.matcher)) {
      return entry.targets
    }
  }
  return []
}
