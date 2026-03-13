-- CreateEnum
CREATE TYPE "CrashSeverity" AS ENUM ('FATAL', 'SUSPECTED_SERIOUS_INJURY', 'SUSPECTED_MINOR_INJURY', 'POSSIBLE_INJURY', 'PROPERTY_DAMAGE_ONLY');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('FATAL', 'SUSPECTED_SERIOUS', 'SUSPECTED_MINOR', 'POSSIBLE', 'NO_APPARENT_INJURY');

-- CreateEnum
CREATE TYPE "MannerOfCollision" AS ENUM ('NOT_COLLISION_WITH_MV', 'FRONT_TO_REAR', 'FRONT_TO_FRONT', 'ANGLE', 'SIDESWIPE_SAME_DIRECTION', 'SIDESWIPE_OPPOSITE_DIRECTION', 'REAR_TO_SIDE', 'REAR_TO_REAR', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AtmosphericCondition" AS ENUM ('CLEAR', 'CLOUDY', 'RAIN', 'SNOW', 'SLEET_HAIL_FREEZING_RAIN', 'FOG_SMOG_SMOKE', 'BLOWING_SNOW', 'BLOWING_SAND_SOIL_DIRT', 'SEVERE_CROSSWINDS', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LightCondition" AS ENUM ('DAYLIGHT', 'DAWN', 'DUSK', 'DARK_LIGHTED', 'DARK_NOT_LIGHTED', 'DARK_UNKNOWN_LIGHTING', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('DRIVER', 'PASSENGER', 'PEDESTRIAN', 'PEDALCYCLIST', 'OCCUPANT_OF_NON_MV', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'NOT_REPORTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BodyTypeCategory" AS ENUM ('PASSENGER_CAR', 'SUV', 'PICKUP', 'VAN', 'LIGHT_TRUCK', 'MEDIUM_HEAVY_TRUCK', 'TRUCK_TRACTOR', 'MOTOR_HOME', 'BUS_SMALL', 'BUS_LARGE', 'MOTORCYCLE', 'MOPED', 'ATV', 'SNOWMOBILE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GeoEntityType" AS ENUM ('STATE', 'COUNTY', 'CITY', 'TRACT');

-- CreateTable
CREATE TABLE "Crash" (
    "id" TEXT NOT NULL,
    "stateUniqueId" TEXT NOT NULL,
    "agencyJurisdiction" TEXT,
    "policeReported" BOOLEAN NOT NULL DEFAULT true,
    "stateReportable" BOOLEAN NOT NULL DEFAULT true,
    "crashDate" TIMESTAMP(3) NOT NULL,
    "crashTime" TEXT,
    "roadwayClearanceTime" TIMESTAMP(3),
    "county" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "firstHarmfulEvent" TEXT,
    "firstHarmfulEventLoc" TEXT,
    "mannerOfCollision" "MannerOfCollision",
    "atmosphericCondition" "AtmosphericCondition",
    "lightCondition" "LightCondition",
    "relationToJunction" TEXT,
    "intersectionType" TEXT,
    "schoolBusRelated" BOOLEAN NOT NULL DEFAULT false,
    "workZone" JSONB,
    "secondaryCrash" BOOLEAN NOT NULL DEFAULT false,
    "crashRelatedFactors" TEXT[],
    "crashSeverity" "CrashSeverity",
    "stateCode" TEXT NOT NULL,
    "cityName" TEXT,
    "streetAddress" TEXT,
    "archetypeId" TEXT,
    "confirmationCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "dataSource" TEXT NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "crashId" TEXT NOT NULL,
    "vin" TEXT,
    "unitTypeAndNumber" INTEGER,
    "registrationState" TEXT,
    "licensePlate" TEXT,
    "make" TEXT,
    "modelYear" INTEGER,
    "model" TEXT,
    "bodyType" "BodyTypeCategory",
    "totalOccupants" INTEGER,
    "specialFunction" TEXT,
    "emergencyUse" BOOLEAN NOT NULL DEFAULT false,
    "speedLimit" INTEGER,
    "directionOfTravel" TEXT,
    "trafficwayDesc" TEXT,
    "totalLanes" INTEGER,
    "hitAndRun" BOOLEAN NOT NULL DEFAULT false,
    "sequenceOfEvents" TEXT[],
    "mostHarmfulEvent" TEXT,
    "contributingCircumstances" TEXT[],

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "personId" TEXT,
    "licenseJurisdiction" TEXT,
    "licenseClass" TEXT,
    "licenseStatus" TEXT,
    "speedingRelated" BOOLEAN,
    "driverActions" TEXT[],
    "distractedBy" TEXT,
    "driverCondition" TEXT,
    "suspectedAlcoholDrug" BOOLEAN,
    "alcoholDrugTestResults" JSONB,
    "driverRelatedFactors" TEXT[],

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "crashId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "name" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "sex" "Sex",
    "personType" "PersonType" NOT NULL,
    "injuryStatus" "InjuryStatus",
    "motorVehicleUnitNumber" INTEGER,
    "seatingPosition" TEXT,
    "restraintUse" TEXT,
    "airBagDeployed" TEXT,
    "ejection" TEXT,
    "nonMotoristLocation" TEXT,
    "nonMotoristAction" TEXT,
    "nonMotoristCondition" TEXT,
    "personRelatedFactors" TEXT[],

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashNarrative" (
    "id" TEXT NOT NULL,
    "crashId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "factualAccuracy" DOUBLE PRECISION,
    "toneScore" DOUBLE PRECISION,
    "readabilityScore" DOUBLE PRECISION,
    "approvalRate" DOUBLE PRECISION,
    "modelTier" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT,
    "dataTier" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationMs" INTEGER,

    CONSTRAINT "CrashNarrative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashEqualizer" (
    "id" TEXT NOT NULL,
    "crashId" TEXT NOT NULL,
    "comparableCohort" JSONB NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "liabilitySignals" JSONB NOT NULL,
    "settlementContext" JSONB NOT NULL,
    "attorneyMatches" JSONB NOT NULL,
    "briefingSections" JSONB NOT NULL,
    "disclaimer" TEXT NOT NULL DEFAULT 'This analysis is based on public crash data and is not legal advice.',
    "modelVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationMs" INTEGER,

    CONSTRAINT "CrashEqualizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attorney" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firmName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "googlePlaceId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "practiceAreas" TEXT[],
    "barNumber" TEXT,
    "yearsExperience" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attorney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttorneyReview" (
    "id" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "googleReviewId" TEXT,
    "authorName" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "publishedAt" TIMESTAMP(3),
    "language" TEXT DEFAULT 'en',
    "dimensions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttorneyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIntelligence" (
    "id" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "communication" DOUBLE PRECISION NOT NULL,
    "outcome" DOUBLE PRECISION NOT NULL,
    "responsiveness" DOUBLE PRECISION NOT NULL,
    "empathy" DOUBLE PRECISION NOT NULL,
    "expertise" DOUBLE PRECISION NOT NULL,
    "feeTransparency" DOUBLE PRECISION NOT NULL,
    "trialExperience" DOUBLE PRECISION NOT NULL,
    "satisfaction" DOUBLE PRECISION NOT NULL,
    "trend" TEXT NOT NULL,
    "trendPeriodMonths" INTEGER NOT NULL DEFAULT 12,
    "bestQuotes" JSONB NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttorneyIndex" (
    "id" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "communicationScore" DOUBLE PRECISION NOT NULL,
    "responsivenessScore" DOUBLE PRECISION NOT NULL,
    "outcomeScore" DOUBLE PRECISION NOT NULL,
    "reviewCountScore" DOUBLE PRECISION NOT NULL,
    "specialtyScore" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewCount" INTEGER NOT NULL,
    "dataQuality" TEXT NOT NULL,

    CONSTRAINT "AttorneyIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoEntity" (
    "id" TEXT NOT NULL,
    "type" "GeoEntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "countyFips" TEXT,
    "cityFips" TEXT,
    "parentId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "population" INTEGER,
    "statuteOfLimitationsYears" INTEGER,
    "faultType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intersection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "city" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "dangerScore" DOUBLE PRECISION,
    "totalCrashes" INTEGER NOT NULL DEFAULT 0,
    "fatalCrashes" INTEGER NOT NULL DEFAULT 0,
    "injuryCrashes" INTEGER NOT NULL DEFAULT 0,
    "lastCrashDate" TIMESTAMP(3),
    "lastComputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intersection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stateCode" TEXT,
    "endpoint" TEXT,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastRecordCount" INTEGER,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsIn" INTEGER NOT NULL DEFAULT 0,
    "recordsOut" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineDeadLetter" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "rawRecord" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashArchetype" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateCode" TEXT,
    "centroid" JSONB NOT NULL,
    "crashCount" INTEGER NOT NULL,
    "avgSeverity" DOUBLE PRECISION NOT NULL,
    "injuryRate" DOUBLE PRECISION NOT NULL,
    "fatalityRate" DOUBLE PRECISION NOT NULL,
    "seasonalPattern" JSONB NOT NULL,
    "definingAttributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrashArchetype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "crashId" TEXT,
    "sessionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "experimentId" TEXT,
    "variant" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackAggregate" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "crashType" TEXT,
    "severity" TEXT,
    "archetypeId" TEXT,
    "narrativeApprovalRate" DOUBLE PRECISION NOT NULL,
    "equalizerUsefulRate" DOUBLE PRECISION NOT NULL,
    "avgTimeOnPage" DOUBLE PRECISION NOT NULL,
    "scrollThroughRate" DOUBLE PRECISION NOT NULL,
    "attorneyClickRate" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "parentId" TEXT,
    "archetypeId" TEXT,
    "promptContent" JSONB NOT NULL,
    "mutations" JSONB,
    "scores" JSONB,
    "compositeScore" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "winnerId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Crash_stateUniqueId_key" ON "Crash"("stateUniqueId");

-- CreateIndex
CREATE INDEX "Crash_crashDate_idx" ON "Crash"("crashDate");

-- CreateIndex
CREATE INDEX "Crash_county_idx" ON "Crash"("county");

-- CreateIndex
CREATE INDEX "Crash_stateCode_idx" ON "Crash"("stateCode");

-- CreateIndex
CREATE INDEX "Crash_latitude_longitude_idx" ON "Crash"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Crash_crashSeverity_idx" ON "Crash"("crashSeverity");

-- CreateIndex
CREATE INDEX "Crash_dataSource_idx" ON "Crash"("dataSource");

-- CreateIndex
CREATE INDEX "Crash_stateCode_crashDate_idx" ON "Crash"("stateCode", "crashDate");

-- CreateIndex
CREATE INDEX "Crash_archetypeId_idx" ON "Crash"("archetypeId");

-- CreateIndex
CREATE INDEX "Vehicle_crashId_idx" ON "Vehicle"("crashId");

-- CreateIndex
CREATE INDEX "Vehicle_vin_idx" ON "Vehicle"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_vehicleId_key" ON "Driver"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_personId_key" ON "Driver"("personId");

-- CreateIndex
CREATE INDEX "Person_crashId_idx" ON "Person"("crashId");

-- CreateIndex
CREATE INDEX "Person_injuryStatus_idx" ON "Person"("injuryStatus");

-- CreateIndex
CREATE INDEX "Person_personType_idx" ON "Person"("personType");

-- CreateIndex
CREATE UNIQUE INDEX "CrashNarrative_crashId_key" ON "CrashNarrative"("crashId");

-- CreateIndex
CREATE INDEX "CrashNarrative_modelTier_idx" ON "CrashNarrative"("modelTier");

-- CreateIndex
CREATE INDEX "CrashNarrative_dataTier_idx" ON "CrashNarrative"("dataTier");

-- CreateIndex
CREATE UNIQUE INDEX "CrashEqualizer_crashId_key" ON "CrashEqualizer"("crashId");

-- CreateIndex
CREATE INDEX "CrashEqualizer_confidenceLevel_idx" ON "CrashEqualizer"("confidenceLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Attorney_slug_key" ON "Attorney"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Attorney_googlePlaceId_key" ON "Attorney"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Attorney_stateCode_idx" ON "Attorney"("stateCode");

-- CreateIndex
CREATE INDEX "Attorney_city_idx" ON "Attorney"("city");

-- CreateIndex
CREATE INDEX "Attorney_latitude_longitude_idx" ON "Attorney"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "AttorneyReview_googleReviewId_key" ON "AttorneyReview"("googleReviewId");

-- CreateIndex
CREATE INDEX "AttorneyReview_attorneyId_idx" ON "AttorneyReview"("attorneyId");

-- CreateIndex
CREATE INDEX "AttorneyReview_rating_idx" ON "AttorneyReview"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewIntelligence_attorneyId_key" ON "ReviewIntelligence"("attorneyId");

-- CreateIndex
CREATE INDEX "ReviewIntelligence_communication_idx" ON "ReviewIntelligence"("communication");

-- CreateIndex
CREATE INDEX "ReviewIntelligence_outcome_idx" ON "ReviewIntelligence"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "AttorneyIndex_attorneyId_key" ON "AttorneyIndex"("attorneyId");

-- CreateIndex
CREATE INDEX "AttorneyIndex_score_idx" ON "AttorneyIndex"("score");

-- CreateIndex
CREATE INDEX "GeoEntity_stateCode_idx" ON "GeoEntity"("stateCode");

-- CreateIndex
CREATE INDEX "GeoEntity_type_idx" ON "GeoEntity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "GeoEntity_type_stateCode_name_key" ON "GeoEntity"("type", "stateCode", "name");

-- CreateIndex
CREATE INDEX "Intersection_stateCode_idx" ON "Intersection"("stateCode");

-- CreateIndex
CREATE INDEX "Intersection_dangerScore_idx" ON "Intersection"("dangerScore");

-- CreateIndex
CREATE UNIQUE INDEX "Intersection_latitude_longitude_key" ON "Intersection"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_name_key" ON "DataSource"("name");

-- CreateIndex
CREATE INDEX "DataSource_type_idx" ON "DataSource"("type");

-- CreateIndex
CREATE INDEX "DataSource_isActive_idx" ON "DataSource"("isActive");

-- CreateIndex
CREATE INDEX "PipelineRun_dataSourceId_idx" ON "PipelineRun"("dataSourceId");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- CreateIndex
CREATE INDEX "PipelineRun_startedAt_idx" ON "PipelineRun"("startedAt");

-- CreateIndex
CREATE INDEX "PipelineDeadLetter_dataSourceId_idx" ON "PipelineDeadLetter"("dataSourceId");

-- CreateIndex
CREATE INDEX "PipelineDeadLetter_stage_idx" ON "PipelineDeadLetter"("stage");

-- CreateIndex
CREATE INDEX "PipelineDeadLetter_errorType_idx" ON "PipelineDeadLetter"("errorType");

-- CreateIndex
CREATE INDEX "CrashArchetype_stateCode_idx" ON "CrashArchetype"("stateCode");

-- CreateIndex
CREATE INDEX "CrashArchetype_crashCount_idx" ON "CrashArchetype"("crashCount");

-- CreateIndex
CREATE INDEX "FeedbackEvent_type_idx" ON "FeedbackEvent"("type");

-- CreateIndex
CREATE INDEX "FeedbackEvent_crashId_idx" ON "FeedbackEvent"("crashId");

-- CreateIndex
CREATE INDEX "FeedbackEvent_sessionId_idx" ON "FeedbackEvent"("sessionId");

-- CreateIndex
CREATE INDEX "FeedbackEvent_createdAt_idx" ON "FeedbackEvent"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackEvent_experimentId_idx" ON "FeedbackEvent"("experimentId");

-- CreateIndex
CREATE INDEX "FeedbackAggregate_period_idx" ON "FeedbackAggregate"("period");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackAggregate_period_crashType_severity_key" ON "FeedbackAggregate"("period", "crashType", "severity");

-- CreateIndex
CREATE INDEX "PromptVersion_signature_isActive_idx" ON "PromptVersion"("signature", "isActive");

-- CreateIndex
CREATE INDEX "PromptVersion_signature_archetypeId_idx" ON "PromptVersion"("signature", "archetypeId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_signature_version_key" ON "PromptVersion"("signature", "version");

-- CreateIndex
CREATE INDEX "Experiment_status_idx" ON "Experiment"("status");

-- CreateIndex
CREATE INDEX "Experiment_signature_idx" ON "Experiment"("signature");

-- CreateIndex
CREATE INDEX "AgentSession_agentId_idx" ON "AgentSession"("agentId");

-- CreateIndex
CREATE INDEX "AgentSession_status_idx" ON "AgentSession"("status");

-- CreateIndex
CREATE INDEX "AgentSession_createdAt_idx" ON "AgentSession"("createdAt");

-- AddForeignKey
ALTER TABLE "Crash" ADD CONSTRAINT "Crash_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "CrashArchetype"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_crashId_fkey" FOREIGN KEY ("crashId") REFERENCES "Crash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_crashId_fkey" FOREIGN KEY ("crashId") REFERENCES "Crash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashNarrative" ADD CONSTRAINT "CrashNarrative_crashId_fkey" FOREIGN KEY ("crashId") REFERENCES "Crash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashEqualizer" ADD CONSTRAINT "CrashEqualizer_crashId_fkey" FOREIGN KEY ("crashId") REFERENCES "Crash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttorneyReview" ADD CONSTRAINT "AttorneyReview_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "Attorney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIntelligence" ADD CONSTRAINT "ReviewIntelligence_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "Attorney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttorneyIndex" ADD CONSTRAINT "AttorneyIndex_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "Attorney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoEntity" ADD CONSTRAINT "GeoEntity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GeoEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackEvent" ADD CONSTRAINT "FeedbackEvent_crashId_fkey" FOREIGN KEY ("crashId") REFERENCES "Crash"("id") ON DELETE SET NULL ON UPDATE CASCADE;
