export interface StateInfo {
  code: string;
  name: string;
  fips: string;
  statuteOfLimitationsYears: number;
  faultType: 'at-fault' | 'no-fault' | 'choice';
  arcgisEndpoint: string | null;
}

export const STATE_CATALOG: Record<string, StateInfo> = {
  AL: { code: 'AL', name: 'Alabama', fips: '01', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  AK: { code: 'AK', name: 'Alaska', fips: '02', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  AZ: { code: 'AZ', name: 'Arizona', fips: '04', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  AR: { code: 'AR', name: 'Arkansas', fips: '05', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  CA: { code: 'CA', name: 'California', fips: '06', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  CO: { code: 'CO', name: 'Colorado', fips: '08', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: 'https://services1.arcgis.com/Ezk9fcjSUKMTmXGa/arcgis/rest/services' },
  CT: { code: 'CT', name: 'Connecticut', fips: '09', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  DE: { code: 'DE', name: 'Delaware', fips: '10', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  FL: { code: 'FL', name: 'Florida', fips: '12', statuteOfLimitationsYears: 4, faultType: 'no-fault', arcgisEndpoint: null },
  GA: { code: 'GA', name: 'Georgia', fips: '13', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  HI: { code: 'HI', name: 'Hawaii', fips: '15', statuteOfLimitationsYears: 2, faultType: 'no-fault', arcgisEndpoint: null },
  ID: { code: 'ID', name: 'Idaho', fips: '16', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  IL: { code: 'IL', name: 'Illinois', fips: '17', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  IN: { code: 'IN', name: 'Indiana', fips: '18', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  IA: { code: 'IA', name: 'Iowa', fips: '19', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  KS: { code: 'KS', name: 'Kansas', fips: '20', statuteOfLimitationsYears: 2, faultType: 'no-fault', arcgisEndpoint: null },
  KY: { code: 'KY', name: 'Kentucky', fips: '21', statuteOfLimitationsYears: 1, faultType: 'no-fault', arcgisEndpoint: null },
  LA: { code: 'LA', name: 'Louisiana', fips: '22', statuteOfLimitationsYears: 1, faultType: 'at-fault', arcgisEndpoint: null },
  ME: { code: 'ME', name: 'Maine', fips: '23', statuteOfLimitationsYears: 6, faultType: 'at-fault', arcgisEndpoint: null },
  MD: { code: 'MD', name: 'Maryland', fips: '24', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  MA: { code: 'MA', name: 'Massachusetts', fips: '25', statuteOfLimitationsYears: 3, faultType: 'no-fault', arcgisEndpoint: null },
  MI: { code: 'MI', name: 'Michigan', fips: '26', statuteOfLimitationsYears: 3, faultType: 'no-fault', arcgisEndpoint: null },
  MN: { code: 'MN', name: 'Minnesota', fips: '27', statuteOfLimitationsYears: 6, faultType: 'no-fault', arcgisEndpoint: null },
  MS: { code: 'MS', name: 'Mississippi', fips: '28', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  MO: { code: 'MO', name: 'Missouri', fips: '29', statuteOfLimitationsYears: 5, faultType: 'at-fault', arcgisEndpoint: null },
  MT: { code: 'MT', name: 'Montana', fips: '30', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  NE: { code: 'NE', name: 'Nebraska', fips: '31', statuteOfLimitationsYears: 4, faultType: 'at-fault', arcgisEndpoint: null },
  NV: { code: 'NV', name: 'Nevada', fips: '32', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  NH: { code: 'NH', name: 'New Hampshire', fips: '33', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  NJ: { code: 'NJ', name: 'New Jersey', fips: '34', statuteOfLimitationsYears: 2, faultType: 'no-fault', arcgisEndpoint: null },
  NM: { code: 'NM', name: 'New Mexico', fips: '35', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  NY: { code: 'NY', name: 'New York', fips: '36', statuteOfLimitationsYears: 3, faultType: 'no-fault', arcgisEndpoint: null },
  NC: { code: 'NC', name: 'North Carolina', fips: '37', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  ND: { code: 'ND', name: 'North Dakota', fips: '38', statuteOfLimitationsYears: 6, faultType: 'no-fault', arcgisEndpoint: null },
  OH: { code: 'OH', name: 'Ohio', fips: '39', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  OK: { code: 'OK', name: 'Oklahoma', fips: '40', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  OR: { code: 'OR', name: 'Oregon', fips: '41', statuteOfLimitationsYears: 2, faultType: 'no-fault', arcgisEndpoint: null },
  PA: { code: 'PA', name: 'Pennsylvania', fips: '42', statuteOfLimitationsYears: 2, faultType: 'choice', arcgisEndpoint: null },
  RI: { code: 'RI', name: 'Rhode Island', fips: '44', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  SC: { code: 'SC', name: 'South Carolina', fips: '45', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  SD: { code: 'SD', name: 'South Dakota', fips: '46', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  TN: { code: 'TN', name: 'Tennessee', fips: '47', statuteOfLimitationsYears: 1, faultType: 'at-fault', arcgisEndpoint: null },
  TX: { code: 'TX', name: 'Texas', fips: '48', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  UT: { code: 'UT', name: 'Utah', fips: '49', statuteOfLimitationsYears: 4, faultType: 'no-fault', arcgisEndpoint: null },
  VT: { code: 'VT', name: 'Vermont', fips: '50', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  VA: { code: 'VA', name: 'Virginia', fips: '51', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  WA: { code: 'WA', name: 'Washington', fips: '53', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  WV: { code: 'WV', name: 'West Virginia', fips: '54', statuteOfLimitationsYears: 2, faultType: 'at-fault', arcgisEndpoint: null },
  WI: { code: 'WI', name: 'Wisconsin', fips: '55', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
  WY: { code: 'WY', name: 'Wyoming', fips: '56', statuteOfLimitationsYears: 4, faultType: 'at-fault', arcgisEndpoint: null },
  DC: { code: 'DC', name: 'District of Columbia', fips: '11', statuteOfLimitationsYears: 3, faultType: 'at-fault', arcgisEndpoint: null },
};

export const ALL_STATE_CODES = Object.keys(STATE_CATALOG);
export const NO_FAULT_STATES = Object.values(STATE_CATALOG).filter(s => s.faultType === 'no-fault').map(s => s.code);
export const CHOICE_STATES = Object.values(STATE_CATALOG).filter(s => s.faultType === 'choice').map(s => s.code);
