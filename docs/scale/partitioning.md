# Crash Table Partitioning Strategy

## Overview

The `Crash` table is partitioned by `stateCode` using PostgreSQL LIST partitioning. This provides partition pruning for state-scoped queries (the most common access pattern), enabling 10-20x speedups at scale.

## When to Apply

Apply partitioning when ANY of these thresholds are met:

- Crash table exceeds **1 million rows**
- State-scoped query latency exceeds **100ms at p95**
- API response times degrade beyond acceptable thresholds
- Database VACUUM takes longer than maintenance windows

## Partition Layout

| Partition | States | Expected Volume |
|-----------|--------|-----------------|
| Crash_CA | California | High |
| Crash_TX | Texas | High |
| Crash_FL | Florida | High |
| Crash_NY | New York | High |
| Crash_PA | Pennsylvania | Medium |
| Crash_IL | Illinois | Medium |
| Crash_OH | Ohio | Medium |
| Crash_GA | Georgia | Medium |
| Crash_NC | North Carolina | Medium |
| Crash_MI | Michigan | Medium |
| Crash_CO | Colorado | Low |
| Crash_MA | Massachusetts | Low |
| Crash_WA | Washington | Low |
| Crash_other | All remaining states | Variable |

## Migration Steps

### Pre-migration

1. Take a database backup
2. Schedule a maintenance window (expect 10-30 minutes for 1M rows)
3. Notify affected services

### Migration

```bash
# 1. Connect to the database
psql $DATABASE_URL

# 2. Run the partition DDL (creates new partitioned table)
\i packages/db/prisma/migrations/partition-strategy.sql

# 3. Migrate data (adjust batch size for your data volume)
INSERT INTO "Crash_partitioned"
SELECT * FROM "Crash";

# 4. Verify row counts match
SELECT COUNT(*) FROM "Crash";
SELECT COUNT(*) FROM "Crash_partitioned";

# 5. Swap tables in a transaction
BEGIN;
ALTER TABLE "Crash" RENAME TO "Crash_old";
ALTER TABLE "Crash_partitioned" RENAME TO "Crash";
COMMIT;

# 6. Verify application works with the new table

# 7. After 24h of verification, drop the old table
DROP TABLE "Crash_old";
```

### Post-migration

- Update Prisma schema if needed (partitioning is transparent to Prisma)
- Monitor query performance for improvements
- Set up per-partition VACUUM schedules

## Adding New State Partitions

When expanding to new high-volume states:

```sql
-- Example: Adding Virginia
CREATE TABLE "Crash_VA" PARTITION OF "Crash"
  FOR VALUES IN ('VA');

-- Move existing VA data from default partition
-- (requires detaching/reattaching default partition)
BEGIN;
ALTER TABLE "Crash" DETACH PARTITION "Crash_other";
CREATE TABLE "Crash_other_new" PARTITION OF "Crash" DEFAULT;
INSERT INTO "Crash_other_new" SELECT * FROM "Crash_other" WHERE "stateCode" != 'VA';
INSERT INTO "Crash_VA" SELECT * FROM "Crash_other" WHERE "stateCode" = 'VA';
DROP TABLE "Crash_other";
ALTER TABLE "Crash_other_new" RENAME TO "Crash_other";
COMMIT;
```

## Prisma Compatibility

PostgreSQL partitioning is transparent to Prisma Client. Queries work identically. The key requirement is that the partition key (`stateCode`) must be part of the primary key in the partitioned table.

## Monitoring Partitions

```sql
-- Check partition sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'Crash_%'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```
