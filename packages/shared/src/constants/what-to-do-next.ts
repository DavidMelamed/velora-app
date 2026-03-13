/**
 * What To Do Next — Severity-aware situational guidance
 * Provides actionable next steps for crash victims based on crash severity
 */

export interface GuidanceStep {
  title: string
  description: string
  priority: 'critical' | 'important' | 'recommended'
  timeframe: string
}

export interface SeverityGuidance {
  severity: string
  severityLabel: string
  urgencyMessage: string
  steps: GuidanceStep[]
}

export const WHAT_TO_DO_NEXT: Record<string, SeverityGuidance> = {
  FATAL: {
    severity: 'FATAL',
    severityLabel: 'Fatal Crash',
    urgencyMessage: 'We are deeply sorry for your loss. Here are important steps to take.',
    steps: [
      {
        title: 'Contact an attorney immediately',
        description: 'Fatal crashes involve complex legal proceedings. An experienced wrongful death attorney can protect your family\'s rights and handle communications with insurance companies.',
        priority: 'critical',
        timeframe: 'Within 24 hours',
      },
      {
        title: 'Do not speak to insurance adjusters',
        description: 'Insurance companies may contact you quickly. Do not provide recorded statements or sign anything without legal counsel.',
        priority: 'critical',
        timeframe: 'Immediately',
      },
      {
        title: 'Preserve all evidence',
        description: 'Keep the police report, medical records, photos, and any communication related to the crash. Document everything.',
        priority: 'important',
        timeframe: 'Ongoing',
      },
      {
        title: 'Check statute of limitations',
        description: 'Each state has a deadline to file a wrongful death claim. Missing this deadline means losing the right to compensation forever.',
        priority: 'important',
        timeframe: 'Check your state\'s deadline',
      },
      {
        title: 'Seek support',
        description: 'Grief counseling and victim advocacy groups can provide emotional support during this difficult time.',
        priority: 'recommended',
        timeframe: 'When ready',
      },
    ],
  },

  SUSPECTED_SERIOUS_INJURY: {
    severity: 'SUSPECTED_SERIOUS_INJURY',
    severityLabel: 'Serious Injury',
    urgencyMessage: 'Your health comes first. Take these steps to protect yourself.',
    steps: [
      {
        title: 'Seek medical attention',
        description: 'Even if you feel okay, some injuries take hours or days to manifest. Get a full medical evaluation and follow all treatment plans.',
        priority: 'critical',
        timeframe: 'Within 24 hours',
      },
      {
        title: 'Document your injuries',
        description: 'Take photos of all visible injuries. Keep all medical records, bills, and receipts. Start a daily journal of symptoms and pain levels.',
        priority: 'critical',
        timeframe: 'Immediately',
      },
      {
        title: 'Consult a personal injury attorney',
        description: 'Serious injuries often result in significant medical bills and lost wages. An attorney can help ensure you receive fair compensation.',
        priority: 'important',
        timeframe: 'Within 1 week',
      },
      {
        title: 'Report to your insurance',
        description: 'Notify your insurance company about the crash, but stick to facts only. Do not speculate about fault or the extent of your injuries.',
        priority: 'important',
        timeframe: 'Within 48 hours',
      },
      {
        title: 'Follow up on treatment',
        description: 'Attend all follow-up appointments. Gaps in treatment can be used by insurance companies to minimize your claim.',
        priority: 'recommended',
        timeframe: 'Ongoing',
      },
    ],
  },

  SUSPECTED_MINOR_INJURY: {
    severity: 'SUSPECTED_MINOR_INJURY',
    severityLabel: 'Minor Injury',
    urgencyMessage: 'Even minor injuries deserve attention. Here is what to do.',
    steps: [
      {
        title: 'Get checked by a doctor',
        description: 'Minor injuries can become serious if untreated. Whiplash, concussions, and soft tissue injuries often worsen over time.',
        priority: 'important',
        timeframe: 'Within 48 hours',
      },
      {
        title: 'Document everything',
        description: 'Photos of vehicle damage, the crash scene, and your injuries. Save the police report number.',
        priority: 'important',
        timeframe: 'Immediately',
      },
      {
        title: 'Exchange information',
        description: 'Ensure you have the other driver\'s insurance info, license plate, and contact details.',
        priority: 'important',
        timeframe: 'At the scene',
      },
      {
        title: 'File an insurance claim',
        description: 'Report the crash to your insurance. Keep records of all communications.',
        priority: 'recommended',
        timeframe: 'Within 1 week',
      },
      {
        title: 'Consider legal consultation',
        description: 'If your injury affects your ability to work or daily life, a free consultation with an attorney can help you understand your options.',
        priority: 'recommended',
        timeframe: 'Within 2 weeks',
      },
    ],
  },

  POSSIBLE_INJURY: {
    severity: 'POSSIBLE_INJURY',
    severityLabel: 'Possible Injury',
    urgencyMessage: 'You may not feel hurt now, but that can change. Stay vigilant.',
    steps: [
      {
        title: 'Monitor your symptoms',
        description: 'Adrenaline can mask pain. Watch for headaches, neck pain, back pain, numbness, or mood changes over the next few days.',
        priority: 'important',
        timeframe: 'Next 72 hours',
      },
      {
        title: 'See a doctor if symptoms appear',
        description: 'If any new symptoms develop, see a healthcare provider immediately. Early documentation strengthens any future claim.',
        priority: 'important',
        timeframe: 'If symptoms develop',
      },
      {
        title: 'Get the police report',
        description: 'Request a copy of the official crash report from the responding agency. This is key evidence for any claim.',
        priority: 'recommended',
        timeframe: 'Within 1 week',
      },
      {
        title: 'Notify your insurance',
        description: 'Report the crash to your insurance company even if you feel fine. Late reporting can complicate claims.',
        priority: 'recommended',
        timeframe: 'Within 1 week',
      },
      {
        title: 'Keep records',
        description: 'Save photos, the police report, and any communication with the other driver or their insurance.',
        priority: 'recommended',
        timeframe: 'Ongoing',
      },
    ],
  },

  PROPERTY_DAMAGE_ONLY: {
    severity: 'PROPERTY_DAMAGE_ONLY',
    severityLabel: 'Property Damage Only',
    urgencyMessage: 'No injuries reported. Here is how to handle the property damage.',
    steps: [
      {
        title: 'Document the damage',
        description: 'Take detailed photos of all vehicle damage from multiple angles. Include the other vehicle and the crash scene.',
        priority: 'important',
        timeframe: 'At the scene',
      },
      {
        title: 'Exchange information',
        description: 'Get the other driver\'s name, phone, insurance company, policy number, and license plate.',
        priority: 'important',
        timeframe: 'At the scene',
      },
      {
        title: 'File an insurance claim',
        description: 'Report the crash to your insurance. Decide whether to file under your policy (collision) or the other driver\'s (liability).',
        priority: 'important',
        timeframe: 'Within 48 hours',
      },
      {
        title: 'Get repair estimates',
        description: 'Get 2-3 repair estimates. Your insurance may require using their approved shops.',
        priority: 'recommended',
        timeframe: 'Within 1 week',
      },
      {
        title: 'Monitor for late symptoms',
        description: 'Some injuries take days to appear. If you develop any pain or symptoms, see a doctor immediately.',
        priority: 'recommended',
        timeframe: 'Next 2 weeks',
      },
    ],
  },
}

/**
 * Get guidance for a given severity level
 * Falls back to POSSIBLE_INJURY if severity is unknown
 */
export function getGuidanceForSeverity(severity: string | null | undefined): SeverityGuidance {
  if (!severity) return WHAT_TO_DO_NEXT.POSSIBLE_INJURY
  const key = severity.toUpperCase()
  return WHAT_TO_DO_NEXT[key] || WHAT_TO_DO_NEXT.POSSIBLE_INJURY
}
