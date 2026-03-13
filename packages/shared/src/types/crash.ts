// Crash narrative content structure (10 sections)
export interface CrashNarrativeContent {
  headline: string;
  summary: string;
  circumstances: string;
  vehicles: string;
  injuries: string;
  roadConditions: string;
  contributingFactors: string;
  timeline: string;
  legalContext: string;
  disclaimer: string;
}

// Comparable crash cohort for Equalizer
export interface ComparableCohort {
  matchCount: number;
  dimensions: ComparableDimension[];
  crashes: ComparableCrash[];
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ComparableDimension {
  name: string;
  value: string;
  tolerance: number;
  matched: boolean;
}

export interface ComparableCrash {
  crashId: string;
  matchScore: number;
  dimensionsMatched: number;
  settlementAmount?: number;
  severity: string;
}

// Liability signal extraction
export interface LiabilitySignal {
  rule: string;
  indicator: 'STRONG_LIABILITY' | 'PARTIAL_LIABILITY' | 'LOW_LIABILITY' | 'UNCLEAR';
  confidence: number;
  explanation: string;
  evidence: string[];
}

// Settlement context for Equalizer
export interface SettlementContext {
  baseRange: { low: number; high: number };
  adjustedRange: { low: number; high: number };
  adjustmentFactors: AdjustmentFactor[];
  stateFactor: { state: string; multiplier: number };
  disclaimer: string;
}

export interface AdjustmentFactor {
  name: string;
  multiplier: number;
  reason: string;
}

// Equalizer briefing (full output)
export interface EqualizerBriefing {
  comparable: ComparableCohort;
  liability: LiabilitySignal[];
  settlement: SettlementContext;
  attorneyMatches: AttorneyMatch[];
  sections: BriefingSection[];
}

export interface AttorneyMatch {
  attorneyId: string;
  name: string;
  indexScore: number;
  distance: number;
  matchReason: string;
}

export interface BriefingSection {
  title: string;
  content: string;
  type: 'comparable' | 'liability' | 'settlement' | 'attorney' | 'nextSteps';
}

// Model tiers for AI gateway
export type ModelTier = 'premium' | 'standard' | 'budget';

// Data tiers based on available data richness
export type DataTier = 'RICH' | 'STANDARD' | 'MINIMAL';
