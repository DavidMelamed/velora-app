/**
 * Curated input → output examples for few-shot learning.
 * These serve as "demonstrations" in DSPy terminology.
 */

import type { CrashNarrativeInput, CrashNarrativeOutput } from './crash-narrative'
import type { EqualizerBriefingInput, EqualizerBriefingOutput } from './equalizer-briefing'
import type { PersonaAdapterInput, PersonaAdapterOutput } from './persona-adapter'

// ═══════════════════════════════════════════════════
//  CRASH NARRATIVE EXAMPLES
// ═══════════════════════════════════════════════════

export const narrativeExamples: Array<{
  input: CrashNarrativeInput
  output: CrashNarrativeOutput
}> = [
  {
    input: {
      stateCode: 'CO',
      crashDate: '2025-11-15',
      crashTime: '08:32',
      severity: 'SERIOUS_INJURY',
      county: 'Denver',
      city: 'Denver',
      location: 'I-25 & I-70 interchange',
      mannerOfCollision: 'REAR_END',
      weatherCondition: 'CLEAR',
      lightCondition: 'DAYLIGHT',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 3,
      personCount: 5,
      vehicles: [
        { year: '2022', make: 'Toyota', model: 'Camry', travelDirection: 'NORTHBOUND' },
        { year: '2020', make: 'Ford', model: 'F-150', travelDirection: 'NORTHBOUND' },
        { year: '2019', make: 'Honda', model: 'Civic', travelDirection: 'NORTHBOUND' },
      ],
      injurySummary: '2 serious injuries, 1 minor injury',
      contributingFactors: ['FOLLOWING_TOO_CLOSELY', 'DISTRACTED_DRIVING'],
    },
    output: {
      headline: 'Three-Vehicle Rear-End Crash on I-25/I-70 Interchange in Denver',
      summary: 'A three-vehicle rear-end collision occurred on the I-25 and I-70 interchange in Denver on November 15, 2025 at approximately 8:32 AM. Two people sustained serious injuries and one person had minor injuries.',
      whatHappened: 'The crash involved three northbound vehicles on the I-25/I-70 interchange. The chain-reaction rear-end collision involved a 2022 Toyota Camry, a 2020 Ford F-150, and a 2019 Honda Civic. Contributing factors included following too closely and distracted driving.',
      whereItHappened: 'The crash occurred at the I-25 and I-70 interchange in Denver, Colorado — one of the busiest highway intersections in the Denver metro area. This interchange is known for heavy morning commute traffic and frequent congestion.',
      vehiclesInvolved: 'Three vehicles were involved: a 2022 Toyota Camry, a 2020 Ford F-150, and a 2019 Honda Civic. All three were traveling northbound at the time of the collision.',
      injuriesAndSeverity: 'Five people were involved in the crash. Two sustained serious injuries and one had minor injuries. This crash is classified as a serious injury collision.',
      contributingFactors: 'Investigators identified following too closely and distracted driving as contributing factors. In multi-vehicle rear-end collisions, the following distance between vehicles is a critical factor in determining liability.',
      roadAndWeatherConditions: 'Conditions at the time were clear with daylight visibility and dry road surfaces. Weather and road conditions do not appear to have been contributing factors.',
      whatThisMeansForYou: 'In Colorado, a rear-end collision creates a rebuttable presumption of fault against the following driver. With multiple vehicles involved, liability may be shared among drivers. Colorado uses a modified comparative fault system (50% threshold).',
      nextSteps: 'If you were involved in this crash: 1) Seek medical evaluation even if injuries seem minor. 2) Document your injuries and vehicle damage with photos. 3) Be cautious speaking with insurance adjusters. 4) Colorado has a 3-year statute of limitations for personal injury claims.',
    },
  },
  {
    input: {
      stateCode: 'PA',
      crashDate: '2025-12-03',
      crashTime: '17:45',
      severity: 'FATAL',
      county: 'Philadelphia',
      city: 'Philadelphia',
      location: 'Broad St & Market St',
      mannerOfCollision: 'ANGLE',
      weatherCondition: 'RAIN',
      lightCondition: 'DARK_LIGHTED',
      roadSurfaceCondition: 'WET',
      vehicleCount: 2,
      personCount: 3,
      vehicles: [
        { year: '2021', make: 'Chevrolet', model: 'Malibu', travelDirection: 'SOUTHBOUND' },
        { year: '2023', make: 'BMW', model: 'X5', travelDirection: 'EASTBOUND' },
      ],
      injurySummary: '1 fatal, 1 serious injury',
      contributingFactors: ['TRAFFIC_SIGNAL_VIOLATION', 'EXCESSIVE_SPEED'],
    },
    output: {
      headline: 'Fatal Two-Vehicle Intersection Crash at Broad and Market in Philadelphia',
      summary: 'A fatal crash occurred at the intersection of Broad Street and Market Street in Philadelphia on December 3, 2025 at approximately 5:45 PM. One person was killed and another sustained serious injuries.',
      whatHappened: 'Two vehicles collided at an angle at the intersection of Broad and Market Streets. A southbound 2021 Chevrolet Malibu and an eastbound 2023 BMW X5 were involved. Investigators noted traffic signal violation and excessive speed as contributing factors.',
      whereItHappened: 'The crash occurred at the major intersection of Broad Street and Market Street in Center City Philadelphia. This is a heavily trafficked urban intersection with significant pedestrian and vehicle activity.',
      vehiclesInvolved: 'Two vehicles were involved: a 2021 Chevrolet Malibu traveling southbound and a 2023 BMW X5 traveling eastbound. The angle of collision suggests a T-bone type impact at the intersection.',
      injuriesAndSeverity: 'Three people were involved. One person was fatally injured and one sustained serious injuries. This crash is classified as a fatal collision.',
      contributingFactors: 'A traffic signal violation and excessive speed were identified as contributing factors. Signal violations at busy intersections like Broad and Market significantly increase the risk of severe angle collisions.',
      roadAndWeatherConditions: 'The crash occurred during rain with wet road surfaces and dark but lighted conditions. Wet roads can increase stopping distances, and reduced visibility in rain may have been a factor.',
      whatThisMeansForYou: 'In Pennsylvania, a traffic signal violation is a strong liability indicator. Pennsylvania uses a modified comparative fault system with a 51% threshold. With a fatality involved, this case may involve both insurance claims and potential wrongful death proceedings.',
      nextSteps: 'If you were involved or lost a loved one in this crash: 1) Preserve all evidence and medical records. 2) Do not provide statements to insurance adjusters without legal counsel. 3) Pennsylvania has a 2-year statute of limitations for personal injury and wrongful death claims. 4) Consider consulting a personal injury attorney who handles fatal crash cases.',
    },
  },
  {
    input: {
      stateCode: 'IL',
      crashDate: '2025-10-20',
      severity: 'PROPERTY_DAMAGE_ONLY',
      county: 'Cook',
      city: 'Chicago',
      location: 'Lake Shore Drive & Belmont Ave',
      mannerOfCollision: 'SIDESWIPE_SAME_DIRECTION',
      weatherCondition: 'CLEAR',
      lightCondition: 'DAYLIGHT',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 2,
      personCount: 2,
      vehicles: [
        { year: '2024', make: 'Tesla', model: 'Model 3' },
        { year: '2018', make: 'Nissan', model: 'Altima' },
      ],
    },
    output: {
      headline: 'Two-Vehicle Sideswipe on Lake Shore Drive Near Belmont Avenue',
      summary: 'A property-damage-only sideswipe collision occurred on Lake Shore Drive at Belmont Avenue in Chicago on October 20, 2025. Two vehicles were involved with no reported injuries.',
      whatHappened: 'A sideswipe collision in the same direction occurred between a 2024 Tesla Model 3 and a 2018 Nissan Altima on Lake Shore Drive near Belmont Avenue. No injuries were reported.',
      whereItHappened: 'The crash occurred on Lake Shore Drive at the Belmont Avenue intersection in Chicago, Cook County. Lake Shore Drive is a multi-lane roadway along the lakefront known for lane-change conflicts.',
      vehiclesInvolved: 'A 2024 Tesla Model 3 and a 2018 Nissan Altima were involved in the sideswipe. Both vehicles were traveling in the same direction.',
      injuriesAndSeverity: 'No injuries were reported. This crash is classified as property damage only.',
      contributingFactors: 'No specific contributing factors were documented. Sideswipe collisions often result from lane changes, merging, or drifting between lanes.',
      roadAndWeatherConditions: 'Conditions were clear with daylight visibility and dry roads. Weather and road conditions were favorable at the time of the crash.',
      whatThisMeansForYou: 'Property-damage-only crashes in Illinois may still involve significant vehicle repair costs. The driver who initiated the lane change is typically considered at fault. Illinois uses a modified comparative fault system.',
      nextSteps: 'If you were involved: 1) Document vehicle damage with photos from multiple angles. 2) Exchange insurance information with the other driver. 3) File a claim with your insurance company. 4) Illinois has a 2-year statute of limitations for property damage claims.',
    },
  },
]

// ═══════════════════════════════════════════════════
//  EQUALIZER BRIEFING EXAMPLES
// ═══════════════════════════════════════════════════

export const equalizerExamples: Array<{
  input: EqualizerBriefingInput
  output: EqualizerBriefingOutput
}> = [
  {
    input: {
      crashId: 'ex-001',
      stateCode: 'CO',
      severity: 'SERIOUS_INJURY',
      mannerOfCollision: 'REAR_END',
      crashDate: '2025-11-15',
      cohortSize: 47,
      cohortConfidence: 'HIGH',
      avgSeverity: 'MINOR_INJURY',
      liabilitySignals: [
        {
          type: 'REAR_END_PRESUMPTION',
          description: 'Following driver presumed at fault in rear-end collisions',
          strength: 'STRONG',
          favorsSide: 'PLAINTIFF',
        },
        {
          type: 'FOLLOWING_TOO_CLOSELY',
          description: 'Contributing factor: following too closely',
          strength: 'MODERATE',
          favorsSide: 'PLAINTIFF',
        },
      ],
      settlementRange: { low: 45000, mid: 82000, high: 150000 },
      faultType: 'MODIFIED_50',
      statuteOfLimitations: 3,
    },
    output: {
      situationSummary: 'Based on 47 comparable crashes in Colorado, your rear-end collision with serious injuries places you in a situation where the data strongly suggests liability falls on the following driver. Your crash is more severe than the average comparable case, which typically involves minor injuries.',
      liabilityAnalysis: 'Two strong signals favor your position: Colorado law creates a presumption of fault against the driver who rear-ends another vehicle, and following too closely was identified as a contributing factor. These signals together create a strong foundation for an injury claim.',
      settlementContext: 'Based on comparable cases with similar severity and liability signals, settlements typically range from $45,000 to $150,000, with a midpoint around $82,000. These are estimates based on past cases — your actual outcome depends on specific injuries, medical costs, and other factors.',
      timelinePressure: 'Colorado has a 3-year statute of limitations for personal injury claims. Your deadline is approximately November 15, 2028. However, acting sooner preserves evidence and strengthens your position. Insurance companies may contact you quickly — be prepared.',
      actionItems: [
        'Get a full medical evaluation and follow all treatment recommendations',
        'Do not accept any settlement offers without understanding the full extent of your injuries',
        'Document all medical expenses, lost wages, and how injuries affect daily life',
        'Consult with a personal injury attorney — most offer free consultations',
        'Do not provide recorded statements to the other driver\'s insurance company',
      ],
      confidenceNote: 'This briefing is based on 47 comparable crashes (HIGH confidence). Settlement ranges are statistical estimates, not guarantees. Every crash is unique — consult an attorney for advice specific to your situation.',
    },
  },
  {
    input: {
      crashId: 'ex-002',
      stateCode: 'PA',
      severity: 'MINOR_INJURY',
      mannerOfCollision: 'ANGLE',
      crashDate: '2025-09-10',
      cohortSize: 12,
      cohortConfidence: 'LOW',
      liabilitySignals: [
        {
          type: 'SIGNAL_VIOLATION',
          description: 'Traffic signal violation detected',
          strength: 'STRONG',
          favorsSide: 'PLAINTIFF',
        },
      ],
      settlementRange: { low: 8000, mid: 18000, high: 35000 },
      faultType: 'MODIFIED_51',
      statuteOfLimitations: 2,
    },
    output: {
      situationSummary: 'We found 12 comparable angle collisions in Pennsylvania with minor injuries. While the sample size is smaller than ideal, a traffic signal violation was identified which is a significant liability factor in your favor.',
      liabilityAnalysis: 'A traffic signal violation was detected, which is a strong indicator of fault against the violating driver. In angle collisions at intersections, the driver who ran the signal typically bears primary liability.',
      settlementContext: 'Comparable cases suggest settlements between $8,000 and $35,000, with a midpoint of $18,000. The lower confidence level means these estimates have a wider range than usual. Your actual outcome depends on documented injuries and treatment.',
      timelinePressure: 'Pennsylvania has a 2-year statute of limitations — your deadline is approximately September 10, 2027. This is shorter than many states, so do not delay in seeking medical treatment and legal consultation.',
      actionItems: [
        'Seek medical attention for all injuries, even if they seem minor now',
        'Obtain the police report documenting the traffic signal violation',
        'Keep records of all medical visits, prescriptions, and missed work',
        'Consult an attorney before the 2-year deadline — sooner is better',
      ],
      confidenceNote: 'This briefing is based on only 12 comparable crashes (LOW confidence). The settlement range is less precise due to limited comparable data. Consider this a starting point for understanding your situation, not a definitive analysis.',
    },
  },
]

// ═══════════════════════════════════════════════════
//  PERSONA DETECTION EXAMPLES
// ═══════════════════════════════════════════════════

export const personaExamples: Array<{
  input: PersonaAdapterInput
  output: PersonaAdapterOutput
}> = [
  {
    input: {
      messageText: 'I was just in a car accident on I-25. What should I do?',
      pageContext: 'search',
    },
    output: {
      persona: 'CRASH_VICTIM',
      confidence: 0.95,
      reasoning: 'User says "I was just in" indicating direct involvement, asking for immediate guidance.',
      toneAdjustments: {
        empathyLevel: 'HIGH',
        technicalLevel: 'SIMPLE',
        urgencyLevel: 'HIGH',
        callToAction: 'Are you safe? Here are your immediate next steps.',
      },
    },
  },
  {
    input: {
      messageText: 'My daughter was in a crash last week. How serious is an MMUCC severity of SERIOUS_INJURY?',
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'FAMILY_MEMBER',
      confidence: 0.92,
      reasoning: 'Mentions "my daughter" indicating family relationship, seeking information about a loved one\'s crash.',
      toneAdjustments: {
        empathyLevel: 'HIGH',
        technicalLevel: 'SIMPLE',
        urgencyLevel: 'MEDIUM',
        callToAction: 'Here is what the severity classification means and what steps to consider.',
      },
    },
  },
  {
    input: {
      messageText: 'What is the comparative negligence threshold in Colorado for this type of rear-end collision?',
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'ATTORNEY',
      confidence: 0.88,
      reasoning: 'Uses legal terminology: "comparative negligence", "threshold" — indicates legal professional.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'EXPERT',
        urgencyLevel: 'LOW',
        callToAction: 'Here is the specific legal framework for this case type.',
      },
    },
  },
  {
    input: {
      messageText: 'How many fatal crashes occurred at this intersection in the past year?',
      pageContext: 'search',
    },
    output: {
      persona: 'JOURNALIST',
      confidence: 0.72,
      reasoning: 'Asking for aggregate statistics and patterns — typical of research or journalism queries.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'MODERATE',
        urgencyLevel: 'LOW',
        callToAction: 'Here are the crash statistics and data sources for this location.',
      },
    },
  },
  {
    input: {
      messageText: 'Show me crash trends by severity for Denver metro area',
      pageContext: 'search',
    },
    output: {
      persona: 'RESEARCHER',
      confidence: 0.78,
      reasoning: 'Requesting trend data with analytical framing — characteristic of research queries.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'EXPERT',
        urgencyLevel: 'LOW',
        callToAction: 'Here is the trend analysis with data sources and methodology.',
      },
    },
  },
  {
    input: {
      messageText: 'What coverage applies to a rear-end collision with this damage extent?',
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'INSURANCE_ADJUSTER',
      confidence: 0.80,
      reasoning: 'Asks about "coverage" and "damage extent" — insurance industry terminology.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'EXPERT',
        urgencyLevel: 'LOW',
        callToAction: 'Here is the crash data relevant to coverage determination.',
      },
    },
  },
]

/**
 * Get formatted examples for a specific signature type.
 * Returns examples formatted for few-shot prompting.
 */
export function getFormattedExamples(
  signatureType: 'narrative' | 'equalizer' | 'persona',
  count?: number,
): string {
  const examples =
    signatureType === 'narrative'
      ? narrativeExamples
      : signatureType === 'equalizer'
        ? equalizerExamples
        : personaExamples

  const selected = count ? examples.slice(0, count) : examples

  return selected
    .map(
      (ex, i) =>
        `--- Example ${i + 1} ---\nInput: ${JSON.stringify(ex.input, null, 2)}\nOutput: ${JSON.stringify(ex.output, null, 2)}`,
    )
    .join('\n\n')
}
