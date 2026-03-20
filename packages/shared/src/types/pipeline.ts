// Bronze layer — raw ingested records
export interface BronzeRecord {
  sourceId: string;
  sourceType: 'FARS' | 'ARCGIS' | 'SOCRATA' | 'PDF' | 'MANUAL';
  stateCode: string;
  rawData: Record<string, unknown>;
  fetchedAt: Date;
}

// Silver layer — validated and mapped
export interface SilverRecord {
  stateUniqueId: string;
  stateCode: string;
  crashDate: Date;
  crashTime: string | null;
  latitude: number | null;
  longitude: number | null;
  severity: string;
  county: string | null;
  cityName: string | null;
  vehicles: SilverVehicle[];
  persons: SilverPerson[];
  rawData: Record<string, unknown>;
}

export interface SilverVehicle {
  unitNumber: number;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  bodyType: string | null;
  speedLimit: number | null;
}

export interface SilverPerson {
  personType: string;
  injuryStatus: string;
  age: number | null;
  sex: string | null;
  seatingPosition: string | null;
}

// Quality gate results
export interface QualityGateResult {
  gate: string;
  passed: boolean;
  value: number | string;
  threshold: number | string;
  message: string;
}

// Pipeline run tracking
export interface PipelineRunResult {
  dataSourceId: string;
  stage: 'BRONZE' | 'SILVER' | 'GOLD';
  recordsIn: number;
  recordsOut: number;
  recordsFailed: number;
  durationMs: number;
  errors: PipelineError[];
}

export interface PipelineError {
  recordId: string | null;
  errorType: 'VALIDATION' | 'MAPPING' | 'DUPLICATE' | 'UNKNOWN';
  message: string;
  field: string | null;
}
