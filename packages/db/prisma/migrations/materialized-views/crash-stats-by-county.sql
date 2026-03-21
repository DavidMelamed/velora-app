-- Materialized view: Crash statistics aggregated by county and state.
-- Refresh this periodically (e.g., after pipeline runs) for fast dashboard queries.
--
-- Usage: SELECT * FROM crash_stats_by_county WHERE state_code = 'PA' ORDER BY total_crashes DESC;
-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY crash_stats_by_county;

CREATE MATERIALIZED VIEW IF NOT EXISTS crash_stats_by_county AS
SELECT
  c."stateCode" AS state_code,
  COALESCE(c."county", 'Unknown') AS county,
  COUNT(*) AS total_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'FATAL') AS fatal_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'SUSPECTED_SERIOUS_INJURY') AS serious_injury_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'SUSPECTED_MINOR_INJURY') AS minor_injury_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'POSSIBLE_INJURY') AS possible_injury_crashes,
  COUNT(*) FILTER (WHERE c."crashSeverity" = 'PROPERTY_DAMAGE_ONLY') AS pdo_crashes,
  SUM(COALESCE(c."numberOfFatalities", 0)) AS total_fatalities,
  SUM(COALESCE(c."totalInjured", 0)) AS total_injuries,
  COUNT(DISTINCT c."cityName") AS distinct_cities,
  MIN(c."crashDate") AS earliest_crash,
  MAX(c."crashDate") AS latest_crash,
  -- Severity distribution percentages
  ROUND(100.0 * COUNT(*) FILTER (WHERE c."crashSeverity" = 'FATAL') / NULLIF(COUNT(*), 0), 2) AS fatal_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c."crashSeverity" IN ('SUSPECTED_SERIOUS_INJURY', 'SUSPECTED_MINOR_INJURY', 'POSSIBLE_INJURY')) / NULLIF(COUNT(*), 0), 2) AS injury_pct,
  NOW() AS refreshed_at
FROM "Crash" c
GROUP BY c."stateCode", COALESCE(c."county", 'Unknown')
WITH DATA;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_crash_stats_county_unique
  ON crash_stats_by_county (state_code, county);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_crash_stats_county_state
  ON crash_stats_by_county (state_code);

CREATE INDEX IF NOT EXISTS idx_crash_stats_county_total
  ON crash_stats_by_county (total_crashes DESC);

CREATE INDEX IF NOT EXISTS idx_crash_stats_county_fatal
  ON crash_stats_by_county (fatal_crashes DESC);
