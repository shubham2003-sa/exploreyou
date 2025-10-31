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

interface AnalysisPrompt {
  title: string
  subtitle?: string
  steps: string[]
}

interface DeliverableTip {
  title: string
  description: string
}

export interface AnalysisScoreDefinition {
  label: string
  value: number
  description?: string
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
  analysisPrompts: AnalysisPrompt[]
  deliverables: string[]
  analysisScores: AnalysisScoreDefinition[]
  tips: DeliverableTip[]
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
  analysisPrompts: [
    {
      title: "Checklist",
      steps: [
        "List two data points you still need.",
        "Draft the headline you would share with the client sponsor.",
      ],
    },
  ],
  deliverables: [
    "Capture the single most important risk and opportunity.",
    "Draft a next-step recommendation aligned to the client's priorities.",
  ],
  analysisScores: [
    { label: "Insight Quality", value: 72 },
    { label: "Client Readiness", value: 68 },
  ],
  tips: [
    {
      title: "Keep It Actionable",
      description: "Every observation should connect to a decision or next step for the client.",
    },
  ],
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
      "First, absorb the critical details from the latest intelligence reports so you can walk into the client room ready.",
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
        "You have less than 48 hours to understand the Starbucks downturn. Comb through the intelligence packet, capture what matters, and translate it into client-ready talking points.",
    },
    sections: [
      {
        title: "Industry Knowledge & Market Conditions (2008)",
        layout: "bullets",
        items: [
          {
            label: "Global Financial Crisis",
            text: "A severe economic recession is underway. Consumer confidence is at an all-time low, making premium purchases feel indulgent.",
          },
          {
            label: "Consumer Spending",
            text: "Customers are cutting back on non-essentials. The “latte factor” becomes shorthand for trimming discretionary spending.",
          },
          {
            label: "Competitive Landscape",
            text: "Fast-food chains like McDonald’s aggressively market cheaper coffee options, chipping away at Starbucks’ premium positioning.",
          },
        ],
      },
      {
        title: "Recent News Clippings & Internal Memos",
        layout: "bullets",
        items: [
          {
            label: "Wall Street Journal",
            text: "“Starbucks stock has fallen over 40% in the last year as growth stalls.”",
          },
          {
            label: "Internal Memo",
            text: "Schultz worries that rapid expansion diluted the “Starbucks Experience,” transforming stores into efficient but less cozy third places.",
          },
          {
            label: "Customer Complaints",
            text: "Year-over-year increase in complaints about cold stores, impersonal service, and breakfast sandwiches overwhelming the coffee aroma.",
          },
        ],
      },
      {
        title: "Signals to Validate",
        layout: "paragraphs",
        items: [
          {
            label: "Traffic Mix",
            text: "Weekday morning commuter visits have softened sharply. Validate whether loyalty members are defecting or visiting less frequently.",
          },
          {
            label: "Store Economics",
            text: "Margins are under pressure from labor hours and occupancy costs. Identify which levers (price, mix, labor scheduling) move fastest.",
          },
          {
            label: "Brand Perception",
            text: "Qualitative research hints that Starbucks feels less “worth the ritual.” Determine which emotional drivers to address immediately.",
          },
        ],
      },
    ],
    analysisPrompts: [
      {
        title: "Step 1 — Diagnose the Situation",
        subtitle: "Summarize what has changed and why it matters.",
        steps: [
          "Draft a one-sentence statement of the client’s problem that incorporates the root cause.",
          "List the two data points you need most to validate your hypothesis.",
          "Highlight one early win the team can deliver within two weeks.",
        ],
      },
      {
        title: "Step 2 — Prioritize Interventions",
        subtitle: "Align actions to value and feasibility.",
        steps: [
          "Map each potential action (menu simplification, store experience refresh, pricing) to effort versus impact.",
          "Select the top initiative and write the client-ready pitch for it.",
          "Identify the key risk if the client hesitates and how you would mitigate it.",
        ],
      },
      {
        title: "Step 3 — Prepare the Client Narrative",
        subtitle: "Translate analysis into an executive-ready storyline.",
        steps: [
          "Outline the three-slide story arc you would present tomorrow morning.",
          "Choose one chart or visual that best communicates the urgency.",
          "Draft the closing ask for the client sponsor, including required resources.",
        ],
      },
    ],
    deliverables: [
      "Capture a punchy, client-facing summary (≤50 words) that frames the problem and the opportunity.",
      "List the two diagnostics you will run tonight to validate the go-forward recommendation.",
      "Outline how you will socialize the findings with the internal Starbucks team before the client check-in.",
    ],
    analysisScores: [
      {
        label: "Insight Synthesis",
        value: 82,
        description: "Connected macroeconomic pressure with store-level execution gaps to form a cohesive narrative.",
      },
      {
        label: "Client Readiness",
        value: 76,
        description: "Prepared a tight, action-oriented brief with concrete asks and stakeholder choreography.",
      },
      {
        label: "Operational Risk Awareness",
        value: 71,
        description: "Identified potential pitfalls around labor scheduling and menu simplification, with mitigation options.",
      },
      {
        label: "Storytelling Clarity",
        value: 88,
        description: "Delivered a crisp executive storyline with a compelling call to action and visuals.",
      },
    ],
    tips: [
      {
        title: "Client Lens",
        description: "Translate every data point into “what the client should do next” to keep the briefing actionable.",
      },
      {
        title: "Time-Boxing",
        description: "You have five minutes. Spend two on synthesis, two on the recommendation, one on risks and next steps.",
      },
    ],
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
    analysisPrompts: override.analysisPrompts ?? base.analysisPrompts,
    deliverables: override.deliverables ?? base.deliverables,
    analysisScores: override.analysisScores ?? base.analysisScores,
    tips: override.tips ?? base.tips,
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

