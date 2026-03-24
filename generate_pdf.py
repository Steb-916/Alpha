#!/usr/bin/env python3
"""Generate Scope Alpha Technical Overview PDF."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable
)
import os

# Colors
BG_DARK = HexColor("#0D1117")
BG_CARD = HexColor("#161B22")
BG_CARD_LIGHT = HexColor("#1C2333")
ACCENT = HexColor("#00D4AA")
ACCENT_DIM = HexColor("#00A88A")
TEXT_PRIMARY = HexColor("#E6EDF3")
TEXT_SECONDARY = HexColor("#8B949E")
TEXT_MUTED = HexColor("#6E7681")
WHITE = white

W, H = letter

def make_styles():
    s = {}
    s['title'] = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=28,
        textColor=WHITE, alignment=TA_CENTER, spaceAfter=6, leading=34)
    s['subtitle'] = ParagraphStyle('Subtitle', fontName='Helvetica', fontSize=14,
        textColor=ACCENT, alignment=TA_CENTER, spaceAfter=4, leading=18)
    s['date'] = ParagraphStyle('Date', fontName='Helvetica', fontSize=11,
        textColor=TEXT_SECONDARY, alignment=TA_CENTER, spaceAfter=20, leading=14)
    s['h1'] = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=20,
        textColor=ACCENT, spaceBefore=16, spaceAfter=10, leading=26)
    s['h2'] = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=14,
        textColor=WHITE, spaceBefore=12, spaceAfter=6, leading=18)
    s['h3'] = ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=12,
        textColor=ACCENT_DIM, spaceBefore=8, spaceAfter=4, leading=16)
    s['body'] = ParagraphStyle('Body', fontName='Helvetica', fontSize=10,
        textColor=TEXT_PRIMARY, spaceAfter=6, leading=15, alignment=TA_JUSTIFY)
    s['bullet'] = ParagraphStyle('Bullet', fontName='Helvetica', fontSize=10,
        textColor=TEXT_PRIMARY, spaceAfter=3, leading=14, leftIndent=20,
        bulletIndent=8, bulletFontSize=10, bulletColor=ACCENT)
    s['bullet2'] = ParagraphStyle('Bullet2', fontName='Helvetica', fontSize=9.5,
        textColor=TEXT_SECONDARY, spaceAfter=2, leading=13, leftIndent=36,
        bulletIndent=24, bulletFontSize=9, bulletColor=TEXT_MUTED)
    s['small'] = ParagraphStyle('Small', fontName='Helvetica', fontSize=9,
        textColor=TEXT_SECONDARY, spaceAfter=4, leading=12)
    s['table_header'] = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9,
        textColor=WHITE, leading=12)
    s['table_cell'] = ParagraphStyle('TC', fontName='Helvetica', fontSize=9,
        textColor=TEXT_PRIMARY, leading=12)
    return s

ST = make_styles()

class DarkPageTemplate:
    def __init__(self):
        self.page_count = 0

    def __call__(self, canvas, doc):
        self.page_count += 1
        canvas.saveState()
        canvas.setFillColor(BG_DARK)
        canvas.rect(0, 0, W, H, fill=1, stroke=0)
        if self.page_count > 1:
            canvas.setFillColor(TEXT_MUTED)
            canvas.setFont("Helvetica", 8)
            canvas.drawCentredString(W / 2, 30, f"Scope Alpha  |  Technical Overview & Product Roadmap  |  Page {self.page_count}")
            canvas.setStrokeColor(ACCENT)
            canvas.setLineWidth(2)
            canvas.line(50, H - 40, W - 50, H - 40)
        canvas.restoreState()

dark_page = DarkPageTemplate()

def hr():
    return HRFlowable(width="100%", thickness=1, color=BG_CARD_LIGHT, spaceAfter=8, spaceBefore=8)

def section(num, title):
    return Paragraph(f"<font color='#6E7681'>{num}.</font>  {title}", ST['h1'])

def sub(title):
    return Paragraph(title, ST['h2'])

def body(text):
    return Paragraph(text, ST['body'])

def bullet(text):
    return Paragraph(text, ST['bullet'], bulletText="\u2022")

def spacer(h=6):
    return Spacer(1, h)

def accent(text):
    return f"<font color='#00D4AA'><b>{text}</b></font>"

def bold(text):
    return f"<b>{text}</b>"

def muted(text):
    return f"<font color='#8B949E'>{text}</font>"

def make_table(headers, rows, col_widths=None):
    data = [[Paragraph(h, ST['table_header']) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), ST['table_cell']) for c in row])
    if col_widths is None:
        col_widths = [None] * len(headers)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), BG_CARD),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor("#0F1419")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor("#0F1419"), HexColor("#131920")]),
        ('TEXTCOLOR', (0, 0), (-1, -1), TEXT_PRIMARY),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, BG_CARD_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    t.setStyle(TableStyle(style))
    return t

# Build
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Scope_Alpha_Technical_Overview.pdf")

doc = SimpleDocTemplate(
    output_path, pagesize=letter,
    topMargin=60, bottomMargin=50, leftMargin=55, rightMargin=55,
)

story = []

# ── TITLE PAGE ──
story.append(Spacer(1, 140))
story.append(HRFlowable(width="60%", thickness=2, color=ACCENT, spaceAfter=20))
story.append(Paragraph("SCOPE ALPHA", ST['title']))
story.append(Spacer(1, 6))
story.append(Paragraph("Technical Overview &amp; Product Roadmap", ParagraphStyle(
    'SubMain', fontName='Helvetica', fontSize=16, textColor=TEXT_PRIMARY,
    alignment=TA_CENTER, spaceAfter=8, leading=20)))
story.append(HRFlowable(width="60%", thickness=2, color=ACCENT, spaceAfter=16, spaceBefore=12))
story.append(Paragraph("Trading Strategy Marketplace Platform", ST['subtitle']))
story.append(Paragraph("Demo Stage  |  March 2026", ST['date']))
story.append(Spacer(1, 50))
story.append(Paragraph(
    f"A crypto derivatives analytics and trading strategy marketplace that enables "
    f"verified analysts to publish {accent('timestamped trading signals')}, create "
    f"visual {accent('chart annotations')}, and monetize their expertise through "
    f"{accent('subscription tiers')}.",
    ParagraphStyle('Intro', fontName='Helvetica', fontSize=11, textColor=TEXT_SECONDARY,
                   alignment=TA_CENTER, leading=16, leftIndent=40, rightIndent=40)))
story.append(Spacer(1, 80))
story.append(Paragraph("CONFIDENTIAL  |  FOR RESEARCH PURPOSES",
    ParagraphStyle('Conf', fontName='Helvetica-Bold', fontSize=9,
                   textColor=TEXT_MUTED, alignment=TA_CENTER)))
story.append(PageBreak())

# ── TABLE OF CONTENTS ──
story.append(Spacer(1, 20))
story.append(Paragraph("TABLE OF CONTENTS", ParagraphStyle(
    'TOCTitle', fontName='Helvetica-Bold', fontSize=18, textColor=ACCENT,
    alignment=TA_CENTER, spaceAfter=20)))
story.append(hr())

toc_items = [
    ("1", "Executive Summary"),
    ("2", "Core Value Proposition"),
    ("3", "Current Demo Features"),
    ("4", "Tech Stack"),
    ("5", "Database Architecture"),
    ("6", "API Architecture"),
    ("7", "Product Roadmap"),
    ("8", "Revenue Model"),
    ("9", "Competitive Advantages"),
    ("10", "Current Limitations"),
    ("11", "Conclusion"),
]
for num, title in toc_items:
    story.append(Paragraph(
        f"<font color='#00D4AA'><b>{num}</b></font>&nbsp;&nbsp;&nbsp;&nbsp;{title}",
        ParagraphStyle('TOCItem', fontName='Helvetica', fontSize=12,
                       textColor=TEXT_PRIMARY, spaceAfter=8, leading=18, leftIndent=60)))
story.append(PageBreak())

# ── 1. EXECUTIVE SUMMARY ──
story.append(section("1", "Executive Summary"))
story.append(hr())
story.append(body(
    f"Scope Alpha is a {accent('crypto derivatives analytics and trading strategy marketplace')}. "
    f"The platform enables verified analysts to publish timestamped trading signals, create visual "
    f"chart annotations, and monetize their trading expertise through tiered subscription plans."))
story.append(body(
    f"Subscribers can browse the marketplace, view analyst profiles with {accent('verified performance records')}, "
    f"and subscribe to receive real-time signals and chart annotations overlaid directly on their trading charts."))
story.append(body(
    f"The application is currently in {accent('demo/alpha stage')} with mock data for development and public testing. "
    f"The core platform architecture (authentication, signals, annotations, subscriptions, reviews, chat) "
    f"has been built and is ready for iteration toward production."))
story.append(spacer(8))

metrics_data = [
    ["Total API Endpoints", "25+", "Implemented"],
    ["Database Models", "10", "Production-ready"],
    ["React Components", "30+", "Built"],
    ["Pages / Routes", "15+", "Functional"],
    ["Auth Providers", "3 (Email, Google, Demo)", "Active"],
]
story.append(make_table(
    ["Demo Metrics", "Value", "Status"], metrics_data,
    col_widths=[2.5*inch, 2.5*inch, 1.5*inch]))
story.append(PageBreak())

# ── 2. CORE VALUE PROPOSITION ──
story.append(section("2", "Core Value Proposition"))
story.append(hr())

story.append(sub(f"{accent('For Analysts')} \u2014 Monetize Trading Expertise"))
story.append(bullet("Publish timestamped, immutable trading signals that build a verified track record"))
story.append(bullet("Create visual chart annotations (trend lines, zones, notes) for subscribers"))
story.append(bullet("Build a subscriber base and earn recurring revenue through tiered subscriptions ($50\u2013$2,000/mo)"))
story.append(bullet("Performance metrics are auto-calculated \u2014 no manual reporting needed"))
story.append(spacer(8))

story.append(sub(f"{accent('For Subscribers')} \u2014 Access Verified Strategies"))
story.append(bullet("Browse analysts filtered by win rate, P&amp;L, trading style, price, and rating"))
story.append(bullet("Access verified trading strategies instead of trusting unverified social media callouts"))
story.append(bullet("Get real-time signals and chart annotations directly on trading charts"))
story.append(bullet("Leave reviews and ratings to help the community identify top performers"))
story.append(spacer(8))

story.append(sub(f"{accent('For the Market')} \u2014 Accountability &amp; Transparency"))
story.append(bullet("All signals are timestamped and immutable after publication \u2014 no retroactive editing"))
story.append(bullet("Performance metrics are auto-calculated from resolved trades, not self-reported"))
story.append(bullet("Brings accountability to an industry plagued by unverifiable claims"))
story.append(PageBreak())

# ── 3. CURRENT DEMO FEATURES ──
story.append(section("3", "Current Demo Features"))
story.append(hr())
story.append(body(
    f"The following features have been fully implemented in the demo. All features use "
    f"mock/seeded data but are backed by {accent('production-ready API routes and database models')}."))
story.append(spacer(6))

story.append(sub("3.1  Derivatives Terminal"))
story.append(body("The main trading dashboard provides a comprehensive view of crypto derivatives markets:"))
story.append(bullet(f"{bold('Price Charts')} \u2014 TradingView-like charting powered by Lightweight Charts library"))
story.append(bullet(f"{bold('Health Score Dashboard')} \u2014 Composite metric combining funding rates, open interest, liquidations, and basis"))
story.append(bullet(f"{bold('Funding Rate Analysis')} \u2014 Current rates, 8-hour average, annualized carry, z-score, by-exchange breakdown"))
story.append(bullet(f"{bold('Open Interest Tracker')} \u2014 Aggregate OI, net changes, per-exchange breakdown"))
story.append(bullet(f"{bold('Liquidation Monitor')} \u2014 Long/short liquidation volumes with exchange heatmap"))
story.append(bullet(f"{bold('Perpetual Basis Analyzer')} \u2014 Basis percentage, annualized rate, per-exchange comparison"))
story.append(bullet(f"{bold('Multi-Asset Screener')} \u2014 Sortable table with sparklines across all metrics and regime classification"))
story.append(spacer(6))

story.append(sub("3.2  Analyst Marketplace"))
story.append(bullet("Browse and search analysts by name"))
story.append(bullet("Filter by subscription price, win rate, primary asset, subscriber count, and rating"))
story.append(bullet("Sort by subscribers, win rate, P&amp;L, price, rating, or newest"))
story.append(bullet("Analyst cards display key metrics with performance sparklines"))
story.append(bullet("Individual profile pages show full performance breakdown, active signals, and reviews"))
story.append(spacer(6))

story.append(sub("3.3  Signal System (Trading Callouts)"))
story.append(bullet(f"Create signals with {accent('asset, direction (long/short), entry/target/stop prices')}"))
story.append(bullet("Timeframe support: 1m, 5m, 15m, 1H, 4H, 1D, 1W"))
story.append(bullet("Conviction levels: low, medium, high"))
story.append(bullet(f"{bold('Immutable publish timestamps')} \u2014 signals cannot be edited after publication"))
story.append(bullet("Validation logic ensures price coherence (longs: target > entry > stop; shorts: inverse)"))
story.append(bullet("Manual resolution records actual closing price and calculates result P&amp;L %"))
story.append(spacer(6))

story.append(sub("3.4  Chart Annotation System"))
story.append(bullet("Horizontal trend lines with customizable labels"))
story.append(bullet("Support/resistance zones rendered as colored areas"))
story.append(bullet("Text notes placed at specific price levels"))
story.append(bullet("Per-asset, per-timeframe storage with active/draft status"))
story.append(bullet("Real-time sync across the UI via Zustand state management"))
story.append(spacer(6))

story.append(sub("3.5  Performance Analytics"))
story.append(body("All metrics are auto-calculated from resolved signals:"))
story.append(bullet("Win rate, average P&amp;L per trade, profit factor, risk/reward ratio"))
story.append(bullet("Best and worst winning/losing streaks"))
story.append(bullet("Total P&amp;L and rolling 90-day P&amp;L tracking"))
story.append(bullet("Monthly returns chart and cumulative P&amp;L curve visualization"))
story.append(spacer(6))

story.append(sub("3.6  Subscription &amp; Monetization"))
story.append(bullet("Analysts create 1\u20133 subscription tiers at different price points"))
story.append(bullet("Each tier includes a description and feature list"))
story.append(bullet("One active subscription per subscriber-analyst pair (uniqueness constraint)"))
story.append(bullet("Stripe integration placeholder (mocked during demo, ready for production wiring)"))
story.append(spacer(6))

story.append(sub("3.7  Community Features"))
story.append(bullet(f"{bold('Chat')} \u2014 Room-based messaging with reply threads and message pinning"))
story.append(bullet(f"{bold('Announcements')} \u2014 Analyst broadcasts delivered to all subscribers"))
story.append(bullet(f"{bold('Reviews')} \u2014 Subscriber ratings (1\u20135 stars) with text reviews and analyst responses"))
story.append(spacer(6))

story.append(sub("3.8  Authentication &amp; Security"))
story.append(bullet(f"{bold('Email/Password')} \u2014 Credentials provider with bcrypt password hashing"))
story.append(bullet(f"{bold('Google OAuth')} \u2014 Optional social login via Google"))
story.append(bullet(f"{bold('Demo Mode')} \u2014 One-click exploration without registration (auto-seeds analyst data)"))
story.append(bullet("JWT session strategy with 30-day expiration"))
story.append(bullet("Role-based access control: subscriber vs. analyst permissions on all endpoints"))
story.append(PageBreak())

# ── 4. TECH STACK ──
story.append(section("4", "Tech Stack"))
story.append(hr())

tech_rows = [
    ["Frontend Framework", "Next.js 14.2.5, React 18.3.1, TypeScript 5.4.5"],
    ["State Management", "Zustand 4.5.2 with localStorage persistence"],
    ["Styling", "Tailwind CSS 3.4.4 with custom glass-morphism design system"],
    ["Charts", "Lightweight Charts 4.2.0 (TradingView-like)"],
    ["Icons", "Lucide React"],
    ["Authentication", "NextAuth 4.24.13, JWT sessions, bcrypt, Google OAuth"],
    ["Database", "PostgreSQL via Neon (cloud), connection pooling"],
    ["ORM", "Prisma 6.19.2 with full schema migrations"],
    ["Fonts", "Outfit (display), JetBrains Mono (code/data)"],
    ["Build Tools", "PostCSS 8.4.38, Autoprefixer 10.4.19"],
    ["Deployment", "Vercel (frontend) + Neon PostgreSQL (database)"],
]
story.append(make_table(["Layer", "Technology"], tech_rows,
    col_widths=[2*inch, 4.5*inch]))
story.append(PageBreak())

# ── 5. DATABASE ARCHITECTURE ──
story.append(section("5", "Database Architecture"))
story.append(hr())
story.append(body("The database is modeled with Prisma ORM and deployed on Neon PostgreSQL. "
    "The schema consists of 10 interconnected models:"))
story.append(spacer(6))

db_rows = [
    ["User", "Core account: email, password hash, display name, slug, role (subscriber/analyst), avatar, bio, social links"],
    ["AnalystProfile", "Extended profile: tagline, primary assets, trading style, experience years, subscription acceptance flag"],
    ["AnalystPerformance", "Calculated metrics: total signals, win count/rate, P&L %, profit factor, Sharpe-like ratios, subscriber count"],
    ["Signal", "Trading callouts: asset, direction, entry/target/stop, timeframe, conviction, publish timestamp, result P&L %"],
    ["Annotation", "Chart drawings: horizontal lines, zones, text notes tied to asset/timeframe with active/draft status"],
    ["SubscriptionTier", "Pricing tiers per analyst ($50-$2,000/mo) with feature lists"],
    ["Subscription", "Links subscribers to analysts: tier, period dates, Stripe integration fields"],
    ["ChatMessage", "Room-based messaging with reply threads and pinning support"],
    ["Announcement", "Analyst broadcasts delivered to subscribers"],
    ["Review", "Subscriber ratings (1-5 stars) with text content and analyst responses"],
]
story.append(make_table(["Model", "Description"], db_rows,
    col_widths=[1.6*inch, 4.9*inch]))
story.append(spacer(10))

story.append(sub("Key Relationships &amp; Constraints"))
story.append(bullet("User 1:1 AnalystProfile (created on role upgrade)"))
story.append(bullet("User 1:1 AnalystPerformance (auto-calculated from signals)"))
story.append(bullet("AnalystProfile 1:N Signal, Annotation, SubscriptionTier, Announcement"))
story.append(bullet("User (subscriber) N:M AnalystProfile via Subscription (unique per pair)"))
story.append(bullet("User (subscriber) 1:N Review per analyst (one review per analyst)"))
story.append(bullet("ChatMessage self-referencing for reply threads"))
story.append(PageBreak())

# ── 6. API ARCHITECTURE ──
story.append(section("6", "API Architecture"))
story.append(hr())
story.append(body(
    "All API routes follow RESTful conventions with role-based authorization. "
    "Mutation endpoints require authentication and verify user roles before processing."))
story.append(spacer(6))

api_rows = [
    ["Auth", "/api/auth/*", "Signup, demo login, NextAuth (credentials + OAuth)"],
    ["Users", "/api/users/*", "Profile management, become-analyst upgrade"],
    ["Signals", "/api/signals/*", "CRUD with price validation, analyst-only mutations"],
    ["Annotations", "/api/annotations/*", "CRUD for chart drawings, analyst-only mutations"],
    ["Subscriptions", "/api/subscriptions/*", "Subscribe, manage, cancel (mock Stripe)"],
    ["Tiers", "/api/subscription-tiers/*", "Create/fetch pricing tiers, analyst-only creation"],
    ["Reviews", "/api/reviews/*", "Create reviews (subscriber-only), analyst responses"],
    ["Chat", "/api/chat/[roomId]", "Room-based messaging with cursor pagination"],
    ["Announcements", "/api/announcements/*", "Create/fetch broadcasts, analyst-only creation"],
    ["Analysts", "/api/analysts/[slug]", "Public analyst profile lookup by slug"],
]
story.append(make_table(["Group", "Endpoint Pattern", "Description"], api_rows,
    col_widths=[1.2*inch, 2*inch, 3.3*inch]))
story.append(spacer(10))

story.append(sub("Authorization Pattern"))
story.append(body("Every mutation endpoint follows a consistent authorization check:"))
story.append(bullet("Verify JWT session exists (401 Unauthorized if not)"))
story.append(bullet("Check user role matches required permission (403 Forbidden if not)"))
story.append(bullet("Validate request body against expected schema"))
story.append(bullet("Execute database operation within Prisma transaction where needed"))
story.append(PageBreak())

# ── 7. PRODUCT ROADMAP ──
story.append(section("7", "Product Roadmap"))
story.append(hr())
story.append(body(
    "The following roadmap outlines the path from demo to production and beyond. "
    "Each phase builds on the previous, with Phase 1 being the minimum viable product."))
story.append(spacer(8))

story.append(sub(f"{accent('Phase 1')} \u2014 Core Infrastructure {muted('(MVP)')}"))
story.append(body("Essential integrations needed to transition from demo to a functional product:"))
story.append(bullet(f"{bold('Real-time Market Data Feeds')} \u2014 WebSocket integration with exchanges (Binance, Bybit, OKX) for live OHLC, funding rates, OI, and liquidation data"))
story.append(bullet(f"{bold('Stripe Payment Integration')} \u2014 Subscription billing, analyst payouts, platform commission handling"))
story.append(bullet(f"{bold('Email Verification &amp; Notifications')} \u2014 Account verification, signal alerts, subscription confirmations"))
story.append(bullet(f"{bold('Real-time Signal Notifications')} \u2014 Push notifications, email alerts, and Telegram bot integration for instant signal delivery"))
story.append(spacer(8))

story.append(sub(f"{accent('Phase 2')} \u2014 Enhanced Features"))
story.append(body("Feature enhancements that increase platform stickiness and value:"))
story.append(bullet(f"{bold('Copy Trading / Auto-Execution')} \u2014 Allow subscribers to auto-mirror analyst trades on connected exchange accounts"))
story.append(bullet(f"{bold('Advanced Charting Tools')} \u2014 Fibonacci retracements, trend channels, pattern recognition overlays"))
story.append(bullet(f"{bold('Portfolio Tracking')} \u2014 Subscribers track their P&amp;L from followed signals in a unified dashboard"))
story.append(bullet(f"{bold('Analyst Leaderboards')} \u2014 Time-weighted rankings with multiple scoring criteria"))
story.append(bullet(f"{bold('Social Features')} \u2014 Follow, like, share signals; social feed of analyst activity"))
story.append(spacer(8))

story.append(sub(f"{accent('Phase 3')} \u2014 Platform Growth"))
story.append(body("Expansion features for broader market reach:"))
story.append(bullet(f"{bold('Mobile App')} \u2014 React Native cross-platform app for iOS and Android"))
story.append(bullet(f"{bold('API Access')} \u2014 Programmatic signal consumption for algorithmic traders and third-party integrations"))
story.append(bullet(f"{bold('Custom Indicator Marketplace')} \u2014 Pine Script equivalent for creating and selling custom indicators"))
story.append(bullet(f"{bold('Research Publishing')} \u2014 Platform for analysts to publish long-form research papers and market analysis"))
story.append(bullet(f"{bold('Backtesting Engine')} \u2014 Historical strategy validation against real market data"))
story.append(bullet(f"{bold('Multi-Asset Expansion')} \u2014 Extend beyond crypto to forex, stocks, commodities, and indices"))
story.append(spacer(8))

story.append(sub(f"{accent('Phase 4')} \u2014 Enterprise"))
story.append(body("Institutional-grade features for professional firms:"))
story.append(bullet(f"{bold('Institutional Verification')} \u2014 KYC/AML compliance for analyst identity verification"))
story.append(bullet(f"{bold('White-Label Solutions')} \u2014 Customizable platform for trading firms and hedge funds"))
story.append(bullet(f"{bold('Audit Trail &amp; Compliance')} \u2014 Full reporting for regulatory requirements"))
story.append(bullet(f"{bold('Admin Analytics Dashboard')} \u2014 Platform-wide metrics, user behavior, and revenue analytics"))
story.append(PageBreak())

# ── 8. REVENUE MODEL ──
story.append(section("8", "Revenue Model"))
story.append(hr())

rev_rows = [
    ["Subscription Commission", "15\u201325% of all analyst subscription revenue", "Primary"],
    ["Premium Listings", "Paid placement for analyst visibility in marketplace", "Secondary"],
    ["Featured Promotions", "Analysts pay for featured placement and boosted visibility", "Secondary"],
    ["API Access Tiers", "Paid tiers for programmatic signal access (developers, algo traders)", "Future"],
    ["Enterprise Licensing", "White-label platform licensing for trading firms", "Future"],
]
story.append(make_table(["Revenue Stream", "Description", "Priority"], rev_rows,
    col_widths=[1.8*inch, 3.5*inch, 1.2*inch]))
story.append(spacer(10))
story.append(body(
    "The primary revenue driver is the platform commission on analyst subscriptions. "
    "With analyst tiers ranging from $50 to $2,000/month, even a modest analyst base "
    "generates meaningful recurring revenue. Secondary streams diversify income as the "
    "platform scales."))
story.append(PageBreak())

# ── 9. COMPETITIVE ADVANTAGES ──
story.append(section("9", "Competitive Advantages"))
story.append(hr())

story.append(bullet(f"{bold('Immutable, Timestamped Signals')} \u2014 Unlike social media callouts, signals cannot be retroactively edited or deleted. This creates genuine accountability."))
story.append(spacer(4))
story.append(bullet(f"{bold('Transparent Performance Metrics')} \u2014 All metrics are auto-calculated from resolved trades, eliminating self-reported and potentially fabricated performance claims."))
story.append(spacer(4))
story.append(bullet(f"{bold('Professional-Grade Charting')} \u2014 Integrated charting with analyst annotation overlay, not just text-based signals. Subscribers see exactly what the analyst sees."))
story.append(spacer(4))
story.append(bullet(f"{bold('Derivatives-Focused')} \u2014 Purpose-built for derivatives trading with funding rates, open interest, liquidations, and basis analysis. Not a generic signals platform."))
story.append(spacer(4))
story.append(bullet(f"{bold('Modern Tech Stack')} \u2014 Next.js 14, React 18, TypeScript, Prisma, Zustand \u2014 enabling rapid iteration and a responsive user experience."))
story.append(spacer(4))
story.append(bullet(f"{bold('Glass-Morphism UI')} \u2014 A distinctive, modern design language that differentiates from legacy trading platforms and signals services."))
story.append(PageBreak())

# ── 10. CURRENT LIMITATIONS ──
story.append(section("10", "Current Limitations (Demo State)"))
story.append(hr())
story.append(body(
    "The following limitations are expected for a demo-stage product and represent "
    "the gap between the current build and a production-ready platform:"))
story.append(spacer(6))

limits_rows = [
    ["Market Data", "Mock/generated data, not live exchange feeds", "Phase 1"],
    ["WebSocket Feeds", "No live real-time data streaming", "Phase 1"],
    ["Payments", "Stripe not connected; subscriptions are mocked", "Phase 1"],
    ["Email System", "No email verification or notifications", "Phase 1"],
    ["State Persistence", "Some features use local state (Zustand) instead of DB", "Phase 1"],
    ["Notifications", "No push, email, or Telegram signal alerts", "Phase 1"],
    ["Mobile", "Basic responsive only; no dedicated mobile app", "Phase 3"],
]
story.append(make_table(["Area", "Limitation", "Resolved In"], limits_rows,
    col_widths=[1.5*inch, 3.5*inch, 1.5*inch]))
story.append(PageBreak())

# ── 11. CONCLUSION ──
story.append(section("11", "Conclusion"))
story.append(hr())
story.append(body(
    f"Scope Alpha demonstrates a {accent('functional proof-of-concept')} for a trading strategy "
    f"marketplace. The core platform architecture \u2014 authentication, trading signals, chart annotations, "
    f"subscriptions, reviews, and community chat \u2014 has been built with production-quality code patterns."))
story.append(spacer(4))
story.append(body(
    f"The {accent('database schema, API routes, and frontend components')} are all designed for scalability "
    f"and follow modern best practices (TypeScript, Prisma ORM, JWT auth, role-based access control). "
    f"The glass-morphism design system provides a distinctive, professional visual identity."))
story.append(spacer(4))
story.append(body(
    f"The immediate next steps focus on {accent('Phase 1')} of the roadmap: integrating real-time "
    f"market data feeds, connecting Stripe for payment processing, implementing email notifications, "
    f"and building real-time signal delivery. These integrations will transition Scope Alpha from "
    f"a demo into a functional product ready for early users and market validation."))
story.append(spacer(20))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, spaceAfter=12))
story.append(Paragraph(
    "Scope Alpha  |  March 2026  |  Confidential",
    ParagraphStyle('EndNote', fontName='Helvetica', fontSize=10,
                   textColor=TEXT_MUTED, alignment=TA_CENTER)))

# Generate
doc.build(story, onFirstPage=dark_page, onLaterPages=dark_page)
print(f"PDF generated: {output_path}")
print(f"Size: {os.path.getsize(output_path) / 1024:.1f} KB")
