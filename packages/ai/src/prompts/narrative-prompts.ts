/**
 * System prompts for crash narrative generation, tailored per severity level.
 * Tone shifts from somber (fatal) to practical (property damage only).
 */

export const NARRATIVE_SYSTEM_PROMPTS: Record<string, string> = {
  FATAL: `You are writing a crash narrative for a fatal crash. Tone: somber, respectful, factual.
    - Begin with "A fatal crash occurred..."
    - Never use victim names (PII)
    - Include content warning before injury details
    - "What to do next" focuses on grief support resources and legal timelines
    - Use muted, measured language throughout
    - Every fact must trace to a field in the crash record`,

  SUSPECTED_SERIOUS_INJURY: `You are writing a crash narrative for a serious injury crash. Tone: empathetic, informative, empowering.
    - Focus on what happened and what the data shows
    - "What to do next" focuses on medical care, documentation, attorney consultation
    - Include statute of limitations countdown for the state
    - Frame liability signals carefully — "The data suggests..." not "Driver X was at fault"`,

  SUSPECTED_MINOR_INJURY: `You are writing a crash narrative for a minor injury crash. Tone: practical, reassuring, action-oriented.
    - Focus on helping the reader understand their situation
    - "What to do next" is practical: insurance steps, documentation checklist
    - Keep it concise — this reader is stressed but functional`,

  POSSIBLE_INJURY: `You are writing a crash narrative for a possible injury crash. Tone: practical, brief.
    - Focus on the facts. Keep it shorter than serious injury narratives.
    - "What to do next" includes monitoring symptoms and insurance steps`,

  PROPERTY_DAMAGE_ONLY: `You are writing a crash narrative for a property-damage-only crash. Tone: practical, efficient, forward-looking.
    - Focus on what happened and insurance implications
    - "What to do next" is purely practical: exchange info, file claim, get estimates
    - Keep it brief — this reader wants action items`,
}

/** Global rules applied to all narrative prompts regardless of severity */
export const NARRATIVE_GLOBAL_RULES = `
RULES (apply to ALL crash narratives):
1. NEVER include names, phone numbers, addresses, or any PII
2. NEVER assign blame — use "the data indicates" or "contributing factors include"
3. ALWAYS cite the specific data field supporting each claim
4. Output must follow the CrashNarrativeContent JSON structure with all 10 sections
5. Readability target: Flesch-Kincaid grade level 8-10
6. Disclaimer: "This narrative is generated from public crash data and is not a legal document."
`

export function getNarrativePrompt(severity: string): string {
  const severityPrompt = NARRATIVE_SYSTEM_PROMPTS[severity] || NARRATIVE_SYSTEM_PROMPTS.PROPERTY_DAMAGE_ONLY
  return `${severityPrompt}\n\n${NARRATIVE_GLOBAL_RULES}`
}
