/**
 * Data source configurations for the pipeline.
 * Each source defines how to connect and fetch crash data.
 */

export interface DataSourceConfig {
  name: string
  type: 'FARS' | 'ARCGIS' | 'SOCRATA' | 'PDF' | 'MANUAL'
  stateCode?: string
  endpoint?: string
  isActive: boolean
  config?: Record<string, unknown>
}

export const DATA_SOURCES: DataSourceConfig[] = [
  {
    name: 'fars',
    type: 'FARS',
    endpoint: 'https://crashviewer.nhtsa.dot.gov/CrashAPI',
    isActive: true,
    config: {
      format: 'json',
      batchSize: 500,
    },
  },
  {
    name: 'arcgis-pa',
    type: 'ARCGIS',
    stateCode: 'PA',
    endpoint: 'https://gis.penndot.pa.gov/arcgis/rest/services/opendata/CrashData/FeatureServer',
    isActive: false,
    config: {
      layerId: 0,
      dateField: 'CRASH_DATE',
      batchSize: 2000,
    },
  },
  {
    name: 'arcgis-il',
    type: 'ARCGIS',
    stateCode: 'IL',
    endpoint: 'https://gis.dot.illinois.gov/arcgis/rest/services/',
    isActive: false,
    config: {
      layerId: 0,
      dateField: 'date_of_crash',
      batchSize: 2000,
    },
  },
]
