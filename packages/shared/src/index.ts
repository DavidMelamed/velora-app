// Types
export type {
  CrashNarrativeContent,
  NarrativeQualityMetrics,
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
export {
  STATE_CATALOG,
  STATE_BY_CODE,
  STATE_BY_FIPS,
  ALL_STATE_CODES,
  CONTRIBUTORY_STATES,
  PURE_COMPARATIVE_STATES,
  MODIFIED_50_STATES,
  MODIFIED_51_STATES,
} from './constants/state-catalog';
export type { StateConfig, FaultType } from './constants/state-catalog';

export {
  WHAT_TO_DO_NEXT,
  getGuidanceForSeverity,
} from './constants/what-to-do-next';
export type { GuidanceStep, SeverityGuidance } from './constants/what-to-do-next';

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

// Case Memory System
export type {
  MatterSummary,
  EpisodeSummary,
  CaseEntitySummary,
  CaseFactSummary,
  TimelineEvent,
  ConfirmationCard,
  MatterCreateInput,
  EpisodeCreateInput,
  ConfirmationResponse,
  TimelineFilter,
  CaseSearchQuery,
  ProviderSummary,
} from './types/case';

export {
  MatterStatus,
  EpisodeType,
  CaseEntityType,
  FactStatus,
} from './types/case';

// Utilities
export { displayName } from './utils/display-names';
