# PRD: Phase 2 — Payments & Subscriptions

**Version:** 1.0
**Date:** April 7, 2026
**Status:** Ready for Implementation (after Phase 1 complete)
**Priority:** Critical Path — blocks monetization and public launch
**Depends On:** Phase 1 (live data layer) complete

---

## 1. Context

### What Is Scope Alpha

Scope Alpha is a crypto derivatives analytics and trading strategy marketplace. Analysts publish timestamped trading signals and chart annotations. Subscribers pay for access to analyst content through tiered subscriptions ($50–$2,000/mo). The platform takes a commission on each subscription.

### What Already Exists

The demo build has a complete subscription system with mock data:

**Prisma Models (production-ready schema, already migrated):**

| Model | What It Does | Stripe-Ready Fields |
|-------|-------------|-------------------|
| `SubscriptionTier` | Per-analyst pricing tiers (1–3 tiers, $50–$2,000/mo) with feature lists | `stripePriceId` (empty) |
| `Subscription` | Links subscriber to analyst via tier, tracks period dates | `stripeSubscriptionId`, `stripeCustomerId` (empty) |
| `User` | Core account with role (subscriber/analyst) | `stripeCustomerId`, `stripeConnectId` (need to add) |
| `AnalystProfile` | Extended analyst profile with `acceptingSubscriptions` flag | — |

**Existing API Routes:**

| Route | What It Does | Status |
|-------|-------------|--------|
| `POST /api/subscriptions` | Creates a subscription record | Works but skips payment — just writes to DB |
| `GET /api/subscriptions` | Lists subscriptions for current user | Works |
| `DELETE /api/subscriptions/[id]` | Cancels a subscription | Works but instant — no end-of-period logic |
| `POST /api/subscription-tiers` | Analyst creates pricing tiers | Works |
| `GET /api/subscription-tiers` | Fetches tiers for an analyst | Works |

**Existing Frontend:**

| Component/Page | Status |
|----------------|--------|
| Analyst profile → tier cards with "Subscribe" button | Renders, button creates mock subscription |
| Marketplace browse → analyst cards with price display | Works |
| Subscriber can view signals/annotations after subscribing | Works but no payment gate — subscription is free |

**What Does NOT Exist:**

- No Stripe integration (Connect, Checkout, Webhooks, Billing Portal)
- No real payment processing
- No platform commission handling
- No upgrade/downgrade between tiers
- No grace period for failed payments
- No access gating middleware — all analyst content is effectively free
- No subscriber billing dashboard
- No analyst revenue/payout dashboard
- No Stripe fields on User model (`stripeCustomerId`, `stripeConnectId`)

---

## 2. Goals

After this phase is complete:

1. Analysts can onboard via Stripe Connect and receive real payouts
2. Subscribers can pay for subscriptions via Stripe Checkout
3. The platform collects a configurable commission (15–25%) on every subscription
4. Subscriptions renew monthly via Stripe's recurring billing
5. Failed payments trigger a grace period → suspension → cancellation flow
6. Subscribers can upgrade/downgrade tiers with proration
7. Analyst content (full signals, annotations, chat) is gated behind active subscriptions
8. Free preview shows limited signal info (asset + direction) to drive conversions
9. Both subscriber and analyst dashboards show billing/revenue data

---

## 3. Stripe Architecture

### Stripe Connect (Platform Model)

Scope Alpha uses **Stripe Connect** in **Standard** account mode. This means:

- The platform has a **Stripe Platform account** (Scope Alpha's main Stripe account)
- Each analyst creates a **Connected Account** via Stripe's hosted onboarding flow
- When a subscriber pays, the money flows: subscriber → platform → analyst (minus commission)
- The platform commission is handled via **application fees** on each payment

**Why Standard (not Express or Custom):**
- Standard accounts give analysts their own full Stripe dashboard for payout management
- Least compliance burden on the platform — Stripe handles KYC/identity for the analyst
- Analysts can manage their own bank accounts, tax info, and payout schedule directly with Stripe

### Payment Flow

```
Subscriber clicks "Subscribe" on Tier card
        │
        ▼
POST /api/subscriptions/checkout
        │
        ├─ Creates/retrieves Stripe Customer for subscriber
        ├─ Creates Stripe Checkout Session with:
        │    - price: tier's stripePriceId (recurring/monthly)
        │    - application_fee_percent: platform commission
        │    - transfer_data.destination: analyst's stripeConnectId
        │    - subscription_data.metadata: { analystId, tierId, subscriberId }
        │
        ▼
Redirect to Stripe Checkout (hosted page)
        │
        ▼
Subscriber enters payment → Stripe processes
        │
        ▼
Stripe sends webhook: checkout.session.completed
        │
        ├─ Create/activate Subscription record in DB
        ├─ Set stripeSubscriptionId, stripeCustomerId
        ├─ Set currentPeriodStart, currentPeriodEnd
        │
        ▼
Subscriber redirected to success page → content unlocked
```

### Recurring Billing Flow

```
Stripe auto-charges at period end
        │
        ├─ invoice.paid → extend currentPeriodEnd, status stays 'active'
        │
        ├─ invoice.payment_failed → set status 'past_due', start grace period
        │     │
        │     ├─ Stripe retries (up to 3 attempts over ~2 weeks)
        │     │
        │     ├─ invoice.paid (retry succeeds) → status back to 'active'
        │     │
        │     └─ customer.subscription.deleted (all retries fail) → status 'canceled'
        │
        └─ customer.subscription.updated → handle upgrade/downgrade proration
```

---

## 4. Prisma Schema Changes

### New Fields on User

```prisma
model User {
  // ... existing fields ...
  stripeCustomerId  String?   @unique    // Stripe Customer ID (subscribers)
  stripeConnectId   String?   @unique    // Stripe Connected Account ID (analysts)
}
```

### New Fields on SubscriptionTier

```prisma
model SubscriptionTier {
  // ... existing fields ...
  stripePriceId     String?   @unique    // Stripe Price ID (recurring monthly)
  stripeProductId   String?              // Stripe Product ID
}
```

### Updated Subscription Model

```prisma
model Subscription {
  // ... existing fields ...
  stripeSubscriptionId  String?   @unique
  stripeCustomerId      String?
  status                String    @default("active")
  // "active" | "past_due" | "canceled" | "paused"
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean   @default(false)
  canceledAt            DateTime?
}
```

### Migration

Create a Prisma migration that adds these fields as nullable (no data loss, no breaking change). Existing mock subscriptions continue to work — they'll just have null Stripe fields.

---

## 5. Platform Configuration

Create: `config/stripe.ts`

```typescript
export const STRIPE_CONFIG = {
  // Platform commission percentage taken from each subscription payment
  APPLICATION_FEE_PERCENT: 20, // 20% — adjustable between 15-25%

  // Stripe Connect onboarding return URLs
  CONNECT_ONBOARDING_RETURN: '/settings/payments',
  CONNECT_ONBOARDING_REFRESH: '/settings/payments?refresh=true',

  // Checkout success/cancel URLs
  CHECKOUT_SUCCESS: '/subscriptions?session_id={CHECKOUT_SESSION_ID}',
  CHECKOUT_CANCEL: '/analyst/{slug}',

  // Billing portal return URL
  BILLING_PORTAL_RETURN: '/subscriptions',

  // Grace period: how long past_due subscriptions retain access
  GRACE_PERIOD_DAYS: 7,

  // Minimum/maximum tier pricing (cents)
  MIN_TIER_PRICE: 5000,   // $50.00
  MAX_TIER_PRICE: 200000, // $2,000.00
} as const;
```

---

## 6. Sub-Phase 2A — Stripe Integration (Core)

### Objective

Wire up Stripe Connect for analyst onboarding, Stripe Checkout for subscription payments, and webhook handlers for all billing events.

### Implementation Steps

#### 6.1 Stripe SDK Setup

Install: `npm install stripe`

Create: `lib/stripe.ts`

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia', // or latest stable
  typescript: true,
});
```

#### 6.2 Analyst Onboarding (Stripe Connect)

**Route:** `POST /api/stripe/connect/onboard`

Auth: Analyst only.

Flow:
1. Check if user already has `stripeConnectId` — if yes, create an account link to their dashboard instead
2. Create a Stripe Connected Account:
   ```typescript
   const account = await stripe.accounts.create({
     type: 'standard',
     email: user.email,
     metadata: { userId: user.id, slug: user.slug },
   });
   ```
3. Save `account.id` to `user.stripeConnectId`
4. Create an Account Link for hosted onboarding:
   ```typescript
   const link = await stripe.accountLinks.create({
     account: account.id,
     refresh_url: `${baseUrl}${STRIPE_CONFIG.CONNECT_ONBOARDING_REFRESH}`,
     return_url: `${baseUrl}${STRIPE_CONFIG.CONNECT_ONBOARDING_RETURN}`,
     type: 'account_onboarding',
   });
   ```
5. Return `{ url: link.url }` — frontend redirects analyst to Stripe's hosted onboarding

**Route:** `GET /api/stripe/connect/status`

Auth: Analyst only.

Returns the analyst's Connected Account status:
```typescript
interface ConnectStatus {
  isConnected: boolean;
  chargesEnabled: boolean;    // Can receive payments
  payoutsEnabled: boolean;    // Can receive payouts
  detailsSubmitted: boolean;  // Completed onboarding
  dashboardUrl: string | null; // Link to their Stripe dashboard
}
```

Fetch via `stripe.accounts.retrieve(stripeConnectId)` and map fields.

#### 6.3 Stripe Product/Price Sync for Tiers

When an analyst creates or updates a subscription tier, sync it to Stripe:

**Modify:** `POST /api/subscription-tiers`

After creating the tier in the DB:
1. Create a Stripe Product:
   ```typescript
   const product = await stripe.products.create({
     name: `${analyst.displayName} — ${tier.name}`,
     metadata: { tierId: tier.id, analystId: analyst.id },
   });
   ```
2. Create a Stripe Price (recurring monthly):
   ```typescript
   const price = await stripe.prices.create({
     product: product.id,
     unit_amount: tier.priceInCents, // e.g., 5000 = $50.00
     currency: 'usd',
     recurring: { interval: 'month' },
     metadata: { tierId: tier.id },
   });
   ```
3. Update the tier record with `stripeProductId` and `stripePriceId`

**Important:** If the analyst doesn't have a completed Stripe Connect account (`chargesEnabled !== true`), block tier creation and return an error telling them to complete onboarding first.

**Price changes:** Stripe prices are immutable. To change a tier's price:
1. Archive the old Stripe Price
2. Create a new Stripe Price on the same Product
3. Migrate existing subscribers to the new price at next renewal (or grandfather them)
4. Update `stripePriceId` on the tier

#### 6.4 Subscription Checkout

**Route:** `POST /api/subscriptions/checkout`

Auth: Subscriber only (not analyst subscribing to themselves).

Request body:
```typescript
{
  tierId: string;
  analystId: string;
}
```

Flow:
1. Verify subscriber doesn't already have an active subscription to this analyst
2. Fetch the tier and verify it has a `stripePriceId`
3. Fetch the analyst's `stripeConnectId` and verify `chargesEnabled`
4. Create or retrieve Stripe Customer for subscriber:
   ```typescript
   let customerId = user.stripeCustomerId;
   if (!customerId) {
     const customer = await stripe.customers.create({
       email: user.email,
       metadata: { userId: user.id },
     });
     customerId = customer.id;
     await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
   }
   ```
5. Create Stripe Checkout Session:
   ```typescript
   const session = await stripe.checkout.sessions.create({
     mode: 'subscription',
     customer: customerId,
     line_items: [{ price: tier.stripePriceId, quantity: 1 }],
     subscription_data: {
       application_fee_percent: STRIPE_CONFIG.APPLICATION_FEE_PERCENT,
       transfer_data: { destination: analyst.stripeConnectId },
       metadata: {
         analystId: analyst.id,
         tierId: tier.id,
         subscriberId: user.id,
       },
     },
     success_url: `${baseUrl}${STRIPE_CONFIG.CHECKOUT_SUCCESS}`,
     cancel_url: `${baseUrl}${STRIPE_CONFIG.CHECKOUT_CANCEL.replace('{slug}', analyst.slug)}`,
     metadata: {
       analystId: analyst.id,
       tierId: tier.id,
       subscriberId: user.id,
     },
   });
   ```
6. Return `{ url: session.url }` — frontend redirects subscriber to Stripe Checkout

#### 6.5 Webhook Handler

**Route:** `POST /api/stripe/webhooks`

This route must:
- Use `stripe.webhooks.constructEvent()` to verify the webhook signature
- NOT use the standard Next.js body parser (needs raw body for signature verification)
- Handle the following events:

**`checkout.session.completed`:**
1. Extract `analystId`, `tierId`, `subscriberId` from session metadata
2. Create (or reactivate) Subscription record in DB:
   ```typescript
   await prisma.subscription.upsert({
     where: { subscriberId_analystId: { subscriberId, analystId } },
     create: {
       subscriberId,
       analystId,
       tierId,
       status: 'active',
       stripeSubscriptionId: session.subscription,
       stripeCustomerId: session.customer,
       currentPeriodStart: new Date(subscription.current_period_start * 1000),
       currentPeriodEnd: new Date(subscription.current_period_end * 1000),
     },
     update: {
       tierId,
       status: 'active',
       stripeSubscriptionId: session.subscription,
       currentPeriodStart: new Date(subscription.current_period_start * 1000),
       currentPeriodEnd: new Date(subscription.current_period_end * 1000),
       cancelAtPeriodEnd: false,
       canceledAt: null,
     },
   });
   ```
3. Increment `AnalystPerformance.subscriberCount`

**`invoice.paid`:**
1. Look up Subscription by `stripeSubscriptionId`
2. Update `currentPeriodEnd` to the new period end
3. If status was `past_due`, set back to `active`

**`invoice.payment_failed`:**
1. Look up Subscription by `stripeSubscriptionId`
2. Set status to `past_due`
3. Log the failure for the analyst revenue dashboard

**`customer.subscription.updated`:**
1. Look up Subscription by `stripeSubscriptionId`
2. Update `currentPeriodStart`, `currentPeriodEnd`
3. If `cancel_at_period_end` changed, update `cancelAtPeriodEnd`
4. If the Price changed (upgrade/downgrade), update `tierId` to match the new Stripe Price

**`customer.subscription.deleted`:**
1. Look up Subscription by `stripeSubscriptionId`
2. Set status to `canceled`, set `canceledAt` to now
3. Decrement `AnalystPerformance.subscriberCount`

**Webhook security:**
```typescript
export async function POST(request: Request) {
  const body = await request.text(); // raw body, not parsed JSON
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ... handle event.type switch ...
}
```

**Route config — disable body parsing:**
```typescript
export const runtime = 'nodejs';
// Next.js App Router: raw body is available via request.text()
// No additional config needed in App Router
```

---

## 7. Sub-Phase 2B — Subscription Lifecycle Management

### Objective

Handle upgrades, downgrades, cancellations, and failed payment recovery. Give subscribers and analysts dashboards to manage their billing.

### Implementation Steps

#### 7.1 Cancellation Flow

**Route:** `POST /api/subscriptions/[id]/cancel`

Auth: Subscriber who owns the subscription.

This does NOT immediately cancel. It sets the subscription to cancel at period end:
```typescript
await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
  cancel_at_period_end: true,
});

await prisma.subscription.update({
  where: { id: subscriptionId },
  data: { cancelAtPeriodEnd: true },
});
```

The subscriber retains access until `currentPeriodEnd`. The `customer.subscription.deleted` webhook fires at period end and sets status to `canceled`.

**Resubscribe:** If a subscriber cancels but wants to undo before period end:
```typescript
await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
  cancel_at_period_end: false,
});
```

#### 7.2 Upgrade/Downgrade Between Tiers

**Route:** `POST /api/subscriptions/[id]/change-tier`

Auth: Subscriber who owns the subscription.

Request body: `{ newTierId: string }`

Flow:
1. Fetch the new tier's `stripePriceId`
2. Retrieve the Stripe subscription and find the current subscription item
3. Update the subscription item with the new price:
   ```typescript
   await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
     items: [{
       id: stripeSubscription.items.data[0].id,
       price: newTier.stripePriceId,
     }],
     proration_behavior: 'create_prorations', // charge/credit difference immediately
   });
   ```
4. Update Subscription record: `tierId = newTierId`
5. The `customer.subscription.updated` webhook confirms the change

**Proration:** Stripe handles this automatically with `create_prorations`. Upgrading mid-cycle charges the prorated difference. Downgrading credits the prorated amount to the next invoice.

#### 7.3 Grace Period for Failed Payments

Stripe's Smart Retries handle the retry logic automatically (up to 3 attempts over ~2 weeks). The platform layer:

1. On `invoice.payment_failed`: set subscription status to `past_due`
2. Access gating (Sub-Phase 2C) checks status:
   - `active` → full access
   - `past_due` within grace period (`GRACE_PERIOD_DAYS`) → full access + warning banner
   - `past_due` beyond grace period → access revoked, paywall shown
   - `canceled` → access revoked
3. On `invoice.paid` (retry succeeds): status back to `active`, warning banner removed
4. On `customer.subscription.deleted` (all retries exhausted): status to `canceled`

#### 7.4 Subscriber Billing Dashboard

**Route:** `GET /api/subscriptions/my`

Auth: Subscriber.

Returns all subscriptions for the current user with status, tier info, analyst info, and billing dates:
```typescript
interface MySubscription {
  id: string;
  analyst: {
    id: string;
    displayName: string;
    slug: string;
    avatar: string | null;
  };
  tier: {
    id: string;
    name: string;
    price: number;
    features: string[];
  };
  status: 'active' | 'past_due' | 'canceled';
  currentPeriodEnd: string;       // ISO date
  cancelAtPeriodEnd: boolean;
  availableTiers: Array<{         // Other tiers from this analyst for upgrade/downgrade
    id: string;
    name: string;
    price: number;
  }>;
}
```

**Stripe Billing Portal:**

**Route:** `POST /api/stripe/billing-portal`

Auth: Subscriber.

Creates a Stripe Billing Portal session so subscribers can manage payment methods, view invoices, and update billing info directly on Stripe's hosted page:
```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: `${baseUrl}${STRIPE_CONFIG.BILLING_PORTAL_RETURN}`,
});
return Response.json({ url: session.url });
```

#### 7.5 Analyst Revenue Dashboard

**Route:** `GET /api/analysts/revenue`

Auth: Analyst only.

Returns the analyst's revenue data:
```typescript
interface AnalystRevenue {
  totalSubscribers: number;
  activeSubscribers: number;
  monthlyRecurringRevenue: number;  // Sum of active subscription tier prices × (1 - commission)
  totalEarnings: number;            // Lifetime earnings after commission
  recentPayouts: Array<{
    amount: number;
    date: string;
    status: string;
  }>;
  subscribersByTier: Array<{
    tierName: string;
    tierPrice: number;
    subscriberCount: number;
  }>;
}
```

For `totalEarnings` and `recentPayouts`, query the Stripe API:
```typescript
const transfers = await stripe.transfers.list({
  destination: analyst.stripeConnectId,
  limit: 20,
});

const balance = await stripe.balance.retrieve({
  stripeAccount: analyst.stripeConnectId,
});
```

For `monthlyRecurringRevenue` and `subscribersByTier`, query the local DB (faster than Stripe):
```typescript
const subs = await prisma.subscription.findMany({
  where: { analystId: analyst.id, status: 'active' },
  include: { tier: true },
});
```

---

## 8. Sub-Phase 2C — Access Gating

### Objective

Gate analyst content behind active subscriptions. Show a compelling free preview to drive conversions. Handle edge cases (expired, past_due, canceled) gracefully.

### Implementation Steps

#### 8.1 Subscription Check Utility

Create: `lib/subscriptions.ts`

```typescript
import { STRIPE_CONFIG } from '@/config/stripe';

interface AccessCheck {
  hasAccess: boolean;
  status: 'active' | 'past_due' | 'grace_period' | 'expired' | 'none';
  subscription: Subscription | null;
  tier: SubscriptionTier | null;
}

export async function checkSubscriptionAccess(
  subscriberId: string,
  analystId: string
): Promise<AccessCheck> {
  const subscription = await prisma.subscription.findUnique({
    where: { subscriberId_analystId: { subscriberId, analystId } },
    include: { tier: true },
  });

  if (!subscription) {
    return { hasAccess: false, status: 'none', subscription: null, tier: null };
  }

  if (subscription.status === 'active') {
    return { hasAccess: true, status: 'active', subscription, tier: subscription.tier };
  }

  if (subscription.status === 'past_due') {
    const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + STRIPE_CONFIG.GRACE_PERIOD_DAYS);

    if (new Date() < gracePeriodEnd) {
      return { hasAccess: true, status: 'grace_period', subscription, tier: subscription.tier };
    }
    return { hasAccess: false, status: 'expired', subscription, tier: subscription.tier };
  }

  return { hasAccess: false, status: 'expired', subscription, tier: subscription.tier };
}
```

#### 8.2 API-Level Gating

Modify existing API routes that serve analyst content to check subscription access:

**Signals (`GET /api/signals`):**
- If fetching signals for a specific analyst, check access
- **Free preview:** Always return `{ asset, direction, publishedAt, analystId }` for all signals
- **Full signal (gated):** `{ ...freeFields, entryPrice, targetPrice, stopLoss, timeframe, conviction, notes }` only for active subscribers
- Implementation: query signals normally, then strip fields based on access check

```typescript
// In the signal serializer
function serializeSignal(signal: Signal, hasAccess: boolean) {
  const base = {
    id: signal.id,
    asset: signal.asset,
    direction: signal.direction,
    publishedAt: signal.publishedAt,
    analystId: signal.analystId,
    isPreview: !hasAccess,
  };

  if (!hasAccess) return base;

  return {
    ...base,
    entryPrice: signal.entryPrice,
    targetPrice: signal.targetPrice,
    stopLoss: signal.stopLoss,
    timeframe: signal.timeframe,
    conviction: signal.conviction,
    notes: signal.notes,
    resultPnl: signal.resultPnl,
    isPreview: false,
  };
}
```

**Annotations (`GET /api/annotations`):**
- If fetching annotations for a specific analyst, check access
- Non-subscribers: return empty array (annotations are fully gated, no preview)

**Chat (`GET /api/chat/[roomId]`, `POST /api/chat/[roomId]`):**
- Check that the subscriber has an active subscription to the analyst who owns the room
- Non-subscribers: return 403 with `{ error: 'Subscription required', analystSlug }` so the frontend can redirect to the analyst's profile

**Announcements (`GET /api/announcements`):**
- When filtered by analyst: check access
- Non-subscribers: return the 3 most recent announcements as preview, gated beyond that

#### 8.3 Frontend Access Gating

**Signal Cards:**
- Non-subscribers see the signal card with asset, direction, and a blurred/locked overlay on entry/target/stop prices
- "Subscribe to unlock" CTA button linking to the analyst's profile with tier selection
- The `isPreview` flag from the API drives this UI state

**Analyst Profile Page:**
- Always public — this is the conversion page
- Show tier cards with real pricing and "Subscribe" buttons
- Show performance metrics (public — drives trust)
- Signal list shows previews for non-subscribers

**Chat Rooms:**
- Non-subscribers see a locked state: "Subscribe to join the conversation"
- No messages visible

**Annotations on Chart:**
- Non-subscribers looking at an analyst's chart see their own chart (no annotations)
- Subscribers see the analyst's annotations overlaid

**Paywall Component:**

Create: `components/ui/Paywall.tsx`

A reusable component that:
- Shows what the subscriber is missing (blurred content behind it)
- Displays the analyst's tier cards with pricing
- Has a prominent "Subscribe" CTA
- Handles the redirect to Stripe Checkout

```typescript
interface PaywallProps {
  analystId: string;
  analystSlug: string;
  analystName: string;
  contentType: 'signals' | 'annotations' | 'chat';
}
```

**Grace Period Warning Banner:**

When `status === 'grace_period'`, show a banner at the top of gated content:
- "Your payment failed. Please update your payment method within X days to keep access."
- "Update Payment" button → Stripe Billing Portal
- Dismissible per session but reappears on next visit

**Cancellation Banner:**

When `cancelAtPeriodEnd === true`, show:
- "Your subscription ends on {date}. Resubscribe to keep access."
- "Keep Subscription" button → calls resubscribe endpoint

#### 8.4 Middleware (Optional Enhancement)

For routes that are fully gated (chat, annotations), consider a reusable middleware pattern:

Create: `lib/middleware/requireSubscription.ts`

```typescript
export function requireSubscription(analystIdExtractor: (req: Request) => string) {
  return async (req: Request, user: User) => {
    const analystId = analystIdExtractor(req);
    const access = await checkSubscriptionAccess(user.id, analystId);

    if (!access.hasAccess) {
      return Response.json({
        error: 'Subscription required',
        status: access.status,
        analystId,
      }, { status: 403 });
    }

    return null; // proceed
  };
}
```

This keeps gating logic out of individual route handlers.

---

## 9. New Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `stripe` | Stripe Node.js SDK | `npm install stripe` |

SWR is already installed from Phase 1. No other new dependencies.

---

## 10. Environment Variables

Add to `.env.local` and Vercel project settings:

```env
# Stripe
STRIPE_SECRET_KEY=              # sk_test_... (test mode) or sk_live_...
STRIPE_PUBLISHABLE_KEY=         # pk_test_... (test mode) or pk_live_...
STRIPE_WEBHOOK_SECRET=          # whsec_... (from Stripe Dashboard → Webhooks)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # Same as STRIPE_PUBLISHABLE_KEY (exposed to client for Checkout redirect)
```

For local development, use Stripe CLI to forward webhooks:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```
This prints a webhook signing secret to use as `STRIPE_WEBHOOK_SECRET` locally.

---

## 11. File Structure

**New files to create:**

```
config/
  stripe.ts                                # Platform commission, URLs, pricing limits

lib/
  stripe.ts                                # Stripe SDK singleton
  subscriptions.ts                         # checkSubscriptionAccess() utility

app/api/stripe/
  connect/
    onboard/route.ts                       # POST — Stripe Connect onboarding link
    status/route.ts                        # GET — analyst's Connect account status
  webhooks/route.ts                        # POST — Stripe webhook handler
  billing-portal/route.ts                  # POST — Subscriber billing portal session

app/api/subscriptions/
  checkout/route.ts                        # POST — Create Stripe Checkout session
  my/route.ts                              # GET — Subscriber's active subscriptions
  [id]/
    cancel/route.ts                        # POST — Cancel at period end
    change-tier/route.ts                   # POST — Upgrade/downgrade tier
    resubscribe/route.ts                   # POST — Undo pending cancellation

app/api/analysts/
  revenue/route.ts                         # GET — Analyst revenue dashboard data

components/ui/
  Paywall.tsx                              # Reusable paywall/upsell component
  GracePeriodBanner.tsx                    # Payment failure warning banner
  CancellationBanner.tsx                   # Pending cancellation notice
  StripeConnectStatus.tsx                  # Analyst onboarding status card
```

**Existing files to modify:**

```
prisma/schema.prisma                       # Add Stripe fields to User, SubscriptionTier, Subscription
app/api/subscription-tiers/route.ts        # Sync tier creation to Stripe Products/Prices
app/api/signals/route.ts                   # Add field-level gating (free preview vs full)
app/api/annotations/route.ts               # Add subscription check (fully gated)
app/api/chat/[roomId]/route.ts             # Add subscription check (fully gated)
app/api/announcements/route.ts             # Add subscription check (partial preview)
app/api/subscriptions/route.ts             # Update POST to redirect through checkout instead of direct DB write

# Frontend pages
app/analyst/[slug]/page.tsx                # Add subscribe CTA, connect tier cards to checkout
app/subscriptions/page.tsx                 # Subscriber billing dashboard (new or heavily modified)
app/settings/payments/page.tsx             # Analyst Stripe Connect onboarding page (new or modified)

# Components
components/signals/SignalCard.tsx           # Preview mode (blurred prices) for non-subscribers
components/chat/ChatRoom.tsx               # Locked state for non-subscribers
```

**Files to leave alone:**

```
# All Phase 1 market data infrastructure
# Auth system (NextAuth, JWT, roles)
# Chart components
# Review system
# Announcement creation (analyst-side)
```

---

## 12. Testing & Validation

### Stripe Test Mode

All development and staging testing uses Stripe Test Mode. Test card numbers:
- `4242424242424242` — succeeds
- `4000000000000341` — attaches but fails on first charge (tests payment failure flow)
- `4000000000009995` — always fails (tests grace period)

### Manual Verification Checklist

**Analyst Onboarding:**
- [ ] Analyst clicks "Connect Stripe" → redirected to Stripe hosted onboarding
- [ ] After completing onboarding, analyst returns to settings page showing "Connected" status
- [ ] Analyst can create subscription tiers → Stripe Product + Price created
- [ ] Analyst without Stripe Connect cannot create tiers (error shown)

**Subscription Purchase:**
- [ ] Subscriber clicks "Subscribe" on tier card → redirected to Stripe Checkout
- [ ] After payment, subscriber redirected back → subscription record created in DB
- [ ] Subscriber immediately sees full signal content (no refresh needed)
- [ ] Subscriber cannot subscribe to the same analyst twice (error shown)
- [ ] Analyst cannot subscribe to themselves (error shown)

**Access Gating:**
- [ ] Non-subscriber sees signal preview (asset + direction only, prices blurred)
- [ ] Non-subscriber cannot access annotations (empty)
- [ ] Non-subscriber cannot access chat (locked state)
- [ ] Active subscriber sees full signals, annotations, and chat
- [ ] Paywall component renders correctly with tier options

**Recurring Billing:**
- [ ] Invoice.paid webhook extends subscription period
- [ ] Invoice.payment_failed webhook sets status to past_due
- [ ] Past_due within grace period: subscriber sees warning banner but retains access
- [ ] Past_due beyond grace period: access revoked, paywall shown
- [ ] Subscription.deleted webhook sets status to canceled

**Cancellation:**
- [ ] Subscriber cancels → status shows "Cancels on {date}", access retained until then
- [ ] Subscriber re-subscribes before period end → cancellation undone
- [ ] After period end, canceled subscriber loses access

**Upgrade/Downgrade:**
- [ ] Subscriber upgrades tier → proration charged, new tier access immediate
- [ ] Subscriber downgrades tier → proration credited, takes effect at next billing

**Billing Dashboard:**
- [ ] Subscriber sees all active subscriptions with status and dates
- [ ] "Manage Billing" opens Stripe Billing Portal
- [ ] Analyst revenue dashboard shows subscriber counts, MRR, and payout history

### Production Verification

- [ ] Switch to Stripe Live mode keys
- [ ] Verify webhook endpoint registered in Stripe Dashboard for production URL
- [ ] Process a real $50 subscription (refund after testing)
- [ ] Verify platform commission appears in Stripe Dashboard
- [ ] Verify analyst receives payout in their Connected Account
- [ ] Monitor webhook delivery in Stripe Dashboard for 48hrs (check for failures)

---

## 13. Rollout Plan

1. **Prisma migration** — add Stripe fields to User, SubscriptionTier, Subscription
2. **Stripe SDK + config** — `lib/stripe.ts`, `config/stripe.ts`, env vars
3. **Analyst Connect onboarding** (6.2) — onboard route, status route, settings page
4. **Tier sync to Stripe** (6.3) — modify tier creation to create Stripe Products/Prices
5. **Checkout flow** (6.4) — checkout route, success redirect, subscription creation
6. **Webhook handler** (6.5) — all five event types
7. **Access gating** (8.1–8.4) — subscription check utility, API gating, frontend paywall
8. **Cancellation + resubscribe** (7.1) — cancel at period end, undo
9. **Upgrade/downgrade** (7.2) — tier change with proration
10. **Billing dashboards** (7.4–7.5) — subscriber and analyst views
11. **Grace period logic** (7.3) — warning banners, timed access revocation
12. **End-to-end test in Stripe Test Mode** — full happy path + failure scenarios
13. **Deploy to staging** — verify webhooks, test with Stripe CLI
14. **Switch to Live mode** — update keys, register production webhook endpoint

---

## 14. Out of Scope

The following are explicitly NOT part of this phase:

- Email notifications for billing events (Phase 3 — Stripe sends its own transactional emails by default)
- Telegram integration (Phase 3)
- Copy trading (Phase 4+)
- Multi-currency support (USD only for now)
- Crypto payments (fiat only via Stripe)
- Refund management (handle manually via Stripe Dashboard for now)
- Tax calculation (Stripe Tax can be added later)
- Invoice PDF generation (Stripe handles this automatically)
- Free trial periods (can be added later via Stripe subscription trials)
- Coupon/discount codes (can be added later via Stripe Coupons)
- Any changes to market data, charting, or the derivatives terminal
