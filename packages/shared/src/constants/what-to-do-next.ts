/**
 * What To Do Next — Severity-aware guidance for crash victims
 * Maps crash severity levels to actionable step-by-step guidance
 */

export interface GuidanceStep {
  title: string
  description: string
  priority: "critical" | "high" | "medium" | "low"
  timeframe: string
}

export interface SeverityGuidance {
  severity: string
  headline: string
  urgencyLevel: "emergency" | "urgent" | "important" | "informational"
  steps: GuidanceStep[]
}

export const WHAT_TO_DO_NEXT: Record<string, SeverityGuidance> = {
  FATAL: {
    severity: "FATAL",
    headline: "Critical Crash — Immediate Steps",
    urgencyLevel: "emergency",
    steps: [
      { title: "Call 911 Immediately", description: "If not already done, ensure emergency services are on the way.", priority: "critical", timeframe: "Immediately" },
      { title: "Do Not Move Victims", description: "Unless there is immediate danger (fire, oncoming traffic), do not move injured persons.", priority: "critical", timeframe: "Immediately" },
      { title: "Secure the Scene", description: "Turn on hazard lights and set up flares or triangles if available.", priority: "critical", timeframe: "Immediately" },
      { title: "Document Everything", description: "When safe, photograph the scene, vehicles, and road conditions.", priority: "high", timeframe: "At the scene" },
      { title: "Contact a Wrongful Death Attorney", description: "Families should consult an attorney experienced in fatal crash cases. Most offer free consultations.", priority: "high", timeframe: "Within 24-48 hours" },
      { title: "Preserve Evidence", description: "Do not repair vehicles or dispose of any items from the crash scene.", priority: "high", timeframe: "Ongoing" },
      { title: "File a Police Report", description: "Ensure a detailed police report is filed. Request a copy.", priority: "high", timeframe: "Within 24 hours" },
      { title: "Know Your Deadlines", description: "Statute of limitations varies by state. An attorney can advise on your specific deadlines.", priority: "medium", timeframe: "Within 30 days" },
    ],
  },
  SERIOUS_INJURY: {
    severity: "SERIOUS_INJURY",
    headline: "Serious Injury — Important Steps",
    urgencyLevel: "urgent",
    steps: [
      { title: "Seek Medical Attention", description: "Get evaluated by a medical professional even if injuries seem manageable. Some injuries present later.", priority: "critical", timeframe: "Immediately" },
      { title: "Document Your Injuries", description: "Keep records of all medical visits, diagnoses, and treatments.", priority: "high", timeframe: "Ongoing" },
      { title: "File a Police Report", description: "If not done at the scene, file a report as soon as possible.", priority: "high", timeframe: "Within 24 hours" },
      { title: "Photograph Everything", description: "Document vehicle damage, injuries, the scene, and any relevant road conditions.", priority: "high", timeframe: "As soon as possible" },
      { title: "Contact Your Insurance", description: "Report the crash to your insurance company. Provide facts only — do not admit fault.", priority: "high", timeframe: "Within 24-48 hours" },
      { title: "Consult a Personal Injury Attorney", description: "For serious injuries, legal representation can significantly impact your outcome.", priority: "high", timeframe: "Within 1 week" },
      { title: "Keep a Recovery Journal", description: "Document pain levels, limitations, missed work, and emotional impact daily.", priority: "medium", timeframe: "Ongoing" },
      { title: "Do Not Sign Settlements Quickly", description: "Insurance companies may offer fast settlements. Consult an attorney before signing.", priority: "medium", timeframe: "Ongoing" },
    ],
  },
  MINOR_INJURY: {
    severity: "MINOR_INJURY",
    headline: "Minor Injury — Recommended Steps",
    urgencyLevel: "important",
    steps: [
      { title: "Get Checked by a Doctor", description: "Even minor injuries should be evaluated. Whiplash and concussions can appear days later.", priority: "high", timeframe: "Within 24-48 hours" },
      { title: "Exchange Information", description: "Get names, contact info, insurance details, and license plates from all parties involved.", priority: "high", timeframe: "At the scene" },
      { title: "File a Police Report", description: "A police report creates an official record of the crash.", priority: "high", timeframe: "Within 24 hours" },
      { title: "Take Photos", description: "Photograph all vehicles, the intersection, traffic signs, and any visible injuries.", priority: "high", timeframe: "At the scene" },
      { title: "Notify Your Insurance", description: "Report the crash and provide factual information.", priority: "medium", timeframe: "Within 48 hours" },
      { title: "Track Medical Expenses", description: "Keep receipts for all medical visits, medications, and therapy.", priority: "medium", timeframe: "Ongoing" },
      { title: "Consider Legal Advice", description: "If the other party was at fault, a consultation (usually free) can help you understand your options.", priority: "low", timeframe: "Within 2 weeks" },
    ],
  },
  PDO: {
    severity: "PDO",
    headline: "Property Damage Only — Next Steps",
    urgencyLevel: "informational",
    steps: [
      { title: "Check for Injuries", description: "Ensure all parties are uninjured. Adrenaline can mask symptoms.", priority: "high", timeframe: "At the scene" },
      { title: "Move to Safety", description: "If vehicles are driveable, move them to the shoulder or a safe location.", priority: "high", timeframe: "At the scene" },
      { title: "Exchange Information", description: "Get insurance info, driver license numbers, and contact details.", priority: "high", timeframe: "At the scene" },
      { title: "Document the Damage", description: "Photograph all vehicle damage from multiple angles.", priority: "high", timeframe: "At the scene" },
      { title: "File a Police Report", description: "Many states require reports even for property-damage-only crashes.", priority: "medium", timeframe: "Within 24 hours" },
      { title: "Contact Your Insurance", description: "File a claim with your insurance company.", priority: "medium", timeframe: "Within 48 hours" },
      { title: "Get Repair Estimates", description: "Get at least two repair estimates before authorizing work.", priority: "low", timeframe: "Within 1 week" },
    ],
  },
}

/**
 * Get guidance for a given severity level
 */
export function getGuidanceForSeverity(severity: string | null | undefined): SeverityGuidance {
  const key = severity?.toUpperCase() || ""
  if (key === "FATAL") return WHAT_TO_DO_NEXT.FATAL\!
  if (key.includes("SERIOUS")) return WHAT_TO_DO_NEXT.SERIOUS_INJURY\!
  if (key.includes("MINOR") || key.includes("POSSIBLE")) return WHAT_TO_DO_NEXT.MINOR_INJURY\!
  return WHAT_TO_DO_NEXT.PDO\!
}
