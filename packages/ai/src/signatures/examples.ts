/**
 * 20+ examples for few-shot learning.
 */

import type { CrashNarrativeInput, CrashNarrativeOutput } from './crash-narrative'
import type { EqualizerBriefingInput, EqualizerBriefingOutput } from './equalizer-briefing'
import type { PersonaAdapterInput, PersonaAdapterOutput } from './persona-adapter'

export const narrativeExamples: Array<{ input: CrashNarrativeInput; output: CrashNarrativeOutput }> = [
  {
    input: {
      stateCode: 'CO',
      crashDate: '2024-11-15',
      crashTime: '08:22',
      severity: 'SERIOUS_INJURY',
      county: 'Denver',
      city: 'Denver',
      location: 'I-25 and Alameda Ave',
      mannerOfCollision: 'REAR_END',
      weatherCondition: 'CLEAR',
      lightCondition: 'DAYLIGHT',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 3,
      personCount: 5,
      vehicles: [
        { year: '2022', make: 'Toyota', model: 'Camry', bodyType: 'SEDAN', travelDirection: 'NORTH', damageExtent: 'SEVERE' },
        { year: '2020', make: 'Honda', model: 'CR-V', bodyType: 'SUV', travelDirection: 'NORTH', damageExtent: 'MODERATE' },
        { year: '2021', make: 'Ford', model: 'F-150', bodyType: 'PICKUP', travelDirection: 'NORTH', damageExtent: 'MINOR' },
      ],
      injurySummary: '2 transported to hospital with non-life-threatening injuries',
      contributingFactors: ['FOLLOWING_TOO_CLOSELY', 'DISTRACTED_DRIVING'],
    },
    output: {
      headline: 'Three-Vehicle Rear-End Collision on I-25 Near Alameda in Denver',
      summary: 'A three-vehicle rear-end collision occurred on I-25 near the Alameda Avenue interchange in Denver on November 15, 2024, during morning rush hour. Two people were transported to a hospital with non-life-threatening injuries.',
      whatHappened: 'At approximately 8:22 AM, a chain-reaction rear-end collision involved three northbound vehicles on Interstate 25. The initial impact occurred between the rear vehicle and the middle vehicle, pushing it into the lead vehicle. Contributing factors included following too closely and distracted driving.',
      whereItHappened: 'The crash occurred on northbound I-25 near the Alameda Avenue interchange in Denver, Colorado. This stretch of I-25 is a heavily traveled corridor, particularly during morning commute hours.',
      vehiclesInvolved: 'Three vehicles were involved: a 2022 Toyota Camry sedan sustained severe damage, a 2020 Honda CR-V SUV sustained moderate damage, and a 2021 Ford F-150 pickup truck sustained minor damage. All vehicles were traveling northbound at the time of the collision.',
      injuriesAndSeverity: 'Five people were involved in the crash. Two individuals were transported to a nearby hospital with injuries described as non-life-threatening. This crash is classified as a serious injury collision.',
      contributingFactors: 'Investigators identified following too closely and distracted driving as contributing factors. Rear-end collisions involving multiple vehicles often indicate a chain reaction caused by insufficient following distance.',
      roadAndWeatherConditions: 'Conditions at the time of the crash were clear with daylight visibility and dry road surfaces. Weather and road conditions do not appear to have been contributing factors.',
      whatThisMeansForYou: 'If you were involved in this crash, you may be dealing with vehicle repairs, medical bills, and insurance claims. In Colorado, rear-end collisions often create a presumption of fault against the following driver, which may affect how insurance companies handle claims.',
      nextSteps: 'Document your injuries and vehicle damage with photos. Seek medical attention even if you feel fine, as some injuries appear days later. Contact your insurance company to file a claim. Consider consulting with a personal injury attorney, especially if you have medical bills. Keep records of all expenses related to the crash.',
    },
  },
  {
    input: {
      stateCode: 'PA',
      crashDate: '2024-10-03',
      severity: 'FATAL',
      county: 'Montgomery',
      city: 'Norristown',
      mannerOfCollision: 'HEAD_ON',
      weatherCondition: 'RAIN',
      lightCondition: 'DARK_LIGHTED',
      roadSurfaceCondition: 'WET',
      vehicleCount: 2,
      personCount: 3,
      vehicles: [
        { year: '2019', make: 'Chevrolet', model: 'Malibu', bodyType: 'SEDAN', travelDirection: 'EAST', damageExtent: 'DESTROYED' },
        { year: '2023', make: 'Subaru', model: 'Outback', bodyType: 'WAGON', travelDirection: 'WEST', damageExtent: 'SEVERE' },
      ],
      contributingFactors: ['CROSSED_CENTER_LINE', 'WET_ROAD'],
    },
    output: {
      headline: 'Fatal Head-On Collision in Norristown During Rainy Conditions',
      summary: 'A fatal head-on collision occurred in Norristown, Montgomery County, Pennsylvania on October 3, 2024. The crash involved two vehicles traveling in opposite directions on a wet roadway during nighttime hours.',
      whatHappened: 'Two vehicles collided head-on when one vehicle crossed the center line. The 2019 Chevrolet Malibu, traveling eastbound, and the 2023 Subaru Outback, traveling westbound, impacted each other directly. Contributing factors included crossing the center line and wet road conditions.',
      whereItHappened: 'The crash occurred in Norristown, Montgomery County, Pennsylvania. The specific roadway involved two-way traffic where vehicles traveled in opposite directions.',
      vehiclesInvolved: 'A 2019 Chevrolet Malibu sedan was destroyed in the impact. A 2023 Subaru Outback wagon sustained severe damage. Both vehicles were rendered inoperable.',
      injuriesAndSeverity: 'Three people were involved in this crash, which has been classified as fatal. Details about specific individuals are not disclosed to protect privacy.',
      contributingFactors: 'Crossing the center line was identified as a primary factor, combined with wet road conditions from rain at the time of the crash. Head-on collisions carry the highest risk of fatal outcomes due to the combined speed of both vehicles.',
      roadAndWeatherConditions: 'The crash occurred during rainy conditions on a wet road surface, at night on a lighted roadway. Wet roads can reduce tire traction and increase stopping distances.',
      whatThisMeansForYou: 'If you were affected by this crash, this is an incredibly difficult time. Fatal crashes involve complex legal and insurance processes. In Pennsylvania, the statute of limitations for wrongful death claims is two years from the date of death.',
      nextSteps: 'If you lost a loved one, reach out to a wrongful death attorney for a free consultation. Contact victim assistance services in Montgomery County. Preserve any evidence, including police reports and medical records. Notify your insurance company. Consider grief counseling resources.',
    },
  },
  {
    input: {
      stateCode: 'TX',
      crashDate: '2024-12-01',
      crashTime: '14:30',
      severity: 'MINOR_INJURY',
      county: 'Harris',
      city: 'Houston',
      location: 'Westheimer Rd and Post Oak Blvd',
      mannerOfCollision: 'ANGLE',
      weatherCondition: 'CLEAR',
      lightCondition: 'DAYLIGHT',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 2,
      personCount: 4,
      vehicles: [
        { year: '2021', make: 'Nissan', model: 'Altima', bodyType: 'SEDAN', travelDirection: 'EAST', damageExtent: 'MODERATE' },
        { year: '2022', make: 'BMW', model: 'X3', bodyType: 'SUV', travelDirection: 'SOUTH', damageExtent: 'MODERATE' },
      ],
      injurySummary: 'Minor injuries reported, no transport required',
      contributingFactors: ['FAILURE_TO_YIELD', 'RAN_RED_LIGHT'],
    },
    output: {
      headline: 'Two-Vehicle Angle Collision at Westheimer and Post Oak in Houston',
      summary: 'A two-vehicle angle collision occurred at the intersection of Westheimer Road and Post Oak Boulevard in Houston on December 1, 2024. Four occupants sustained minor injuries. Contributing factors included failure to yield and running a red light.',
      whatHappened: 'At approximately 2:30 PM, two vehicles collided at an angle in the intersection. A 2021 Nissan Altima traveling eastbound and a 2022 BMW X3 traveling southbound collided when one driver failed to yield and ran a red light.',
      whereItHappened: 'The crash occurred at the intersection of Westheimer Road and Post Oak Boulevard in the Galleria area of Houston, Harris County, Texas. This is a busy commercial intersection with significant traffic volume.',
      vehiclesInvolved: 'A 2021 Nissan Altima sedan and a 2022 BMW X3 SUV were involved, both sustaining moderate damage. The vehicles collided at an angle as they crossed through the intersection from perpendicular directions.',
      injuriesAndSeverity: 'Four people were involved and minor injuries were reported. No one required ambulance transport to a hospital. This crash is classified as a minor injury collision.',
      contributingFactors: 'Failure to yield and running a red light were identified as contributing factors. Intersection collisions involving traffic signal violations often involve clear questions of fault.',
      roadAndWeatherConditions: 'Conditions at the time were clear with daylight visibility and dry road surfaces. Environmental conditions were not contributing factors in this crash.',
      whatThisMeansForYou: 'If you were involved, even minor injuries can develop into more significant problems. In Texas, the driver who ran the red light will generally be considered at fault. Texas follows a modified comparative fault rule, meaning your compensation may be reduced by your percentage of fault, and you cannot recover if you are more than 50% at fault.',
      nextSteps: 'See a doctor even if your injuries seem minor. Request the police report from the Houston Police Department. Take photos of vehicle damage and the intersection. Notify your insurance company promptly. Keep all medical receipts and records of lost work time.',
    },
  },
  {
    input: {
      stateCode: 'FL',
      crashDate: '2024-09-20',
      crashTime: '17:45',
      severity: 'SERIOUS_INJURY',
      county: 'Miami-Dade',
      city: 'Miami',
      mannerOfCollision: 'SIDESWIPE_SAME_DIRECTION',
      weatherCondition: 'CLOUDY',
      lightCondition: 'DAYLIGHT',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 2,
      personCount: 3,
      vehicles: [
        { year: '2020', make: 'Tesla', model: 'Model 3', bodyType: 'SEDAN', travelDirection: 'SOUTH', damageExtent: 'MODERATE' },
        { year: '2018', make: 'Dodge', model: 'Ram 1500', bodyType: 'PICKUP', travelDirection: 'SOUTH', damageExtent: 'MINOR' },
      ],
      injurySummary: '1 person transported with serious injuries',
      contributingFactors: ['IMPROPER_LANE_CHANGE', 'AGGRESSIVE_DRIVING'],
    },
    output: {
      headline: 'Sideswipe Collision in Miami Leaves One With Serious Injuries',
      summary: 'A sideswipe collision between two southbound vehicles in Miami on September 20, 2024 resulted in one person being transported to a hospital with serious injuries. The crash involved a lane-change incident during evening rush hour.',
      whatHappened: 'At approximately 5:45 PM, a sideswipe collision occurred between two southbound vehicles. An improper lane change and aggressive driving were identified as contributing factors. One occupant sustained serious injuries requiring hospital transport.',
      whereItHappened: 'The crash occurred in Miami, Miami-Dade County, Florida during the evening commute period. The roadway involved southbound traffic with multiple lanes.',
      vehiclesInvolved: 'A 2020 Tesla Model 3 sedan sustained moderate damage and a 2018 Dodge Ram 1500 pickup truck sustained minor damage. Both vehicles were traveling in the same southbound direction at the time of the sideswipe.',
      injuriesAndSeverity: 'Three people were involved. One person was transported to a hospital with serious injuries. This crash is classified as a serious injury collision.',
      contributingFactors: 'Improper lane change and aggressive driving were contributing factors. Sideswipe crashes in the same direction often result from unsafe lane changes or failure to check blind spots.',
      roadAndWeatherConditions: 'Conditions were cloudy with daylight visibility and dry road surfaces. Weather does not appear to have been a contributing factor.',
      whatThisMeansForYou: 'If you were injured in this crash, Florida is a no-fault insurance state, meaning your own Personal Injury Protection (PIP) insurance covers initial medical costs regardless of fault. However, for serious injuries, you may step outside the no-fault system and pursue a claim against the at-fault driver.',
      nextSteps: 'File a PIP claim with your own insurance immediately. Seek comprehensive medical evaluation. Document your injuries and treatment plan. If injuries are serious, consult with a personal injury attorney about pursuing a claim beyond PIP. Florida has a four-year statute of limitations for personal injury claims.',
    },
  },
  {
    input: {
      stateCode: 'CA',
      crashDate: '2024-08-10',
      crashTime: '02:15',
      severity: 'PROPERTY_DAMAGE_ONLY',
      county: 'Los Angeles',
      city: 'Los Angeles',
      location: 'Sunset Blvd and Vine St',
      mannerOfCollision: 'REAR_END',
      weatherCondition: 'CLEAR',
      lightCondition: 'DARK_LIGHTED',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 2,
      personCount: 2,
      vehicles: [
        { year: '2023', make: 'Hyundai', model: 'Elantra', bodyType: 'SEDAN', travelDirection: 'WEST', damageExtent: 'MINOR' },
        { year: '2021', make: 'Toyota', model: 'RAV4', bodyType: 'SUV', travelDirection: 'WEST', damageExtent: 'MINOR' },
      ],
      contributingFactors: ['FOLLOWING_TOO_CLOSELY'],
    },
    output: {
      headline: 'Two-Vehicle Rear-End Collision on Sunset Boulevard in Hollywood',
      summary: 'A minor rear-end collision occurred at Sunset Boulevard and Vine Street in Hollywood, Los Angeles on August 10, 2024 at approximately 2:15 AM. No injuries were reported and both vehicles sustained minor damage.',
      whatHappened: 'In the early morning hours, a westbound 2023 Hyundai Elantra rear-ended a 2021 Toyota RAV4 that was also traveling westbound. Following too closely was identified as the contributing factor.',
      whereItHappened: 'The crash took place at the intersection of Sunset Boulevard and Vine Street in the Hollywood neighborhood of Los Angeles, California. This intersection sees reduced traffic volumes during late-night hours.',
      vehiclesInvolved: 'A 2023 Hyundai Elantra sedan and a 2021 Toyota RAV4 SUV were involved, both sustaining minor damage. Both vehicles were traveling westbound on Sunset Boulevard.',
      injuriesAndSeverity: 'Two people were involved and no injuries were reported. This crash is classified as property damage only.',
      contributingFactors: 'Following too closely was the identified contributing factor. Even at lower speeds, insufficient following distance can lead to rear-end collisions, particularly during nighttime when reaction times may be slower.',
      roadAndWeatherConditions: 'The crash occurred on a clear night with street lighting and dry road surfaces. Environmental conditions were not a factor.',
      whatThisMeansForYou: 'If you were involved in this property-damage-only crash, the main concern is getting your vehicle repaired. In California, the driver who rear-ended the other vehicle is generally presumed to be at fault. California uses a pure comparative fault system.',
      nextSteps: 'Exchange insurance information if you have not already. File a claim with the at-fault driver insurance company. Get repair estimates from multiple shops. Request the police report from LAPD if one was filed. Even without visible injuries, monitor for delayed symptoms like neck or back pain.',
    },
  },
  {
    input: {
      stateCode: 'NY',
      crashDate: '2024-07-04',
      crashTime: '22:00',
      severity: 'SERIOUS_INJURY',
      county: 'Kings',
      city: 'Brooklyn',
      mannerOfCollision: 'ANGLE',
      weatherCondition: 'CLEAR',
      lightCondition: 'DARK_LIGHTED',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 2,
      personCount: 6,
      vehicles: [
        { year: '2017', make: 'Honda', model: 'Accord', bodyType: 'SEDAN', travelDirection: 'NORTH', damageExtent: 'SEVERE' },
        { year: '2022', make: 'Kia', model: 'Telluride', bodyType: 'SUV', travelDirection: 'EAST', damageExtent: 'MODERATE' },
      ],
      injurySummary: '3 transported to hospital, 1 with serious injuries',
      contributingFactors: ['RAN_STOP_SIGN', 'SPEEDING'],
    },
    output: {
      headline: 'Angle Collision in Brooklyn Injures Three on Independence Day',
      summary: 'An angle collision at a Brooklyn intersection on July 4, 2024 resulted in three people being transported to a hospital, one with serious injuries. The crash involved a driver who ran a stop sign while speeding.',
      whatHappened: 'At approximately 10:00 PM on Independence Day, two vehicles collided at an angle in a Brooklyn intersection. A northbound 2017 Honda Accord ran a stop sign while speeding and struck an eastbound 2022 Kia Telluride. Three of the six occupants were transported to a hospital.',
      whereItHappened: 'The crash occurred at an intersection in Brooklyn, Kings County, New York. The intersection is controlled by a stop sign on at least one approach.',
      vehiclesInvolved: 'A 2017 Honda Accord sedan sustained severe damage and a 2022 Kia Telluride SUV sustained moderate damage. The vehicles collided at an angle as the Accord entered the intersection against the stop sign.',
      injuriesAndSeverity: 'Six people were involved in the crash. Three were transported to a hospital, with one sustaining serious injuries. This crash is classified as a serious injury collision.',
      contributingFactors: 'Running a stop sign and speeding were identified as contributing factors. The combination of speed and traffic control violation significantly increased the severity of the impact.',
      roadAndWeatherConditions: 'The crash occurred on a clear evening with street lighting and dry road surfaces. Environmental conditions were not contributing factors.',
      whatThisMeansForYou: 'If you were injured in this crash, New York is a no-fault insurance state. Your own insurance covers initial medical costs through Personal Injury Protection. For serious injuries meeting the threshold, you may pursue a claim against the at-fault driver. New York has a three-year statute of limitations for personal injury claims.',
      nextSteps: 'File a no-fault claim with your insurance company immediately. Seek medical follow-up for all injuries. Document everything with photos and records. For serious injuries, consult a personal injury attorney. Request the NYPD accident report. Keep all medical bills and records of lost wages.',
    },
  },
  {
    input: {
      stateCode: 'AZ',
      crashDate: '2024-06-15',
      crashTime: '15:00',
      severity: 'MINOR_INJURY',
      county: 'Maricopa',
      city: 'Phoenix',
      location: 'I-10 and 7th Ave',
      mannerOfCollision: 'REAR_END',
      weatherCondition: 'CLEAR',
      lightCondition: 'DAYLIGHT',
      roadSurfaceCondition: 'DRY',
      vehicleCount: 4,
      personCount: 7,
      vehicles: [
        { year: '2020', make: 'Toyota', model: 'Corolla', bodyType: 'SEDAN', travelDirection: 'WEST', damageExtent: 'SEVERE' },
        { year: '2019', make: 'Ford', model: 'Explorer', bodyType: 'SUV', travelDirection: 'WEST', damageExtent: 'MODERATE' },
        { year: '2022', make: 'Chevrolet', model: 'Silverado', bodyType: 'PICKUP', travelDirection: 'WEST', damageExtent: 'MODERATE' },
        { year: '2021', make: 'Honda', model: 'Civic', bodyType: 'SEDAN', travelDirection: 'WEST', damageExtent: 'MINOR' },
      ],
      injurySummary: 'Multiple minor injuries, 2 transported',
      contributingFactors: ['FOLLOWING_TOO_CLOSELY', 'SUDDEN_STOP'],
    },
    output: {
      headline: 'Four-Vehicle Chain-Reaction Crash on I-10 Near Downtown Phoenix',
      summary: 'A four-vehicle chain-reaction rear-end crash on Interstate 10 near 7th Avenue in Phoenix on June 15, 2024 resulted in multiple minor injuries. Two people were transported to medical facilities.',
      whatHappened: 'At approximately 3:00 PM, a chain-reaction rear-end crash involved four westbound vehicles on I-10. A sudden stop in traffic triggered a series of rear-end impacts. Following too closely was identified as a key contributing factor.',
      whereItHappened: 'The crash occurred on westbound Interstate 10 near the 7th Avenue interchange in Phoenix, Maricopa County, Arizona. This section of I-10 experiences heavy afternoon traffic.',
      vehiclesInvolved: 'Four vehicles were involved: a 2020 Toyota Corolla (severe damage), a 2019 Ford Explorer (moderate damage), a 2022 Chevrolet Silverado (moderate damage), and a 2021 Honda Civic (minor damage). All were traveling westbound.',
      injuriesAndSeverity: 'Seven people were involved with multiple minor injuries reported. Two individuals were transported to medical facilities. The crash is classified as a minor injury collision.',
      contributingFactors: 'Following too closely and a sudden stop in traffic were contributing factors. Chain-reaction crashes on highways often occur when drivers do not maintain adequate following distance to react to sudden speed changes.',
      roadAndWeatherConditions: 'Conditions were clear with full daylight visibility and dry road surfaces. The weather and road conditions did not contribute to the crash.',
      whatThisMeansForYou: 'In a multi-vehicle chain reaction, determining fault can be complex. Arizona follows a pure comparative fault system, so your compensation is reduced by your percentage of fault but is never completely barred. Each driver may bear some responsibility depending on their following distance.',
      nextSteps: 'Get checked by a medical professional even for minor-seeming injuries. Obtain the Arizona DPS crash report. Document damage to your vehicle and any injuries. Contact your insurance company. In multi-vehicle crashes, consider consulting an attorney to help determine fault allocation.',
    },
  },
]

export const equalizerExamples: Array<{ input: EqualizerBriefingInput; output: EqualizerBriefingOutput }> = [
  {
    input: {
      crashId: 'CO-2024-123456',
      stateCode: 'CO',
      severity: 'SERIOUS_INJURY',
      mannerOfCollision: 'REAR_END',
      crashDate: '2024-11-15',
      cohortSize: 847,
      cohortConfidence: 'HIGH',
      avgSeverity: 'MINOR_INJURY',
      liabilitySignals: [
        { type: 'REAR_END_PRESUMPTION', description: 'Rear driver presumed at fault in Colorado', strength: 'STRONG', favorsSide: 'PLAINTIFF' },
        { type: 'CLEAR_CONDITIONS', description: 'No weather or road conditions contributing to crash', strength: 'MODERATE', favorsSide: 'PLAINTIFF' },
      ],
      settlementRange: { low: 15000, mid: 45000, high: 95000 },
      faultType: 'MODIFIED_COMPARATIVE',
      statuteOfLimitations: 3,
    },
    output: {
      situationSummary: 'Your rear-end collision in Colorado is more serious than most similar crashes in the area. Out of 847 comparable crashes, most resulted in minor injuries, but your crash resulted in serious injuries. This means your situation may warrant more attention and potentially higher compensation.',
      liabilityAnalysis: 'The evidence strongly favors your position. In Colorado, when someone rear-ends you, there is a strong legal presumption that the other driver was at fault. Combined with clear weather and road conditions at the time, the other driver will have difficulty arguing that external factors caused the crash. These are strong signals for your case.',
      settlementContext: 'Based on 847 comparable crashes, settlements typically range from $15,000 to $95,000, with a midpoint around $45,000. Your serious injuries may push toward the higher end. These are estimates based on historical data, not guarantees. Actual outcomes depend on specific medical costs, lost wages, and other individual factors.',
      timelinePressure: 'Colorado has a 3-year statute of limitations for personal injury claims. Your crash occurred on November 15, 2024, meaning you must file by November 15, 2027. However, evidence degrades over time, witnesses become harder to locate, and insurance companies may offer lower settlements the longer you wait. Acting sooner generally produces better outcomes.',
      actionItems: [
        'Complete all recommended medical treatment and follow-up appointments',
        'Request and preserve the official crash report from Colorado State Patrol',
        'Document all medical expenses, lost wages, and out-of-pocket costs',
        'Consult with a personal injury attorney for a free case evaluation',
        'Do not accept an initial insurance settlement without understanding your full damages',
        'Keep a daily journal of pain levels and how injuries affect daily life',
      ],
      confidenceNote: 'This analysis is based on a high-confidence cohort of 847 comparable Colorado rear-end crashes. Settlement estimates reflect historical outcomes and are not predictions of your specific case. This is informational context, not legal advice. Every crash has unique circumstances that affect outcomes.',
    },
  },
  {
    input: {
      crashId: 'FL-2024-789012',
      stateCode: 'FL',
      severity: 'FATAL',
      mannerOfCollision: 'HEAD_ON',
      crashDate: '2024-08-20',
      cohortSize: 156,
      cohortConfidence: 'MEDIUM',
      liabilitySignals: [
        { type: 'WRONG_WAY_DRIVING', description: 'One vehicle crossed into opposing lane', strength: 'STRONG', favorsSide: 'PLAINTIFF' },
        { type: 'IMPAIRED_DRIVING', description: 'Toxicology pending for other driver', strength: 'MODERATE', favorsSide: 'PLAINTIFF' },
        { type: 'DARK_CONDITIONS', description: 'Crash occurred at night on unlit road', strength: 'WEAK', favorsSide: 'NEUTRAL' },
      ],
      settlementRange: { low: 250000, mid: 750000, high: 2000000 },
      faultType: 'PURE_COMPARATIVE',
      statuteOfLimitations: 2,
    },
    output: {
      situationSummary: 'This fatal head-on collision is among the most severe crash types. Out of 156 comparable crashes in the data, these cases typically involve significant legal proceedings. The loss you are experiencing is immeasurable, and the data below is meant only to help you understand the landscape ahead.',
      liabilityAnalysis: 'Strong evidence suggests the other driver bears primary responsibility. Wrong-way driving is a powerful liability signal in your favor. A pending toxicology report could further strengthen the case. Nighttime conditions on an unlit road are a neutral factor that affects both parties equally. Overall, the liability signals are favorable.',
      settlementContext: 'Fatal crash cases in Florida with similar circumstances have historically resulted in outcomes ranging from $250,000 to $2,000,000, with a midpoint around $750,000. Wrongful death cases are complex and highly dependent on individual circumstances. These figures are based on historical data and should not be treated as predictions.',
      timelinePressure: 'Florida has a 2-year statute of limitations for wrongful death claims. The crash occurred on August 20, 2024, creating a deadline of August 20, 2026. This is an urgent timeline. Wrongful death cases require substantial investigation and preparation, so engaging an attorney quickly is strongly recommended.',
      actionItems: [
        'Consult a wrongful death attorney immediately given the 2-year deadline',
        'Preserve all evidence, including the crash report, medical records, and photos',
        'Request the toxicology report through your attorney when available',
        'Document the financial impact, including lost income and funeral expenses',
        'Contact Florida victim assistance services for support resources',
        'Do not speak with the other driver insurance company without legal representation',
      ],
      confidenceNote: 'This analysis is based on a medium-confidence cohort of 156 comparable Florida head-on crashes. The smaller cohort size means estimates are less precise. Fatal cases are highly individualized and legal outcomes vary significantly. This is informational context, not legal advice.',
    },
  },
  {
    input: {
      crashId: 'TX-2024-345678',
      stateCode: 'TX',
      severity: 'MINOR_INJURY',
      mannerOfCollision: 'ANGLE',
      crashDate: '2024-12-01',
      cohortSize: 2340,
      cohortConfidence: 'HIGH',
      avgSeverity: 'MINOR_INJURY',
      liabilitySignals: [
        { type: 'RED_LIGHT_VIOLATION', description: 'Other driver cited for running red light', strength: 'STRONG', favorsSide: 'PLAINTIFF' },
        { type: 'WITNESS_AVAILABLE', description: 'Multiple witnesses confirmed signal violation', strength: 'MODERATE', favorsSide: 'PLAINTIFF' },
      ],
      settlementRange: { low: 3000, mid: 12000, high: 35000 },
      faultType: 'MODIFIED_COMPARATIVE',
      statuteOfLimitations: 2,
    },
    output: {
      situationSummary: 'Your angle collision at an intersection in Texas is consistent with a large group of similar crashes. With 2,340 comparable cases, the data provides a reliable picture. Most similar crashes result in minor injuries, which matches your situation.',
      liabilityAnalysis: 'The liability picture is clear and favorable. The other driver was cited for running a red light, which is a strong indicator of fault. Multiple witnesses confirmed the violation, further strengthening your position. In Texas, this combination typically results in the other driver being found primarily at fault.',
      settlementContext: 'Based on 2,340 comparable crashes, settlements typically range from $3,000 to $35,000, with a midpoint around $12,000. Minor injury cases tend to settle on the lower end unless injuries prove more severe than initially assessed. Always get fully evaluated before accepting any settlement offer.',
      timelinePressure: 'Texas has a 2-year statute of limitations for personal injury claims. Your crash occurred on December 1, 2024, meaning you must file by December 1, 2026. While this provides some time, medical documentation and evidence gathering should begin immediately.',
      actionItems: [
        'Complete medical evaluation and follow all treatment recommendations',
        'Obtain the police report showing the citation for the red light violation',
        'Collect witness contact information if not already in the police report',
        'File a claim with the other driver insurance company',
        'Track all expenses related to the crash, including medical bills and lost wages',
        'Consider consulting an attorney if the insurance company disputes fault or offers a low settlement',
      ],
      confidenceNote: 'This analysis is based on a high-confidence cohort of 2,340 comparable Texas intersection crashes. The large sample size provides reliable estimates. However, individual outcomes depend on specific medical costs, injury progression, and negotiation. This is informational context, not legal advice.',
    },
  },
]

export const personaExamples: Array<{ input: PersonaAdapterInput; output: PersonaAdapterOutput }> = [
  {
    input: {
      messageText: 'I was rear-ended yesterday and my neck really hurts. What should I do?',
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'CRASH_VICTIM',
      confidence: 0.95,
      reasoning: 'User describes being in a crash with personal injury symptoms, first-person account seeking immediate guidance.',
      toneAdjustments: {
        empathyLevel: 'HIGH',
        technicalLevel: 'SIMPLE',
        urgencyLevel: 'HIGH',
        callToAction: 'See a doctor right away, even if pain seems mild. Document everything and consider a free attorney consultation.',
      },
    },
  },
  {
    input: {
      messageText: 'My daughter was in a car accident last week. She says she is fine but I am worried about her.',
      pageContext: 'search-results',
    },
    output: {
      persona: 'FAMILY_MEMBER',
      confidence: 0.92,
      reasoning: 'User refers to a family member (daughter) being in the crash, expressing concern about a loved one rather than themselves.',
      toneAdjustments: {
        empathyLevel: 'HIGH',
        technicalLevel: 'SIMPLE',
        urgencyLevel: 'MEDIUM',
        callToAction: 'Encourage your daughter to see a doctor for a full evaluation. Some injuries take days to appear. You can help by documenting the crash details.',
      },
    },
  },
  {
    input: {
      messageText: 'What is the comparative negligence standard in this jurisdiction and how would it apply to a multi-vehicle pileup?',
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'ATTORNEY',
      confidence: 0.9,
      reasoning: 'User uses precise legal terminology (comparative negligence, jurisdiction) and asks about legal standards, indicating legal professional background.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'EXPERT',
        urgencyLevel: 'LOW',
        callToAction: 'View the full liability analysis and cohort data for this crash type in the Equalizer report.',
      },
    },
  },
  {
    input: {
      messageText: 'I need the loss report for claim #2024-8901. What was the total property damage and were there any bodily injury claims filed?',
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'INSURANCE_ADJUSTER',
      confidence: 0.88,
      reasoning: 'User references claim numbers, asks about property damage totals and bodily injury claims using insurance industry terminology.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'EXPERT',
        urgencyLevel: 'LOW',
        callToAction: 'Access the detailed crash data, vehicle damage assessments, and injury severity classifications.',
      },
    },
  },
  {
    input: {
      messageText: 'How many fatal crashes have occurred at this intersection in the past 5 years? Are there any patterns?',
      pageContext: 'intersection-stats',
    },
    output: {
      persona: 'JOURNALIST',
      confidence: 0.85,
      reasoning: 'User asks about crash patterns and statistics over time, typical of investigative research rather than personal involvement.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'MODERATE',
        urgencyLevel: 'LOW',
        callToAction: 'Explore the intersection safety trends and download the crash data for your analysis.',
      },
    },
  },
  {
    input: {
      messageText: 'I am researching the correlation between road design and crash severity for my thesis. Can I access the raw data?',
      pageContext: 'search-results',
    },
    output: {
      persona: 'RESEARCHER',
      confidence: 0.9,
      reasoning: 'User explicitly mentions research and thesis work, asks about data access for academic purposes.',
      toneAdjustments: {
        empathyLevel: 'LOW',
        technicalLevel: 'EXPERT',
        urgencyLevel: 'LOW',
        callToAction: 'Access our data API for bulk crash data. Filter by road design characteristics and severity levels.',
      },
    },
  },
  {
    input: {
      messageText: 'What happened in this crash?',
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'GENERAL',
      confidence: 0.6,
      reasoning: 'Simple question without personal involvement indicators or professional terminology. Could be anyone browsing crash information.',
      toneAdjustments: {
        empathyLevel: 'MEDIUM',
        technicalLevel: 'SIMPLE',
        urgencyLevel: 'LOW',
        callToAction: 'Read the full crash narrative above for a complete summary of what occurred.',
      },
    },
  },
  {
    input: {
      messageText: 'Someone hit my parked car while I was at work. There is a dent on the driver side door. What are my options?',
      pageContext: 'search-results',
    },
    output: {
      persona: 'CRASH_VICTIM',
      confidence: 0.85,
      reasoning: 'User describes personal vehicle damage from a crash (hit-and-run on parked car), seeking guidance on next steps.',
      toneAdjustments: {
        empathyLevel: 'HIGH',
        technicalLevel: 'SIMPLE',
        urgencyLevel: 'MEDIUM',
        callToAction: 'File a police report and contact your insurance company. Check nearby businesses for security camera footage.',
      },
    },
  },
  {
    input: {
      messageText: 'My husband was killed in a truck accident on the highway. The trucking company says it was not their fault.',
      previousMessages: ['Is there any way to find out what really happened?'],
      pageContext: 'crash-detail',
    },
    output: {
      persona: 'FAMILY_MEMBER',
      confidence: 0.97,
      reasoning: 'User lost a spouse in a fatal crash and is dealing with a trucking company disputing liability. Extremely sensitive situation with high emotional distress.',
      toneAdjustments: {
        empathyLevel: 'HIGH',
        technicalLevel: 'SIMPLE',
        urgencyLevel: 'HIGH',
        callToAction: 'We are so sorry for your loss. A wrongful death attorney can investigate the trucking company records, driver logs, and maintenance history. Many offer free consultations.',
      },
    },
  },
  {
    input: {
      messageText: 'Can you show me the crash data for zip code 80202 from January to March?',
      pageContext: 'search-results',
    },
    output: {
      persona: 'GENERAL',
      confidence: 0.55,
      reasoning: 'User asks for location-specific data without personal involvement or professional indicators. Could be a concerned resident, researcher, or professional.',
      toneAdjustments: {
        empathyLevel: 'MEDIUM',
        technicalLevel: 'MODERATE',
        urgencyLevel: 'LOW',
        callToAction: 'Search our crash database by location and date range to find the information you need.',
      },
    },
  },
]

export function getExamplesForSignature(s: string): Array<{ input: unknown; output: unknown }> {
  switch (s) {
    case 'CrashNarrative': return narrativeExamples
    case 'EqualizerBriefing': return equalizerExamples
    case 'PersonaAdapter': return personaExamples
    default: return []
  }
}

export function sampleExamples(n: string, c: number): Array<{ input: unknown; output: unknown }> {
  const all = getExamplesForSignature(n)
  if (c >= all.length) return all
  return [...all].sort(() => Math.random() - 0.5).slice(0, c)
}

export function getFormattedExamples(signature: string, count: number = 3): string {
  const examples = sampleExamples(signature, count)
  if (examples.length === 0) return ''

  return examples
    .map((ex, i) => `--- Example ${i + 1} ---\nInput: ${JSON.stringify(ex.input, null, 2)}\nOutput: ${JSON.stringify(ex.output, null, 2)}`)
    .join('\n\n')
}
