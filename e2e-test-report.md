# Velora Platform — E2E Test Report

**Date:** 2026-03-19
**Tested by:** Claude Code E2E Testing
**Platform:** Next.js 15 web app (localhost:3000) + Prisma/PostgreSQL
**Focus:** Full platform + new Case Memory System

---

## Summary

| Metric | Value |
|--------|-------|
| **Journeys Tested** | 8 |
| **Screenshots Captured** | 12 |
| **Issues Found (Browser)** | 12 |
| **Issues Found (Code Analysis)** | 20 |
| **Total Issues** | 32 |
| **Critical** | 7 |
| **High** | 8 |
| **Medium** | 12 |
| **Low/UX** | 5 |

---

## Journey Results

### Journey 1: Homepage & Hero Search
**Status:** PASS

- Hero text renders: "Know what the insurance company knows. Before they call."
- Search input with disabled Search button (enables on input)
- Stats bar shows live DB data: 405,538 crashes, 5 states, 63,941 attorneys
- Recent crashes with clickable cards, "How It Works" section, "Start Searching" CTA
- No JS errors

### Journey 2: AI Search Interface
**Status:** PARTIAL (API dependency)

- Search page loads at `/search`, user message as blue bubble
- "Thinking..." loading state works, button re-enables on timeout
- **Issue: Silent failure** — no error message when API unavailable

### Journey 3: Crash Detail Page
**Status:** PASS (with notes)

- Header, date, severity badge, location, map with pin all render correctly
- Narrative fallback shown when no AI content generated
- Quick Facts sidebar, CopilotKit chat bubble present
- **Issues:** CopilotKit banner distracting, raw enum values in UI

### Journey 4: Attorney Directory & Profiles
**Status:** PARTIAL (directory PASS, profile FAIL)

- Directory: 63,941 attorneys, search/filter/sort all functional
- **CRITICAL:** Profile page crashes — React error rendering review intelligence objects

### Journey 5: Case Dashboard (New)
**Status:** FAIL (API dependency)

- Server component fetches from Express API, shows "fetch failed" with no error boundary

### Journey 6: Programmatic SEO
**Status:** FAIL — `/colorado` returns 404

### Journey 7: Admin Dashboard
**Status:** PARTIAL — infinite "Loading metrics..." state

### Journey 8: Responsive
**Status:** PASS — mobile, tablet, desktop all render correctly

---

## All Issues (Prioritized)

### Critical (7)

1. **Attorney profile page crash** — Review intelligence objects rendered as React children
   - `app/attorneys/[slug]/page.tsx:80`
2. **Confirmation side effects never executed** — `respondToConfirmation()` not called from route handler
   - `apps/api/src/routes/case.ts:251-276`
3. **Timeline upsert race condition** — Uses `id: 'nonexistent'` fallback causing duplicates
   - `apps/api/src/services/case/timeline-builder.ts:95-98`
4. **No auth on case routes** — Any user can access/modify any matter
   - `apps/api/src/routes/case.ts` (all routes)
5. **Case dashboard crashes without API** — No error boundary
   - `apps/web/app/case/[matterId]/page.tsx:106-110`
6. **Chat endpoint mismatch** — Mobile expects GET for history but route is POST-only streaming
   - `apps/mobile/app/(tabs)/chat.tsx:38-40`
7. **Provider route path collision** — `/api/case/providers/nearby` conflicts with `/:id` param route
   - `apps/api/src/routes/case.ts`

### High (8)

8. **Duplicate episode-entity connections** — Both array and relation tracked
   - `apps/api/src/services/case/entity-extractor.ts:49-61`
9. **No error recovery in batch extraction** — Silent failures
   - `apps/api/src/services/case/entity-extractor.ts:152-173`
10. **Checkin trigger early return** — Treatment gap check skipped when statute warning fires
    - `apps/api/src/services/case/shepherd-checkin.ts:112-123`
11. **RecordButton crashes on non-JSON response** — No `response.ok` check
    - `apps/mobile/components/RecordButton.tsx:87-95`
12. **Missing mobile API endpoints** — `GET /api/matters/me` doesn't exist
13. **No lead generation CTAs** — No way to contact attorneys through platform
14. **No user authentication** — Blocks all personalization and monetization
15. **SEO pages 404** — Primary organic traffic channel broken

### Medium (12)

16. Excessive `as any` casts hiding type errors (multiple files)
17. Confidence math doesn't increase reliably (`fact-manager.ts:80`)
18. Missing null handling for statute deadline (`matter.ts:146-151`)
19. Silent search failure (no error shown)
20. Admin dashboard infinite loading
21. Raw enum values in UI (`personal_injury`, `NOT_COLLISION_WITH_MV`)
22. No Attorney Index score on directory cards
23. Confirmation expiry never enforced
24. No Suspense boundaries on case dashboard
25. Missing mobile chat history GET endpoint
26. No error states for API failures across the app
27. Attorney directory shows "0 reviews" for all entries

### Low / UX (5)

28. CopilotKit version banner visible to users
29. RecordButton no error feedback (silent failure)
30. "No Active Case" empty state needs action button
31. Crashes with 0 vehicles/persons (data quality)
32. Gap detection variable naming confusing (logic correct)

---

## Commercial Viability Recommendations

### Tier 1: Revenue Blockers (Fix Now)

**1. Fix Attorney Profiles** — This is the monetization page. Lawyers evaluating the platform see a crash. Fix the React rendering bug.

**2. Add Lead Generation** — No way exists for victims to contact attorneys through Velora. This is the #1 monetization path for legal directories ($50-200/lead in PI). Add "Request Free Consultation" CTAs.

**3. Add Authentication** — No auth = no retention, no personalization, no data ownership. Phone OTP for victims (low friction), email+password for attorneys.

### Tier 2: Growth Accelerators

**4. Gate the Equalizer** — Settlement ranges, liability analysis, and attorney matches are high-value. Require email to view, phone to download PDF. Creates natural lead funnel.

**5. Fix SEO Pages** — 405K crashes across 5 states could generate 500K+ indexable pages. Currently 404ing. This is the Zillow playbook for organic traffic.

**6. Attorney Claim Flow** — 63K attorneys indexed, none can manage their profile. Add "Claim this profile" → verify → free tier → paid upgrade. This is the Yelp/Avvo model.

**7. Case Memory as Standalone** — The passive evidence logging + temporal knowledge graph + proactive check-ins is genuinely novel. Two paths:
   - White-label for PI firms (SaaS revenue)
   - Direct-to-consumer app with attorney referral monetization

### Tier 3: Competitive Moat

**8. MCP Server Distribution** — 19 tools for crash/attorney/case data. Publish as AI plugin for Claude, ChatGPT, etc. Positions Velora as the crash data API for AI agents.

**9. Show Attorney Index on Cards** — The composite ranking score is your differentiation vs Avvo/Martindale. Make it visible everywhere.

**10. Trust Signals** — PI is high-trust. Add testimonials, attorney endorsements, legal disclaimers, and "As seen in" press mentions.

---

## Screenshots

All in `e2e-screenshots/`:

| File | Page | Viewport | Status |
|------|------|----------|--------|
| `00-homepage-initial.png` | Homepage | Desktop | PASS |
| `01-search-results.png` | Search (thinking) | Desktop | PASS |
| `01b-search-after-wait.png` | Search (timeout) | Desktop | Issue |
| `02-crash-detail.png` | Crash detail | Desktop | PASS |
| `03-attorney-directory.png` | Attorney listing | Desktop | PASS |
| `04-attorney-profile.png` | Attorney profile | Desktop | FAIL |
| `05-case-dashboard.png` | Case dashboard | Desktop | FAIL |
| `06-seo-colorado.png` | SEO /colorado | Desktop | FAIL |
| `07-admin-learning.png` | Admin dashboard | Desktop | Issue |
| `08-mobile-homepage.png` | Homepage | Mobile | PASS |
| `08b-mobile-attorneys.png` | Attorney listing | Mobile | PASS |
| `08c-tablet-homepage.png` | Homepage | Tablet | PASS |
