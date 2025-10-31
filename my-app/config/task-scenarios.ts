export type TaskOptionKey = "A" | "B" | "C" | "DEFAULT"

interface MetricDefinition {
  label: string
  value: number
  colorClass: string
}

interface CalloutDefinition {
  title: string
  description: string
}

interface SectionItem {
  label?: string
  text: string
}

export type SectionLayout = "bullets" | "paragraphs"

interface SectionDefinition {
  title: string
  layout: SectionLayout
  intro?: string
  items: SectionItem[]
}

export interface TaskScenarioContent {
  id: string
  subjectTitle: string
  projectName: string
  activity: string
  heroImageUrl: string
  heroHeading: string
  heroSubheading: string
  metrics: MetricDefinition[]
  timerLabel: string
  timerMinutes: number
  callout: CalloutDefinition
  sections: SectionDefinition[]
  ctaLabel: string
  ctaNotes?: string
  completionScore?: number
}

interface ScenarioDefinition {
  base: TaskScenarioContent
  options?: Partial<Record<TaskOptionKey, Partial<TaskScenarioContent>>>
}

const FALLBACK_SCENARIO: TaskScenarioContent = {
  id: "generic-briefing",
  subjectTitle: "Simulation",
  projectName: "Project Briefing",
  activity: "Activity: Scenario Review",
  heroImageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
  heroHeading: "Work Through the Scenario",
  heroSubheading: "Review the background material and identify the most critical insights before moving forward.",
  metrics: [
    { label: "Momentum", value: 40, colorClass: "bg-sky-400" },
    { label: "Stakeholder Alignment", value: 60, colorClass: "bg-purple-400" },
    { label: "Risk Visibility", value: 35, colorClass: "bg-emerald-400" },
    { label: "Execution Readiness", value: 55, colorClass: "bg-amber-400" },
  ],
  timerLabel: "Analysis Timer",
  timerMinutes: 5,
  callout: {
    title: "First Pass Review",
    description:
      "Work quickly to surface the facts that matter. Flag anything uncertain so you can validate it in the next discussion.",
  },
  sections: [
    {
      title: "Key Context",
      layout: "paragraphs",
      items: [
        {
          text: "Summarize the core situation in no more than three sentences. Focus on what changed, who it impacts, and why the client cares right now.",
        },
      ],
    },
  ],
  ctaLabel: "Begin Data Analysis",
  completionScore: 70,
}

const consultingScenario: ScenarioDefinition = {
  base: {
    id: "consulting-phoenix",
    subjectTitle: "Consulting",
    projectName: "Project: Phoenix (Starbucks 2008)",
    activity: "Activity: Briefing Document Review",
    heroImageUrl:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
    heroHeading: "Analyze Market Intelligence",
  heroSubheading:
      "First, absorb the critical details from the latest intelligence reports.",
  metrics: [
    { label: "Client Confidence", value: 50, colorClass: "bg-sky-400" },
    { label: "Team Morale", value: 50, colorClass: "bg-indigo-400" },
    { label: "Quality of Insight", value: 0, colorClass: "bg-emerald-400" },
      { label: "Work-Life Balance", value: 75, colorClass: "bg-amber-400" },
    ],
    timerLabel: "Market Analysis Timer",
  timerMinutes: 5,
  callout: {
    title: "A Day in the Life: Hitting the Ground Running",
    description:
      "Consultants often have less than 48 hours to get up to speed on a new client and industry. Reviewing briefing materials is the first and most critical step.",
  },
  sections: [
    {
      title: "Industry Knowledge & Market Conditions (2008)",
      layout: "bullets",
      items: [
          {
            label: "Global Financial Crisis",
            text: "A severe economic recession is underway. Consumer confidence is at an all-time low.",
          },
          {
            label: "Consumer Spending",
            text: "Customers are cutting back on non-essential, premium-priced goods. The \"latte factor\" is a common term for daily luxuries to cut.",
          },
          {
            label: "Competitive Landscape",
            text: "Fast-food chains like McDonald's are aggressively marketing cheaper coffee options, directly targeting Starbucks' customer base.",
          },
        ],
      },
      {
        title: "Recent News Clippings & Internal Memos",
        layout: "bullets",
        items: [
          {
            label: "Wall Street Journal",
            text: "\"Starbucks stock has fallen over 40% in the last year as growth stalls.\"",
          },
          {
            label: "Internal Memo",
            text: "\"Schultz expresses concern that rapid expansion has diluted the 'Starbucks Experience,' turning stores into sterile, efficient chains rather than cozy 'third places.'\"",
          },
          {
            label: "Customer Complaints",
            text: "\"Year-over-year increase in complaints about cold stores, impersonal service, and the smell of burnt cheese from breakfast sandwiches overpowering the coffee aroma.\"",
          },
        ],
      },
    ],
    ctaLabel: "Begin Data Analysis",
    completionScore: 81,
  },
}

const SCENARIOS: Record<string, ScenarioDefinition> = {
  consulting: consultingScenario,
}

function mergeScenario(base: TaskScenarioContent, override?: Partial<TaskScenarioContent>): TaskScenarioContent {
  if (!override) return base
  return {
    ...base,
    ...override,
    metrics: override.metrics ?? base.metrics,
    sections: override.sections ?? base.sections,
  }
}

export function getTaskScenario(subject: string | null | undefined, optionKey?: string | null): TaskScenarioContent {
  const normalisedSubject = subject?.toLowerCase() ?? "default"
  const scenarioDefinition = SCENARIOS[normalisedSubject]
  if (!scenarioDefinition) {
    return FALLBACK_SCENARIO
  }
  const upperOption = (optionKey ?? "DEFAULT").toUpperCase() as TaskOptionKey
  const optionOverride = scenarioDefinition.options?.[upperOption]
  return mergeScenario(scenarioDefinition.base, optionOverride)
}
