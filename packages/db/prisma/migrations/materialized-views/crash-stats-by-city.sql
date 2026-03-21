-- Materialized view: Crash statistics aggregated by city and state.
-- Refresh this periodically (e.g., after pipeline runs) for fast dashboard queries.
--
-- Usage: SELECT * FROM crash_stats_by_city WHERE state_code = 'NY' ORDER BY total_crashes DESC;
-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY crash_stats_by_city;

CREATE MATERIALIZED VIEW IF NOT EXISTS crash_stats_by_city AS
SELECT
  c."stateCode" AS state_code,
  COALESCE(c."cityName", 'Unknown') AS city_name,
  COALESCE(c."county", 'Unknown') AS county,
  COUNT(*) AS total_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'FATAL') AS fatal_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'SUSPECTED_SERIOUS_INJURY') AS serious_injury_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'SUSPECTED_MINOR_INJURY') AS minor_injury_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'PROPERTY_DAMAGE_ONLY') AS pdo_crashes,
  SUM(COALESCE(c."numberOfFatalities", 0)) AS total_fatalities,
  SUM(COALESCE(c."totalInjured", 0)) AS total_injuries,
  MIN(c."crashDate") AS earliest_crash,
  MAX(c."crashDate") AS latest_crash,
  AVG(COALESCE(c."numberOfVehicles", 0))::NUMERIC(5,2) AS avg_vehicles_per_crash,
  NOW() AS refreshed_at
FROM "Crash" c
GROUP BY c."stateCode", COALESCE(c."cityName", 'Unknown'), COALESCE(c."county", 'Unknown')
WITH DATA;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_crash_stats_city_unique
  ON crash_stats_by_city (state_code, city_name, county);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_crash_stats_city_state
  ON crash_stats_by_city (state_code);

CREATE INDEX IF NOT EXISTS idx_crash_stats_city_total
  ON crash_stats_by_city (total_crashes DESC);
