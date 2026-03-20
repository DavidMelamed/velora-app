# Velora Launch Guide

> Step-by-step plan to go from current state to production deployment.

---

## Current State (What's Built)

| Layer | Status | Details |
|-------|--------|---------|
| **Database Schema** | Ready | 35 Prisma models, 16 enums, all indexes defined |
| **API Server** | Ready | 40+ Express routes, Zod validation, rate limiting, auth middleware |
| **Web App** | Ready | Next.js 15, 15+ pages, redesigned homepage, case dashboard, attorney directory |
| **Mobile App** | Ready | Expo 52, 5 tabs, geofencing, voice recording, chat, onboarding |
| **AI Pipeline** | Ready | Entity extraction, narrative generation, equalizer briefings, case shepherd |
| **MCP Server** | Ready | 19 tools (crash, attorney, case, trend) |
| **Case Memory** | Ready | Episodes, entities, facts, timeline, confirmations, gap detection |
| **Commercial** | Ready | Lead gen CTA, email gate, consultation forms, attorney claim path |
| **Auth** | Scaffolded | Clerk middleware + pages ready, needs API keys |
| **File Storage** | Ready | Local dev, S3 production code written |
| **Transcription** | Ready | Whisper/Gemini, needs API key (already have OPENROUTER_API_KEY) |

---

## What's Missing (Pre-Launch Checklist)

### Must Have (Blocks Launch)

- [ ] **Database migration** — Push schema to production DB
- [ ] **Clerk API keys** — Enable authentication
- [ ] **Seed providers** — Populate geofencing provider database
- [ ] **Environment variables** — Configure all services for production
- [ ] **CORS configuration** — Set production domains
- [ ] **Domain + SSL** — Point domain to Vercel/Railway

### Should Have (Launch Week)

- [ ] **S3 bucket** — For production file uploads (voice notes, photos)
- [ ] **Error monitoring** — Sentry or similar
- [ ] **Analytics** — PostHog, Mixpanel, or GA4
- [ ] **Transactional email** — For lead notifications to attorneys
- [ ] **Push notification service** — For mobile check-ins (Expo Push)

### Nice to Have (Post-Launch)

- [ ] **CDN for uploads** — CloudFront in front of S3
- [ ] **Database read replicas** — For heavy query load
- [ ] **Rate limiting per user** — Beyond IP-based limiting
- [ ] **Admin dashboard auth** — Protect /admin routes

---

## Step-by-Step Deployment

### Step 1: Set Up Accounts (30 minutes)

You need these accounts (all have free tiers):

| Service | Purpose | Free Tier | Sign Up |
|---------|---------|-----------|---------|
| **Railway** | API + PostgreSQL + Redis | $5/mo credit | railway.app |
| **Vercel** | Web app hosting | Unlimited hobby | vercel.com |
| **Clerk** | Authentication | 10K MAU | clerk.com |
| **Qdrant Cloud** | Vector search | 1GB free | cloud.qdrant.io |
| **OpenRouter** | AI (Gemini, Whisper) | Pay-as-you-go | openrouter.ai |
| **AWS S3** (optional) | File storage | 5GB free | aws.amazon.com |

You likely already have Railway (database), OpenRouter, and Qdrant from the existing platform.

### Step 2: Configure Clerk (10 minutes)

1. Go to [clerk.com](https://clerk.com) → Sign up → Create Application
2. Application settings:
   - Name: "Velora"
   - Sign-in methods: Enable **Phone number** + **Email address**
   - Social: Optional (Google, Apple)
3. Copy keys from Dashboard → API Keys:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
4. Set redirect URLs in Clerk Dashboard → Paths:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in: `/`
   - After sign-up: `/`

### Step 3: Configure Environment Variables

Create/update `.env` in the project root with ALL production values:

```bash
# ─── Database ─────────────────────────────────────────
DATABASE_URL="postgresql://postgres:***@your-railway-host:port/railway"
REDIS_URL="redis://default:***@your-railway-redis:port"

# ─── AI Providers ─────────────────────────────────────
OPENROUTER_API_KEY=sk-or-...          # Required: powers search, extraction, chat
# Optional additional providers:
ANTHROPIC_API_KEY=                     # Direct Claude access
GOOGLE_GENERATIVE_AI_API_KEY=          # Gemini (backup + transcription)
OPENAI_API_KEY=                        # Whisper transcription + embeddings

# ─── Authentication ───────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# ─── Web App ─────────────────────────────────────────
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...     # For crash maps

# ─── API Server ───────────────────────────────────────
PORT=4000
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
NODE_ENV=production

# ─── PayloadCMS ───────────────────────────────────────
PAYLOAD_SECRET=generate-a-random-64-char-string

# ─── File Storage ─────────────────────────────────────
FILE_STORAGE_TYPE=s3                   # 's3' for production, 'local' for dev
S3_BUCKET=velora-uploads
S3_REGION=us-east-1
PUBLIC_FILE_URL=https://velora-uploads.s3.us-east-1.amazonaws.com

# ─── Case Sharing ─────────────────────────────────────
SHARE_LINK_SECRET=generate-a-random-string-here

# ─── Vector Database ─────────────────────────────────
QDRANT_URL=https://your-cluster.cloud.qdrant.io:6333
QDRANT_API_KEY=...

# ─── Optional Services ───────────────────────────────
GOOGLE_PLACES_API_KEY=                 # Attorney data enrichment
DATAFORSEO_LOGIN=                      # Attorney reviews
DATAFORSEO_PASSWORD=
```

### Step 4: Push Database Schema (5 minutes)

```bash
# From project root
cd packages/db

# Generate Prisma client
DATABASE_URL="your-production-url" npx prisma generate

# Push schema to production (creates all tables)
DATABASE_URL="your-production-url" npx prisma db push

# Verify tables were created
DATABASE_URL="your-production-url" npx prisma studio
```

This creates all 35 tables including the new ones:
- Matter, Episode, CaseEntity, CaseFact, CaseTimeline
- Confirmation, Provider, ExtractionDeadLetter
- LeadRequest, EmailCapture

### Step 5: Seed Data (10 minutes)

```bash
# Seed state/geo data (51 states)
DATABASE_URL="your-url" npx tsx apps/pipeline/src/scripts/seed-geo.ts

# Seed medical providers for geofencing (22 providers, 5 cities)
DATABASE_URL="your-url" npx tsx apps/pipeline/src/scripts/seed-providers.ts

# Import crash data (FARS — national dataset)
DATABASE_URL="your-url" npx tsx apps/pipeline/src/index.ts ingest --source fars --stateCode CO --fromYear 2022

# Import attorney data (if DataForSEO configured)
DATABASE_URL="your-url" npx tsx apps/pipeline/src/scripts/ingest-attorneys.ts
```

### Step 6: Deploy API to Railway (15 minutes)

1. In Railway dashboard, create new service from your repo
2. Set root directory: `apps/api`
3. Set build command: `pnpm install && pnpm build`
4. Set start command: `node dist/index.js`
5. Add ALL environment variables from Step 3
6. Add health check path: `/health`
7. Generate domain: `api-yourdomain.up.railway.app`
8. Optional: Add custom domain `api.yourdomain.com`

Verify deployment:
```bash
curl https://api.yourdomain.com/health
# Should return: {"status":"ok","server":"velora-api",...}
```

### Step 7: Deploy Web to Vercel (10 minutes)

1. Connect your repo to Vercel
2. Set framework: Next.js
3. Set root directory: `apps/web`
4. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   DATABASE_URL=your-production-db-url
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
   PAYLOAD_SECRET=your-secret
   ```
5. Deploy
6. Set custom domain: `yourdomain.com`

Verify:
- Homepage loads with live stats
- `/attorneys` shows attorney directory
- `/search` renders search interface
- `/sign-in` shows Clerk sign-in page

### Step 8: Deploy MCP Server (5 minutes)

The MCP server can run as part of the API or standalone:

```bash
# As part of API (add to Railway)
# In package.json scripts:
"mcp:start": "node dist/mcp-server/index.js --transport http --port 4100"

# Or publish to npm for Claude Desktop integration
cd apps/mcp-server
npm publish
```

### Step 9: Build Mobile App (30 minutes)

```bash
cd apps/mobile

# Update app.json with your production API URL
# Set EXPO_PUBLIC_API_URL in eas.json

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

For TestFlight/internal testing first:
```bash
eas build --platform ios --profile preview
```

### Step 10: Configure S3 for File Uploads (15 minutes)

1. Create S3 bucket: `velora-uploads`
2. Bucket policy (public read):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::velora-uploads/*"
     }]
   }
   ```
3. CORS configuration:
   ```json
   [{
     "AllowedOrigins": ["https://yourdomain.com", "https://api.yourdomain.com"],
     "AllowedMethods": ["GET", "PUT", "POST"],
     "AllowedHeaders": ["*"]
   }]
   ```
4. Create IAM user with S3 access, add keys to Railway env vars:
   ```
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

---

## How to Use the Platform

### For Accident Victims (Mobile App)

1. **Download app** → Open → Onboarding screen
2. **Grant permissions** → Location (for treatment tracking) + Notifications (for confirmations)
3. **Get Started** → Creates a case (Matter) automatically
4. **My Case tab** shows:
   - Case status + statute of limitations countdown
   - Quick actions: Record voice note, take photo, chat
   - Pending confirmations (tap Yes/No)
   - Recent activity timeline
5. **Chat tab** → Talk to Case Shepherd AI:
   - "I went to PT today" → Logged automatically
   - "My back still hurts" → Injury noted
   - "When is my next appointment?" → Checks your timeline
6. **Background tracking** → App detects visits to medical providers via geofencing
7. **Confirmations** → Push notification: "Did you visit Spine Center today?" → Tap Yes/No

### For Attorneys (Web Dashboard)

1. **Visit** `/case/[matterId]` (shared by client)
2. **See** 3-column dashboard:
   - Left: Key entities (providers, injuries, medications) with confidence scores
   - Center: Full case timeline with color-coded events and gap detection
   - Right: Known facts (subject-predicate-object) with temporal validity
3. **Export** → Click "Export PDF" for printable case chronology
4. **Share** → Generate secure share link (30-day expiry, no PII)

### For the General Public (Web)

1. **Search** → Natural language queries about crashes, intersections, attorneys
2. **Crash Detail** → View AI-generated narrative, map, severity, comparable crashes
3. **Equalizer Report** → Settlement ranges, liability signals, attorney matches
4. **Attorney Directory** → Search 63K+ attorneys by location, filter by state, sort by AI Index score
5. **Attorney Profile** → 8-dimension review analysis, best quotes, consultation CTA

### For Attorneys Claiming Profiles

1. **Find your profile** at `/attorneys/[slug]`
2. **Request Consultation** CTA visible to potential clients
3. *(Future: claim flow, premium placement, lead routing)*

---

## Post-Launch Priorities

### Week 1: Monitor & Fix
- [ ] Watch error logs (Railway logs, Vercel logs)
- [ ] Monitor API response times
- [ ] Check heartbeat health checks (every 30 min)
- [ ] Verify geofencing works on real devices
- [ ] Test voice recording → transcription → extraction pipeline end-to-end

### Week 2: Growth
- [ ] Run FARS ingestion for top 10 states
- [ ] Seed providers for top 20 metro areas
- [ ] Set up Google Search Console for SEO pages
- [ ] Submit sitemap (`/sitemap.xml`)
- [ ] Set up analytics (PostHog or GA4)

### Week 3: Monetization
- [ ] Add Stripe for attorney premium subscriptions
- [ ] Build attorney claim flow (verify via bar number)
- [ ] Set up transactional email (Resend or SendGrid) for lead notifications
- [ ] Add attorney dashboard showing their leads + profile views

### Month 2: Scale
- [ ] Add more data sources (ArcGIS adapters for additional states)
- [ ] Run attorney review ingestion (DataForSEO)
- [ ] Compute Attorney Index scores (batch job)
- [ ] Build review intelligence (8-dimension analysis)
- [ ] A/B test equalizer email gate conversion

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USERS                                 │
│  Accident Victims (Mobile)  │  Attorneys (Web)  │ Public │
└─────────────┬───────────────┴────────┬──────────┴───────┘
              │                        │
    ┌─────────▼─────────┐    ┌────────▼────────┐
    │   Expo Mobile App  │    │  Next.js Web App │
    │  (EAS / App Store) │    │    (Vercel)       │
    └─────────┬─────────┘    └────────┬────────┘
              │                        │
              └────────────┬───────────┘
                           │
                  ┌────────▼────────┐
                  │   Express API    │
                  │   (Railway)      │
                  │                  │
                  │ • Case Memory    │
                  │ • AI Search      │
                  │ • Equalizer      │
                  │ • Lead Gen       │
                  │ • Auth (Clerk)   │
                  └──┬────┬────┬───┘
                     │    │    │
          ┌──────────┘    │    └──────────┐
          │               │               │
   ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
   │ PostgreSQL   │ │   Redis    │ │   Qdrant    │
   │ (Railway)    │ │ (Railway)  │ │  (Cloud)    │
   │              │ │            │ │             │
   │ 35 tables    │ │ Cache +    │ │ Vector      │
   │ Crash data   │ │ Rate limit │ │ Search      │
   │ Case memory  │ │            │ │ 800K+       │
   │ Attorneys    │ │            │ │ reviews     │
   └──────────────┘ └────────────┘ └─────────────┘
          │
   ┌──────▼──────┐     ┌─────────────┐
   │    S3        │     │  OpenRouter  │
   │ (AWS)        │     │  (AI)       │
   │              │     │             │
   │ Voice notes  │     │ Gemini Flash│
   │ Photos       │     │ Whisper     │
   │ Documents    │     │ Embeddings  │
   └──────────────┘     └─────────────┘
```

---

## Key Commands

```bash
# Development
pnpm dev                          # Start all services
cd apps/web && pnpm dev           # Web only (port 3000)
cd apps/api && pnpm dev           # API only (port 4000)

# Database
npx prisma generate               # Generate client after schema changes
npx prisma db push                 # Push schema to DB (dev)
npx prisma migrate deploy          # Apply migrations (production)
npx prisma studio                  # Visual DB browser

# Data Pipeline
npx tsx apps/pipeline/src/index.ts ingest --source fars --stateCode CO
npx tsx apps/pipeline/src/scripts/seed-providers.ts
npx tsx apps/pipeline/src/scripts/seed-geo.ts
npx tsx apps/pipeline/src/scripts/ingest-attorneys.ts

# Build
pnpm build                         # Build all packages
cd apps/web && pnpm build          # Build web
cd apps/api && pnpm build          # Build API

# Type Check
npx tsc --noEmit                   # Check types (from any package)

# Mobile
cd apps/mobile
eas build --platform ios --profile preview    # TestFlight build
eas build --platform android --profile preview # Internal testing
```

---

## Cost Estimate (Monthly)

| Service | Free Tier | Expected Cost |
|---------|-----------|---------------|
| Railway (API + DB + Redis) | $5 credit | $10-20/mo |
| Vercel (Web) | Free hobby | $0 |
| Clerk (Auth) | 10K MAU free | $0 (early stage) |
| OpenRouter (AI) | Pay per use | $5-30/mo |
| Qdrant Cloud | 1GB free | $0 |
| S3 (File Storage) | 5GB free | $0-5/mo |
| **Total** | | **$15-55/mo** |

At scale (10K+ users): ~$200-500/mo

---

*Generated by Velora Build System — March 2026*
