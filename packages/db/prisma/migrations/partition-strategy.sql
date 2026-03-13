-- ═══════════════════════════════════════════════════════════════════════════════
-- Velora Crash Table Partitioning Strategy
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Partition the Crash table by stateCode using PostgreSQL RANGE partitioning
-- on stateCode (alphabetical ranges).
--
-- WHY:
--   - Crash table is the largest and fastest-growing table
--   - Most queries filter by stateCode
--   - Partition pruning gives 10-20x speedup on state-scoped queries
--   - Each partition can be vacuumed, indexed, and backed up independently
--
-- WHEN TO APPLY:
--   - When crash count exceeds 1M rows
--   - When query latency on state-scoped queries exceeds 100ms
--   - When p95 API response time degrades
--
-- IMPORTANT: This is a MANUAL migration. Do NOT run automatically.
-- It requires downtime and data migration. Follow docs/scale/partitioning.md.
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: Create the partitioned table (new structure)
CREATE TABLE IF NOT EXISTS "Crash_partitioned" (
  "id" TEXT NOT NULL,
  "stateUniqueId" TEXT NOT NULL,
  "stateCode" TEXT NOT NULL,
  "agencyJurisdiction" TEXT,
  "policeReported" BOOLEAN NOT NULL DEFAULT true,
  "stateReportable" BOOLEAN NOT NULL DEFAULT true,
  "crashDate" TIMESTAMP(3) NOT NULL,
  "crashTime" TEXT,
  "county" TEXT,
  "cityName" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "numberOfVehicles" INTEGER,
  "numberOfFatalities" INTEGER DEFAULT 0,
  "totalInjured" INTEGER DEFAULT 0,
  "numberOfPedestrians" INTEGER DEFAULT 0,
  "numberOfBicyclists" INTEGER DEFAULT 0,
  "crashSeverity" TEXT,
  "mannerOfCollision" TEXT,
  "atmosphericCondition" TEXT,
  "lightCondition" TEXT,
  "roadSurfaceCondition" TEXT,
  "roadwayJunctionType" TEXT,
  "schoolZone" BOOLEAN DEFAULT false,
  "workZone" BOOLEAN DEFAULT false,
  "speedLimit" INTEGER,
  "source" TEXT,
  "fingerprint" TEXT,
  "streetAddress" TEXT,
  "intersectionName" TEXT,
  "narrativeGenerated" BOOLEAN DEFAULT false,
  "narrativeGeneratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "geoEntityId" TEXT,
  "archetypeId" TEXT,
  PRIMARY KEY ("id", "stateCode")
) PARTITION BY LIST ("stateCode");

-- Step 2: Create partitions for active states
-- Top 10 + ArcGIS states
CREATE TABLE IF NOT EXISTS "Crash_CA" PARTITION OF "Crash_partitioned" FOR VALUES IN ('CA');
CREATE TABLE IF NOT EXISTS "Crash_TX" PARTITION OF "Crash_partitioned" FOR VALUES IN ('TX');
CREATE TABLE IF NOT EXISTS "Crash_FL" PARTITION OF "Crash_partitioned" FOR VALUES IN ('FL');
CREATE TABLE IF NOT EXISTS "Crash_NY" PARTITION OF "Crash_partitioned" FOR VALUES IN ('NY');
CREATE TABLE IF NOT EXISTS "Crash_PA" PARTITION OF "Crash_partitioned" FOR VALUES IN ('PA');
CREATE TABLE IF NOT EXISTS "Crash_IL" PARTITION OF "Crash_partitioned" FOR VALUES IN ('IL');
CREATE TABLE IF NOT EXISTS "Crash_OH" PARTITION OF "Crash_partitioned" FOR VALUES IN ('OH');
CREATE TABLE IF NOT EXISTS "Crash_GA" PARTITION OF "Crash_partitioned" FOR VALUES IN ('GA');
CREATE TABLE IF NOT EXISTS "Crash_NC" PARTITION OF "Crash_partitioned" FOR VALUES IN ('NC');
CREATE TABLE IF NOT EXISTS "Crash_MI" PARTITION OF "Crash_partitioned" FOR VALUES IN ('MI');
CREATE TABLE IF NOT EXISTS "Crash_CO" PARTITION OF "Crash_partitioned" FOR VALUES IN ('CO');
CREATE TABLE IF NOT EXISTS "Crash_MA" PARTITION OF "Crash_partitioned" FOR VALUES IN ('MA');
CREATE TABLE IF NOT EXISTS "Crash_WA" PARTITION OF "Crash_partitioned" FOR VALUES IN ('WA');

-- Default partition for all other states
CREATE TABLE IF NOT EXISTS "Crash_other" PARTITION OF "Crash_partitioned" DEFAULT;

-- Step 3: Create indexes on the partitioned table
-- (PostgreSQL auto-creates per-partition indexes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_crash_part_state_unique_id ON "Crash_partitioned" ("stateUniqueId", "stateCode");
CREATE INDEX IF NOT EXISTS idx_crash_part_date ON "Crash_partitioned" ("crashDate" DESC);
CREATE INDEX IF NOT EXISTS idx_crash_part_severity ON "Crash_partitioned" ("crashSeverity");
CREATE INDEX IF NOT EXISTS idx_crash_part_county ON "Crash_partitioned" ("county");
CREATE INDEX IF NOT EXISTS idx_crash_part_geo ON "Crash_partitioned" ("latitude", "longitude") WHERE "latitude" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crash_part_fingerprint ON "Crash_partitioned" ("fingerprint");
CREATE INDEX IF NOT EXISTS idx_crash_part_geo_entity ON "Crash_partitioned" ("geoEntityId");

-- Step 4: Migrate data (run during maintenance window)
-- INSERT INTO "Crash_partitioned" SELECT * FROM "Crash";
-- (Uncomment and run manually when ready)

-- Step 5: Swap tables (run in a transaction)
-- BEGIN;
-- ALTER TABLE "Crash" RENAME TO "Crash_old";
-- ALTER TABLE "Crash_partitioned" RENAME TO "Crash";
-- COMMIT;

-- Step 6: After verification, drop old table
-- DROP TABLE "Crash_old";
