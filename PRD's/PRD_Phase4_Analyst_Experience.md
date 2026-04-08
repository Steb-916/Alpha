# PRD: Phase 4 — Analyst Experience Polish

**Version:** 1.0
**Date:** April 7, 2026
**Status:** Ready for Implementation (after Phase 3 complete)
**Priority:** High — analyst retention depends on the tools feeling professional
**Depends On:** Phase 3 (notifications wired into signal publication)

---

## 1. Context

### Why This Phase Matters

Analysts are the supply side of the marketplace. If the signal creation workflow feels clunky, the performance dashboard is too basic, and the charting tools are limited, good analysts won't stay — and without good analysts, subscribers have nothing to pay for. This phase upgrades the analyst-facing tools from "functional demo" to "professional trading platform."

### What Already Exists

**Signal System:**

| Feature | Status |
|---------|--------|
| Create signal: asset, direction, entry/target/stop, timeframe, conviction | ✅ Works |
| Immutable publish timestamps | ✅ Works |
| Price validation (longs: target > entry > stop) | ✅ Works |
| Manual resolution with actual closing price and result P&L % | ✅ Works |
| Signal notifications (in-app, email, Telegram) | ✅ After Phase 3 |

| Missing | Impact |
|---------|--------|
| Only single target per signal | Limits realistic trade plans (most traders use TP1/TP2/TP3) |
| No draft mode — publish is immediate | Analysts can't prepare signals in advance |
| Text-only creation — no chart interaction | Clunky UX for setting prices |
| No signal templates | Repetitive setup for recurring patterns |
| No chart screenshot attachment | Signals lack visual context |

**Performance Analytics (AnalystPerformance model):**

| Feature | Status |
|---------|--------|
| Win rate, total signals, win count | ✅ Auto-calculated |
| Average P&L, profit factor | ✅ Auto-calculated |
| Best/worst streaks | ✅ Auto-calculated |
| Total P&L, 90-day rolling P&L | ✅ Auto-calculated |
| Monthly returns chart, cumulative P&L curve | ✅ Rendered |

| Missing | Impact |
|---------|--------|
| No trade journal (filterable signal history) | Analysts can't review their own history effectively |
| No drawdown tracking | Critical risk metric missing |
| No breakdown by asset/timeframe/direction | Can't identify strengths and weaknesses |
| No rolling windows (7d/30d/90d) with comparison | Can't show improvement trends |
| No exportable report | Can't share track record externally |

**Annotation System:**

| Feature | Status |
|---------|--------|
| Horizontal trend lines with labels | ✅ Works |
| Support/resistance zones (colored areas) | ✅ Works |
| Text notes at specific price levels | ✅ Works |
| Per-asset, per-timeframe storage | ✅ Works |
| Active/draft status | ✅ Works |

| Missing | Impact |
|---------|--------|
| Angled trend lines, Fibonacci, channels | Limited drawing toolkit |
| Stored in Zustand/localStorage only | Annotations lost on device switch or clear |
| No sharing — subscribers can't see analyst drawings | Core value prop broken |
| No version history | No audit trail of what was drawn when |

---

## 2. Goals

After this phase is complete:

1. Analysts can create signals with multiple take-profit targets and partial close percentages
2. Analysts can set entry/target/stop by clicking directly on the chart
3. Analysts can save and reuse signal templates for recurring setups
4. Analysts can draft signals and publish when ready
5. Analysts can attach a chart screenshot to signals for visual context
6. The performance dashboard shows detailed breakdowns by asset, timeframe, direction, and rolling windows
7. Analysts have a trade journal with full signal history, filters, and notes
8. Drawdown tracking and max drawdown are calculated and displayed
9. Performance reports are exportable as CSV
10. Annotations persist in the database (not localStorage)
11. Subscribers see analyst annotations on their charts in real time
12. Angled trend lines, Fibonacci retracements, and channels are available as drawing tools

---

## 3. Sub-Phase 4A — Signal Creation UX Overhaul

### Objective

Transform signal creation from a basic form into a professional trading tool with multi-target support, chart interaction, templates, drafts, and visual attachments.

### 3.1 Multi-Target Support

**Schema change — new model:**

```prisma
model SignalTarget {
  id          String   @id @default(cuid())
  signalId    String
  signal      Signal   @relation(fields: [signalId], references: [id], onDelete: Cascade)
  label       String   // "TP1", "TP2", "TP3"
  price       Float
  closePercent Float   // Percentage of position to close at this target (e.g., 33.3)
  hitAt       DateTime? // When this target was reached (null = not yet hit)
  order       Int      // Display order (1, 2, 3)

  @@index([signalId])
}
```

**Changes to Signal model:**

```prisma
model Signal {
  // ... existing fields ...
  targetPrice    Float?          // Keep for backward compat; single-target signals still use this
  targets        SignalTarget[]  // New: multi-target array
  status         String  @default("active")  // "draft" | "active" | "resolved"
  templateId     String?         // If created from a template
  screenshotUrl  String?         // S3/R2 URL of attached chart screenshot
  notes          String?         // Already exists — analyst notes
}
```

**Validation rules for multi-target signals:**
- All target prices must be on the same side of entry as direction implies (long: all targets > entry; short: all targets < entry)
- `closePercent` values across all targets must sum to exactly 100
- At least 1 target required, maximum 5
- Targets must be ordered by distance from entry (TP1 closest, TP3 farthest)
- Stop loss remains a single value

**API changes:**

Modify `POST /api/signals`:
```typescript
// Request body now accepts either format:
interface CreateSignalBody {
  asset: string;
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  timeframe: string;
  conviction: 'low' | 'medium' | 'high';
  notes?: string;
  status?: 'draft' | 'active';      // NEW: default 'active'
  screenshotUrl?: string;            // NEW
  templateId?: string;               // NEW

  // Single target (backward compatible)
  targetPrice?: number;

  // Multi-target (new)
  targets?: Array<{
    label: string;
    price: number;
    closePercent: number;
  }>;
}
```

If `targets[]` is provided, use multi-target mode. If only `targetPrice` is provided, create a single `SignalTarget` with `closePercent: 100`. This keeps the API backward compatible.

**Resolution changes:**

Modify signal resolution to support partial target hits:

`POST /api/signals/[id]/resolve`:
```typescript
interface ResolveSignalBody {
  // Single-target resolution (existing)
  actualClosePrice?: number;

  // Multi-target resolution (new)
  targetHits?: Array<{
    targetId: string;
    hitAt: string;        // ISO timestamp
    actualPrice: number;  // Actual fill price at this target
  }>;

  // Common
  finalClosePrice: number;  // Price at which remaining position was closed
  notes?: string;
}
```

P&L calculation for multi-target:
```
totalPnl = Σ (target.closePercent / 100) × ((target.actualPrice - entry) / entry × 100)
         + remainingPercent × ((finalClosePrice - entry) / entry × 100)
```
Where `remainingPercent` = 100 - sum of hit target closePercents. For short signals, invert the direction.

### 3.2 Chart-Based Signal Creation

Add an interactive mode to the chart component where analysts can click to set prices:

**UX flow:**
1. Analyst clicks "New Signal" button on the chart toolbar
2. Chart enters "signal creation mode" — cursor changes to crosshair
3. Analyst clicks a price level → sets entry price (horizontal line appears, labeled "Entry")
4. Clicks again → sets stop loss (red line, labeled "Stop")
5. Clicks again → sets first target (green line, labeled "TP1")
6. Optional: clicks again for TP2, TP3 (additional green lines)
7. A floating panel shows the signal form pre-filled with the clicked prices
8. Analyst fills in remaining fields (conviction, timeframe, notes) and clicks "Publish" or "Save Draft"
9. Lines disappear or convert to permanent annotations after publish

**Implementation:**

Create: `components/charts/SignalCreationOverlay.tsx`

This component:
- Registers a click handler on the Lightweight Charts instance via `chart.subscribeClick()`
- Tracks the creation state machine: `idle → setting_entry → setting_stop → setting_targets → confirming`
- Renders horizontal price lines using Lightweight Charts' `createPriceLine()` API on the candlestick series
- Shows a floating form panel anchored to the chart area
- On publish/draft, calls the signal creation API and removes the overlay lines

**Zustand slice:** Add `signalCreationStore` with state machine, pending prices, and creation mode toggle.

**Escape hatch:** Press `Esc` or click "Cancel" at any point to exit creation mode and clear all pending lines.

### 3.3 Signal Templates

**Schema:**

```prisma
model SignalTemplate {
  id          String   @id @default(cuid())
  analystId   String
  analyst     User     @relation(fields: [analystId], references: [id])
  name        String                // "BTC Breakout Setup", "ETH Scalp"
  asset       String?               // Pre-filled asset (optional)
  direction   String?               // Pre-filled direction (optional)
  timeframe   String?               // Pre-filled timeframe (optional)
  conviction  String?               // Pre-filled conviction (optional)
  stopPercent Float?                // Stop as % below entry (e.g., 2.0 = 2% below)
  targets     Json?                 // Array of { label, percentFromEntry, closePercent }
  notes       String?               // Default notes text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([analystId])
}
```

Templates store **relative** values (percentages from entry) rather than absolute prices so they work across different price levels.

**API routes:**

`POST /api/signal-templates` — create template (analyst only)
`GET /api/signal-templates` — list analyst's templates
`PUT /api/signal-templates/[id]` — update template
`DELETE /api/signal-templates/[id]` — delete template
`POST /api/signal-templates/[id]/apply` — given an entry price, returns a pre-filled signal body with absolute prices calculated from the template's relative values

**UX:** When creating a signal, analyst sees a "Load Template" dropdown above the form. Selecting a template pre-fills all fields. Analyst can also "Save as Template" from any completed signal form.

### 3.4 Draft Signals

The `status` field on Signal already supports `'draft'` (added in 3.1).

**Behavior:**
- Draft signals are only visible to the creating analyst
- Drafts do NOT trigger notifications
- Drafts do NOT receive an immutable publish timestamp until published
- `publishedAt` is set to `null` for drafts and set to `new Date()` when status changes to `active`
- Drafts CAN be edited (unlike published signals which are immutable)

**API:**

`PUT /api/signals/[id]` — update a draft signal (analyst only, draft status only)
- Returns 403 if the signal is already `active` or `resolved` (immutability preserved)

`POST /api/signals/[id]/publish` — change status from `draft` to `active`
- Sets `publishedAt = new Date()`
- Triggers notification dispatch (same as direct publish)
- Immutability begins from this point

**UX:**
- Signal creation form has two buttons: "Publish Now" and "Save Draft"
- Analyst dashboard shows a "Drafts" tab with pending signals
- Each draft has "Edit", "Publish", and "Delete" actions

### 3.5 Chart Screenshot Attachment

Allow analysts to attach a chart screenshot to provide visual context with their signal.

**Two capture approaches:**

**Option A — Client-side canvas capture (recommended):**
Use `chart.takeScreenshot()` (built into Lightweight Charts) to capture the chart canvas as a PNG blob. This gives a clean screenshot of exactly what the analyst sees, including any annotation overlay lines.

**Option B — File upload:**
Standard file upload for analysts who want to attach screenshots from other tools (TradingView, external charts).

**Storage:**

Upload the image to Cloudflare R2 (or S3):

Create: `lib/storage.ts`
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
});

export async function uploadScreenshot(buffer: Buffer, signalId: string): Promise<string> {
  const key = `screenshots/${signalId}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
```

**API route:**

`POST /api/signals/[id]/screenshot` — upload screenshot for a signal (analyst only)
- Accepts `multipart/form-data` with image file
- Max file size: 2MB
- Accepted types: PNG, JPEG, WebP
- Returns `{ url: string }`
- Updates `signal.screenshotUrl`

**UX:**
- "Attach Chart" button on signal creation form
- Click → capture current chart canvas OR open file picker
- Preview thumbnail shown on the form before publish
- On the signal detail view, subscribers see the screenshot below the signal metadata

---

## 4. Sub-Phase 4B — Performance Dashboard Enhancements

### Objective

Transform the performance dashboard from basic aggregate metrics into a comprehensive analytics suite that helps analysts understand their trading patterns and present a professional track record.

### 4.1 Trade Journal

**Route:** `GET /api/analysts/[slug]/journal`

Auth: Public for the analyst's own journal (matches existing profile visibility). Subscribers see full details; non-subscribers see limited fields per Phase 2 gating.

Query params: `?asset=BTC&direction=long&timeframe=4h&from=2026-01-01&to=2026-03-31&result=win&sort=publishedAt&order=desc&limit=20&cursor={id}`

Response:
```typescript
interface JournalEntry {
  id: string;
  asset: string;
  direction: 'long' | 'short';
  entryPrice: number;
  targets: Array<{ label: string; price: number; closePercent: number; hit: boolean }>;
  stopLoss: number;
  timeframe: string;
  conviction: string;
  publishedAt: string;
  resolvedAt: string | null;
  resultPnl: number | null;          // null if unresolved
  result: 'win' | 'loss' | 'breakeven' | 'active';
  notes: string | null;
  screenshotUrl: string | null;
  holdingPeriod: string | null;       // "2d 4h" — calculated from publish to resolve
}

interface JournalResponse {
  entries: JournalEntry[];
  summary: {
    totalShown: number;
    wins: number;
    losses: number;
    avgPnl: number;
    totalPnl: number;
  };
  nextCursor: string | null;
}
```

**Frontend:** `app/analyst/[slug]/journal/page.tsx`

- Table view with sortable columns: asset, direction, entry, targets, P&L, date, result
- Filter bar: asset dropdown, direction toggle, timeframe dropdown, date range picker, result (win/loss/all)
- Each row expandable to show notes, screenshot, and target hit details
- Color-coded P&L: green for wins, red for losses
- Export button (see 4.5)

### 4.2 Drawdown Tracking

Add drawdown metrics to the `AnalystPerformance` model or compute them on the fly:

```prisma
model AnalystPerformance {
  // ... existing fields ...
  maxDrawdownPct    Float?    // Maximum peak-to-trough drawdown %
  currentDrawdownPct Float?   // Current drawdown from most recent equity peak
  maxDrawdownDate   DateTime? // When max drawdown occurred
}
```

**Calculation logic:**

Create: `lib/analytics/drawdown.ts`

```typescript
interface DrawdownResult {
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  maxDrawdownStartDate: Date;
  maxDrawdownEndDate: Date;
  drawdownSeries: Array<{ date: string; drawdownPct: number }>;  // For charting
}

export function calculateDrawdown(resolvedSignals: Signal[]): DrawdownResult {
  // Sort by resolvedAt ascending
  // Build cumulative P&L curve
  // Track running peak
  // Drawdown at each point = (current - peak) / peak × 100
  // Max drawdown = minimum value in the drawdown series
}
```

**Display:** Add a drawdown chart (area chart, red fill, inverted) below the cumulative P&L curve on the performance page. Show max drawdown as a highlighted stat card.

### 4.3 Breakdown by Asset / Timeframe / Direction

**Route:** `GET /api/analysts/[slug]/performance/breakdown`

Query params: `?groupBy=asset` or `?groupBy=timeframe` or `?groupBy=direction`

Response:
```typescript
interface BreakdownRow {
  group: string;            // "BTC", "ETH" | "1H", "4H" | "long", "short"
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
}

type BreakdownResponse = BreakdownRow[];
```

**Implementation:** Query all resolved signals for the analyst, group in memory, compute metrics per group. Cache the result in Upstash with 5-minute TTL (keyed by `analytics:breakdown:{slug}:{groupBy}`).

**Frontend:** Add a tabbed section to the performance page with three tabs: "By Asset", "By Timeframe", "By Direction". Each tab shows a table of breakdown rows + a bar chart visualization.

### 4.4 Rolling Performance Windows

**Route:** `GET /api/analysts/[slug]/performance/rolling`

Response:
```typescript
interface RollingPerformance {
  windows: {
    '7d':  WindowMetrics;
    '30d': WindowMetrics;
    '90d': WindowMetrics;
    'all': WindowMetrics;
  };
  comparison: {
    // Change from previous period
    '7d_vs_prev':  { winRateDelta: number; pnlDelta: number };
    '30d_vs_prev': { winRateDelta: number; pnlDelta: number };
    '90d_vs_prev': { winRateDelta: number; pnlDelta: number };
  };
}

interface WindowMetrics {
  totalSignals: number;
  wins: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeApprox: number;  // mean(pnl) / stddev(pnl) — simplified
}
```

**Implementation:** Query resolved signals within each window's date range, compute metrics. For comparison, compute the same metrics for the preceding period of equal length (e.g., 30d_vs_prev compares last 30 days against the 30 days before that).

**Frontend:** Add a row of four window cards (7d / 30d / 90d / All) at the top of the performance page. Each shows key metrics with green/red delta arrows vs. previous period.

### 4.5 Exportable Performance Report

**Route:** `GET /api/analysts/[slug]/performance/export?format=csv`

Auth: Analyst only (their own data) or public with limited fields.

**CSV format:**
```
Date,Asset,Direction,Entry,Target(s),Stop,Timeframe,Conviction,Result P&L %,Holding Period,Notes
2026-03-15,BTC,LONG,64200,"65000(50%),66000(50%)",63500,4H,HIGH,+3.2%,1d 8h,"Breakout above resistance"
```

**Implementation:** Query all resolved signals, format as CSV, return with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="scope-alpha-performance-{slug}-{date}.csv"`.

**Future:** PDF export can be added later using the PDF skill or a headless browser snapshot of the performance page. CSV is sufficient for launch.

---

## 5. Sub-Phase 4C — Annotation System V2

### Objective

Migrate annotations from localStorage to the database, add professional drawing tools, and enable real-time sharing of annotations from analysts to subscribers.

### 5.1 Database Migration for Annotations

The existing `Annotation` model already stores annotations in the database:

```prisma
model Annotation {
  id          String   @id @default(cuid())
  analystId   String
  analyst     AnalystProfile @relation(fields: [analystId], references: [id])
  asset       String
  timeframe   String
  type        String           // "horizontal_line" | "zone" | "text_note"
  data        Json             // Type-specific data
  status      String  @default("active")  // "active" | "draft"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Problem:** The UI currently reads/writes annotations via Zustand with localStorage persistence instead of through the API. The API routes exist but may not be fully wired into the chart components.

**Fix:** Rewire the annotation UI to use the existing `GET/POST/PUT/DELETE /api/annotations` routes as the source of truth. Remove localStorage persistence for annotations. Zustand still holds the in-memory state for rendering speed, but syncs to the DB on every create/update/delete.

### 5.2 Expanded Drawing Tools

Extend the `type` field and `data` JSON schema to support new drawing types:

**Existing types:**
| Type | Data Shape |
|------|-----------|
| `horizontal_line` | `{ price: number, label: string, color: string }` |
| `zone` | `{ priceTop: number, priceBottom: number, label: string, color: string, opacity: number }` |
| `text_note` | `{ price: number, text: string, color: string }` |

**New types:**

| Type | Data Shape |
|------|-----------|
| `trend_line` | `{ startTime: number, startPrice: number, endTime: number, endPrice: number, color: string, label?: string, extend?: 'none' \| 'right' \| 'both' }` |
| `fibonacci` | `{ startTime: number, startPrice: number, endTime: number, endPrice: number, levels: number[], color: string }` |
| `channel` | `{ topLine: { startTime, startPrice, endTime, endPrice }, bottomLine: { startTime, startPrice, endTime, endPrice }, color: string, fillColor?: string, fillOpacity?: number }` |

**Rendering:**

Lightweight Charts doesn't have built-in drawing tools. Annotations need to be rendered as a custom overlay:

Create: `lib/charts/drawingRenderer.ts`

**Approach — HTML/SVG overlay on the chart container:**

1. Lightweight Charts exposes `chart.timeScale().coordinateToTime()` and `series.priceToCoordinate()` for mapping between data space and pixel space
2. Render an absolutely-positioned SVG layer on top of the chart canvas
3. For each annotation, convert data coordinates (time, price) to pixel coordinates and draw the appropriate SVG element (line, rect, path)
4. On chart scroll/zoom, recalculate positions (subscribe to `chart.timeScale().subscribeVisibleLogicalRangeChange()`)

**Implementation per type:**

- **Trend line:** SVG `<line>` from (startTime, startPrice) → (endTime, endPrice) pixel coords. If `extend: 'right'`, calculate the slope and extend to the right edge of the visible area.
- **Fibonacci:** Draw the trend line between start and end points. Calculate Fibonacci levels (default: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0) as horizontal lines between the two price extremes. Label each level with its ratio and price.
- **Channel:** Two parallel trend lines with optional fill between them. Render as two SVG `<line>` elements + a `<polygon>` fill.

**Drawing interaction:**

Create: `components/charts/DrawingToolbar.tsx`

Toolbar buttons for each drawing type. When active:
1. First click sets the start point (time, price)
2. Mouse move shows a preview (line following cursor)
3. Second click sets the end point and commits the annotation
4. For channels: third click sets the parallel offset

State machine managed by `annotationStore` in Zustand.

### 5.3 Annotation Sharing (Analyst → Subscriber)

This is the core value-add: subscribers see exactly what the analyst sees on their chart.

**How it works:**

1. Analyst draws annotations on their chart → saved to DB via `POST /api/annotations`
2. Subscriber viewing the same analyst's chart fetches annotations: `GET /api/annotations?analystId={id}&asset={asset}&timeframe={timeframe}`
3. Subscriber's chart renders the analyst's annotations as a read-only overlay (different visual treatment — e.g., slightly transparent, labeled "by {analyst}")
4. Subscriber's own annotations (if any) render on a separate layer above

**Access gating:** Annotation fetching respects subscription access (Phase 2). Non-subscribers get an empty array.

**Near-real-time sync:**

When an analyst creates or updates an annotation, subscribers viewing that chart should see it within a few seconds:

- **Simple approach (polling):** Subscriber's chart polls `GET /api/annotations` every 15 seconds when the chart tab is active. Cheap and sufficient for alpha.
- **Better approach (SSE piggyback):** When an annotation is saved, push an event through the existing SSE pipeline: `{ type: 'annotation_update', analystId, asset, timeframe }`. The subscriber's chart refetches annotations on receiving this event. This reuses Phase 1 infrastructure.

**Recommendation:** Start with polling. Add SSE push as a follow-up if subscribers report annotations feeling laggy.

**Visual differentiation:**

| Annotation Source | Rendering |
|------------------|-----------|
| Analyst's own annotations | Full opacity, editable, drag handles visible |
| Analyst annotations viewed by subscriber | 80% opacity, read-only, "by {analyst}" label, no drag handles |
| Subscriber's own annotations (future) | Full opacity, editable, different color theme |

### 5.4 Annotation Versioning

Track a history of annotation changes so there's an audit trail of what was drawn and when:

```prisma
model AnnotationVersion {
  id            String   @id @default(cuid())
  annotationId  String
  annotation    Annotation @relation(fields: [annotationId], references: [id], onDelete: Cascade)
  data          Json              // Snapshot of the annotation data at this version
  action        String            // "created" | "updated" | "deleted"
  createdAt     DateTime @default(now())

  @@index([annotationId, createdAt])
}
```

**Implementation:**
- On every `POST /api/annotations` → create version with action `"created"`
- On every `PUT /api/annotations/[id]` → create version with action `"updated"` (snapshot of previous state)
- On every `DELETE /api/annotations/[id]` → create version with action `"deleted"` (soft delete: set `status = 'deleted'`, keep record)

**API:**

`GET /api/annotations/[id]/history` — returns the version history for an annotation:
```typescript
interface AnnotationHistory {
  versions: Array<{
    id: string;
    data: Record<string, any>;
    action: string;
    createdAt: string;
  }>;
}
```

**UX:** On the analyst's annotation panel, each annotation has a "History" link that shows a timeline of changes. This is primarily for accountability — subscribers can verify that the analyst drew a support line before price reached it, not after.

---

## 6. New Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `@aws-sdk/client-s3` | Screenshot upload to R2/S3 | `npm install @aws-sdk/client-s3` |

No other new dependencies. Lightweight Charts is already installed. The drawing overlay uses vanilla SVG.

---

## 7. Environment Variables

```env
# Screenshot storage (Cloudflare R2 or S3-compatible)
R2_ENDPOINT=                    # https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY=                  # R2 API token access key
R2_SECRET_KEY=                  # R2 API token secret key
R2_BUCKET=                      # Bucket name
R2_PUBLIC_URL=                  # Public URL prefix for serving images
```

---

## 8. Prisma Schema Changes (Summary)

```prisma
// New models
model SignalTarget {
  id            String    @id @default(cuid())
  signalId      String
  signal        Signal    @relation(fields: [signalId], references: [id], onDelete: Cascade)
  label         String
  price         Float
  closePercent  Float
  hitAt         DateTime?
  order         Int
  @@index([signalId])
}

model SignalTemplate {
  id          String   @id @default(cuid())
  analystId   String
  analyst     User     @relation(fields: [analystId], references: [id])
  name        String
  asset       String?
  direction   String?
  timeframe   String?
  conviction  String?
  stopPercent Float?
  targets     Json?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([analystId])
}

model AnnotationVersion {
  id            String     @id @default(cuid())
  annotationId  String
  annotation    Annotation @relation(fields: [annotationId], references: [id], onDelete: Cascade)
  data          Json
  action        String
  createdAt     DateTime   @default(now())
  @@index([annotationId, createdAt])
}

// Changes to existing models
model Signal {
  // Add:
  targets        SignalTarget[]
  status         String   @default("active")   // "draft" | "active" | "resolved"
  templateId     String?
  screenshotUrl  String?
}

model AnalystPerformance {
  // Add:
  maxDrawdownPct     Float?
  currentDrawdownPct Float?
  maxDrawdownDate    DateTime?
}

model Annotation {
  // Add:
  versions       AnnotationVersion[]
}
```

---

## 9. File Structure

**New files:**

```
lib/
  storage.ts                                   # R2/S3 upload helper
  analytics/
    drawdown.ts                                # Drawdown calculation
    breakdown.ts                               # Group-by-asset/timeframe/direction metrics
    rolling.ts                                 # Rolling window metrics + comparison
    export.ts                                  # CSV export formatter
  charts/
    drawingRenderer.ts                         # SVG overlay rendering for annotations
    drawingInteraction.ts                      # Click-to-draw state machine
    signalCreationOverlay.ts                   # Chart-based signal price setting

app/api/
  signal-templates/
    route.ts                                   # GET (list), POST (create)
    [id]/route.ts                              # PUT (update), DELETE
    [id]/apply/route.ts                        # POST (apply template to entry price)
  signals/
    [id]/
      publish/route.ts                         # POST — draft → active
      screenshot/route.ts                      # POST — upload chart screenshot
      resolve/route.ts                         # POST — resolve with multi-target support
  analysts/
    [slug]/
      journal/route.ts                         # GET — trade journal with filters
      performance/
        breakdown/route.ts                     # GET — by asset/timeframe/direction
        rolling/route.ts                       # GET — 7d/30d/90d/all windows
        export/route.ts                        # GET — CSV download
  annotations/
    [id]/
      history/route.ts                         # GET — version history

app/
  analyst/[slug]/
    journal/page.tsx                           # Trade journal page

components/
  signals/
    SignalCreationForm.tsx                      # Upgraded form with multi-target, templates, drafts
    MultiTargetInput.tsx                        # Dynamic target rows (add/remove TP levels)
    TemplateSelector.tsx                        # Template dropdown + "Save as Template"
    DraftSignalList.tsx                         # Analyst's draft signals panel
    SignalScreenshot.tsx                        # Screenshot capture/upload + display
  charts/
    DrawingToolbar.tsx                          # Drawing tool selection buttons
    SignalCreationOverlay.tsx                   # Chart click-to-set-price overlay
    AnnotationLayer.tsx                         # SVG overlay for all annotation types
    FibonacciOverlay.tsx                        # Fibonacci-specific rendering
    TrendLineOverlay.tsx                        # Trend line rendering (angled)
    ChannelOverlay.tsx                          # Channel rendering
  analytics/
    DrawdownChart.tsx                           # Drawdown area chart
    BreakdownTable.tsx                          # Grouped performance breakdown
    BreakdownChart.tsx                          # Bar chart for breakdown visualization
    RollingWindowCards.tsx                      # 7d/30d/90d/all stat cards with deltas
    TradeJournal.tsx                            # Filterable signal history table

stores/
  signalCreationStore.ts                       # Signal creation mode state machine
  annotationStore.ts                           # Updated: DB-synced, drawing tool state
```

**Existing files to modify:**

```
prisma/schema.prisma                           # Add SignalTarget, SignalTemplate, AnnotationVersion + field additions
app/api/signals/route.ts                       # Support multi-target, draft status, templateId, screenshotUrl
app/api/annotations/route.ts                   # Add version creation on write operations
components/charts/PriceChart.tsx                # Add drawing overlay layer, signal creation overlay
app/analyst/[slug]/page.tsx                     # Add journal tab, enhanced performance sections
hooks/useLiveTerminalData.ts                   # No changes needed — analytics are separate routes
```

**Files to leave alone:**

```
# All Phase 1–3 infrastructure
# Auth system
# Stripe/subscription system
# Notification system (except: signal creation dispatch now includes screenshot URL in metadata)
# Market data, screener, health score
```

---

## 10. Testing & Validation

### Manual Verification Checklist

**Multi-Target Signals:**
- [ ] Create a signal with 3 targets (33/33/34 split) → all targets saved correctly
- [ ] Validation rejects targets on wrong side of entry (long target below entry)
- [ ] Validation rejects closePercent not summing to 100
- [ ] Single-target creation still works (backward compat)
- [ ] Resolve with partial target hits → P&L calculated correctly
- [ ] Existing single-target signals display correctly (no regression)

**Chart-Based Creation:**
- [ ] Click "New Signal" → chart enters crosshair mode
- [ ] Click sets entry price → horizontal line appears at clicked price
- [ ] Second click sets stop → red line appears
- [ ] Third click sets TP1 → green line appears
- [ ] Form panel shows correct pre-filled prices
- [ ] Esc cancels and clears all lines
- [ ] Publish creates signal with correct prices

**Templates:**
- [ ] Create template from a signal → saves with relative percentages
- [ ] Load template → form pre-fills with correct values
- [ ] Apply template with different entry price → targets/stop scale correctly
- [ ] Delete template works

**Drafts:**
- [ ] Save as draft → signal visible only to analyst
- [ ] Edit draft → changes saved
- [ ] Publish draft → timestamp set, notifications fire, signal becomes immutable
- [ ] Attempt to edit published signal → 403

**Screenshots:**
- [ ] Capture chart screenshot → uploads to R2 → URL saved on signal
- [ ] Screenshot visible on signal detail page for subscribers
- [ ] File upload alternative works (PNG, JPEG, WebP)
- [ ] Files over 2MB rejected

**Performance Dashboard:**
- [ ] Trade journal shows all resolved signals with correct filters
- [ ] Drawdown chart renders correctly with accurate max drawdown
- [ ] Breakdown by asset shows correct per-asset metrics
- [ ] Rolling windows show correct metrics with comparison deltas
- [ ] CSV export downloads with correct data

**Annotations V2:**
- [ ] Trend line: click-drag creates angled line on chart
- [ ] Fibonacci: click-drag shows Fibonacci levels
- [ ] Channel: three clicks create parallel channel
- [ ] All drawings persist in DB (refresh page → drawings still visible)
- [ ] Subscriber views analyst's chart → sees analyst's annotations (read-only)
- [ ] Non-subscriber views analyst's chart → no annotations visible
- [ ] Annotation version history shows creation and edit timestamps

---

## 11. Rollout Plan

1. **Prisma migration** — add SignalTarget, SignalTemplate, AnnotationVersion + field additions
2. **Multi-target signal support** (3.1) — schema, API, validation, P&L calculation
3. **Draft signals** (3.4) — status field, edit/publish routes, UI
4. **Signal templates** (3.3) — model, CRUD routes, template selector UI
5. **Screenshot upload** (3.5) — R2 setup, upload route, capture integration
6. **Chart-based signal creation** (3.2) — overlay component, click interaction, form integration
7. **Annotation DB migration** (5.1) — rewire UI from localStorage to API
8. **New drawing tools** (5.2) — trend lines, Fibonacci, channels + SVG renderer
9. **Annotation sharing** (5.3) — subscriber fetching, read-only overlay, polling
10. **Annotation versioning** (5.4) — version model, history API, UI
11. **Trade journal** (4.1) — API route, filterable table page
12. **Drawdown tracking** (4.2) — calculation, chart component, performance model update
13. **Breakdowns** (4.3) — API route, tabbed table + bar chart
14. **Rolling windows** (4.4) — API route, stat cards with deltas
15. **CSV export** (4.5) — export route, download button
16. **End-to-end test** — create multi-target signal from chart, verify notifications, check journal
17. **Deploy to staging** — verify R2 uploads, annotation sync, performance calculations

---

## 12. Out of Scope

The following are explicitly NOT part of this phase:

- Pine Script equivalent / custom indicators (Phase roadmap item — significant standalone effort)
- Backtesting engine (Phase roadmap item)
- Copy trading / auto-execution (Phase roadmap item)
- Subscriber-created annotations (subscribers can view analyst annotations but not create their own yet)
- Advanced chart patterns (head & shoulders, wedge detection, etc.)
- AI-assisted signal suggestions
- Mobile-specific drawing interactions (touch gestures)
- Real-time collaborative drawing (Google Docs-style cursors)
- PDF performance report export (CSV only for now)
- Any changes to market data, payments, or notification infrastructure
