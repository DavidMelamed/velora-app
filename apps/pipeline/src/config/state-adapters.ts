/**
 * State Adapter Registry — Maps states to their data sources.
 * Centralizes which adapter(s) to use for each state's crash data.
 *
 * Sources:
 *   - FARS: Federal fatal crash data (all 50 states + DC)
 *   - ArcGIS: State DOT open data portals
 *   - Socrata: City open data portals (SODA API)
 */

export type AdapterType = 'fars' | 'arcgis' | 'socrata'

export interface StateAdapterConfig {
  stateCode: string
  stateName: string
  fips: string
  adapters: AdapterType[]
  /** Whether this state is actively ingesting */
  isActive: boolean
  /** Notes about data availability */
  notes?: string
}

/**
 * Top 10 states by population configured for FARS ingestion,
 * plus states with ArcGIS and Socrata sources.
 */
export const STATE_ADAPTER_REGISTRY: StateAdapterConfig[] = [
  // ─── Top 10 states by population (FARS) ─────────────────────────────────────
  {
    stateCode: 'CA',
    stateName: 'California',
    fips: '06',
    adapters: ['fars'],
    isActive: true,
    notes: 'Largest state by population. FARS only.',
  },
  {
    stateCode: 'TX',
    stateName: 'Texas',
    fips: '48',
    adapters: ['fars'],
    isActive: true,
    notes: '2nd largest state. FARS only.',
  },
  {
    stateCode: 'FL',
    stateName: 'Florida',
    fips: '12',
    adapters: ['fars'],
    isActive: true,
    notes: '3rd largest state. FARS only.',
  },
  {
    stateCode: 'NY',
    stateName: 'New York',
    fips: '36',
    adapters: ['fars', 'socrata'],
    isActive: true,
    notes: '4th largest. NYC Socrata for local crashes.',
  },
  {
    stateCode: 'PA',
    stateName: 'Pennsylvania',
    fips: '42',
    adapters: ['fars', 'arcgis'],
    isActive: true,
    notes: '5th largest. PennDOT ArcGIS active.',
  },
  {
    stateCode: 'IL',
    stateName: 'Illinois',
    fips: '17',
    adapters: ['fars', 'arcgis', 'socrata'],
    isActive: true,
    notes: '6th largest. IDOT ArcGIS + Chicago Socrata.',
  },
  {
    stateCode: 'OH',
    stateName: 'Ohio',
    fips: '39',
    adapters: ['fars'],
    isActive: true,
    notes: '7th largest. FARS only.',
  },
  {
    stateCode: 'GA',
    stateName: 'Georgia',
    fips: '13',
    adapters: ['fars'],
    isActive: true,
    notes: '8th largest. FARS only.',
  },
  {
    stateCode: 'NC',
    stateName: 'North Carolina',
    fips: '37',
    adapters: ['fars'],
    isActive: true,
    notes: '9th largest. FARS only.',
  },
  {
    stateCode: 'MI',
    stateName: 'Michigan',
    fips: '26',
    adapters: ['fars'],
    isActive: true,
    notes: '10th largest. FARS only.',
  },

  // ─── ArcGIS states (beyond top 10) ──────────────────────────────────────────
  {
    stateCode: 'CO',
    stateName: 'Colorado',
    fips: '08',
    adapters: ['fars', 'arcgis'],
    isActive: true,
    notes: 'Denver Open Data ArcGIS.',
  },
  {
    stateCode: 'MA',
    stateName: 'Massachusetts',
    fips: '25',
    adapters: ['fars', 'arcgis'],
    isActive: true,
    notes: 'MassDOT ArcGIS.',
  },
  {
    stateCode: 'WA',
    stateName: 'Washington',
    fips: '53',
    adapters: ['fars', 'arcgis'],
    isActive: true,
    notes: 'WSDOT ArcGIS.',
  },
]

/**
 * Get adapter config for a specific state.
 */
export function getStateAdapterConfig(stateCode: string): StateAdapterConfig | undefined {
  return STATE_ADAPTER_REGISTRY.find(s => s.stateCode === stateCode)
}

/**
 * Get all states configured for a specific adapter type.
 */
export function getStatesForAdapter(adapterType: AdapterType): StateAdapterConfig[] {
  return STATE_ADAPTER_REGISTRY.filter(s => s.isActive && s.adapters.includes(adapterType))
}

/**
 * Get all active state codes.
 */
export function getActiveStateCodes(): string[] {
  return STATE_ADAPTER_REGISTRY.filter(s => s.isActive).map(s => s.stateCode)
}

/**
 * Check if a state supports a given adapter type.
 */
export function stateSupportsAdapter(stateCode: string, adapterType: AdapterType): boolean {
  const config = getStateAdapterConfig(stateCode)
  return config ? config.adapters.includes(adapterType) : false
}
