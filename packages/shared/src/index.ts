// Types
export type {
  CrashNarrativeContent,
  ComparableCohort,
  ComparableDimension,
  ComparableCrash,
  LiabilitySignal,
  SettlementContext,
  AdjustmentFactor,
  EqualizerBriefing,
  AttorneyMatch,
  BriefingSection,
  ModelTier,
  DataTier,
} from './types/crash';

export type {
  Attorney,
  ReviewIntelligence,
  ReviewQuote,
  AttorneyIndexScore,
} from './types/attorney';

export type {
  BronzeRecord,
  SilverRecord,
  SilverVehicle,
  SilverPerson,
  QualityGateResult,
  PipelineRunResult,
  PipelineError,
} from './types/pipeline';

// Constants
export { STATE_CATALOG, ALL_STATE_CODES, NO_FAULT_STATES, CHOICE_STATES } from './constants/state-catalog';
export type { StateInfo } from './constants/state-catalog';

export {
  CrashSeverity,
  InjuryStatus,
  MannerOfCollision,
  AtmosphericCondition,
  LightCondition,
  PersonType,
  Sex,
  BodyTypeCategory,
  GeoEntityType,
} from './constants/mmucc-enums';
