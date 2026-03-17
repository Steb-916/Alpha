"""Generate Scope Alpha — Complete Behind The Scenes PDF."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    HRFlowable, KeepTogether, ListFlowable, ListItem,
)
from reportlab.platypus.flowables import Flowable

# ── Colors ──────────────────────────────────────────────────────────
DARK_BG = HexColor("#0B0E14")
ACCENT_GREEN = HexColor("#00D4AA")
ACCENT_PURPLE = HexColor("#8B5CF6")
DARK_CARD = HexColor("#131720")
TEXT_DIM = HexColor("#6B7280")
SECTION_BG = HexColor("#F8FAFC")
BORDER_GRAY = HexColor("#E2E8F0")
HEADING_DARK = HexColor("#0F172A")
SUBHEADING = HexColor("#334155")
BODY_TEXT = HexColor("#374151")
CODE_BG = HexColor("#F1F5F9")
CALLOUT_BG = HexColor("#F0FDF4")
CALLOUT_BORDER = HexColor("#86EFAC")

OUTPUT = os.path.join(os.path.dirname(__file__), "Scope_Alpha_Technical_Overview.pdf")

# ── Styles ──────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

styles.add(ParagraphStyle("DocTitle", parent=styles["Title"], fontSize=28, leading=34, textColor=HEADING_DARK, spaceAfter=6, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("DocSubtitle", parent=styles["Normal"], fontSize=13, leading=18, textColor=SUBHEADING, spaceAfter=24, fontName="Helvetica"))
styles.add(ParagraphStyle("SectionHead", parent=styles["Heading1"], fontSize=18, leading=24, textColor=HEADING_DARK, spaceBefore=20, spaceAfter=10, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("SubHead", parent=styles["Heading2"], fontSize=13, leading=17, textColor=SUBHEADING, spaceBefore=12, spaceAfter=6, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("SubSubHead", parent=styles["Heading3"], fontSize=11, leading=15, textColor=SUBHEADING, spaceBefore=8, spaceAfter=4, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("Body", parent=styles["Normal"], fontSize=10.5, leading=16, textColor=BODY_TEXT, spaceAfter=8, fontName="Helvetica", alignment=TA_JUSTIFY))
styles.add(ParagraphStyle("BodyBold", parent=styles["Normal"], fontSize=10.5, leading=16, textColor=HEADING_DARK, spaceAfter=4, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("BulletItem", parent=styles["Normal"], fontSize=10.5, leading=16, textColor=BODY_TEXT, spaceAfter=4, fontName="Helvetica", leftIndent=20, bulletIndent=8, alignment=TA_LEFT))
styles.add(ParagraphStyle("CodeBlock", parent=styles["Normal"], fontSize=9, leading=13, textColor=HexColor("#1E293B"), fontName="Courier", backColor=CODE_BG, leftIndent=12, rightIndent=12, spaceBefore=4, spaceAfter=8, borderColor=BORDER_GRAY, borderWidth=0.5, borderPadding=6))
styles.add(ParagraphStyle("FileTree", parent=styles["Normal"], fontSize=9, leading=13, textColor=HexColor("#475569"), fontName="Courier", leftIndent=16, spaceAfter=2))
styles.add(ParagraphStyle("Caption", parent=styles["Normal"], fontSize=9, leading=12, textColor=TEXT_DIM, fontName="Helvetica-Oblique", alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle("Callout", parent=styles["Normal"], fontSize=10, leading=15, textColor=HexColor("#166534"), fontName="Helvetica", backColor=CALLOUT_BG, leftIndent=12, rightIndent=12, spaceBefore=6, spaceAfter=10, borderColor=CALLOUT_BORDER, borderWidth=1, borderPadding=8))
styles.add(ParagraphStyle("QA_Q", parent=styles["Normal"], fontSize=10.5, leading=16, textColor=HEADING_DARK, spaceAfter=2, fontName="Helvetica-Bold", leftIndent=4))
styles.add(ParagraphStyle("QA_A", parent=styles["Normal"], fontSize=10.5, leading=16, textColor=BODY_TEXT, spaceAfter=10, fontName="Helvetica", leftIndent=16))


# ── Custom flowables ────────────────────────────────────────────────
class ColorBar(Flowable):
    def __init__(self, width=480, height=3, color=ACCENT_GREEN):
        super().__init__()
        self.bar_width = width
        self.bar_height = height
        self.bar_color = color
    def draw(self):
        self.canv.setFillColor(self.bar_color)
        self.canv.roundRect(0, 0, self.bar_width, self.bar_height, 1.5, fill=1, stroke=0)
    def wrap(self, availWidth, availHeight):
        return self.bar_width, self.bar_height + 4


class ColorSwatch(Flowable):
    def __init__(self, color_hex, label, width=280, height=18):
        super().__init__()
        self.color_hex = color_hex
        self.label = label
        self.swatch_width = width
        self.swatch_height = height
    def draw(self):
        self.canv.setFillColor(HexColor(self.color_hex))
        self.canv.roundRect(0, 2, 14, 14, 2, fill=1, stroke=0)
        self.canv.setFillColor(BODY_TEXT)
        self.canv.setFont("Courier", 9)
        self.canv.drawString(20, 4, f"{self.color_hex}  {self.label}")
    def wrap(self, availWidth, availHeight):
        return self.swatch_width, self.swatch_height


# ── Page templates ──────────────────────────────────────────────────
def footer_template(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER_GRAY); canvas.setLineWidth(0.5)
    canvas.line(54, 42, letter[0]-54, 42)
    canvas.setFont("Helvetica", 7.5); canvas.setFillColor(TEXT_DIM)
    canvas.drawString(54, 30, "Scope Alpha  |  Behind The Scenes  |  Complete Technical Walkthrough")
    canvas.drawRightString(letter[0]-54, 30, f"Page {doc.page}")
    canvas.setStrokeColor(ACCENT_GREEN); canvas.setLineWidth(2)
    canvas.line(54, letter[1]-36, letter[0]-54, letter[1]-36)
    canvas.restoreState()

def first_page_template(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(ACCENT_GREEN); canvas.setLineWidth(4)
    canvas.line(54, letter[1]-36, letter[0]-54, letter[1]-36)
    canvas.setStrokeColor(BORDER_GRAY); canvas.setLineWidth(0.5)
    canvas.line(54, 42, letter[0]-54, 42)
    canvas.setFont("Helvetica", 7.5); canvas.setFillColor(TEXT_DIM)
    canvas.drawString(54, 30, "Scope Alpha  |  Behind The Scenes  |  Complete Technical Walkthrough")
    canvas.drawRightString(letter[0]-54, 30, f"Page {doc.page}")
    canvas.restoreState()


# ── Helpers ─────────────────────────────────────────────────────────
def section(title, items):
    result = [ColorBar(), Paragraph(title, styles["SectionHead"])]
    result.extend(items)
    return result

def bullet(text):
    return Paragraph(f"\u2022  {text}", styles["BulletItem"])

def body(text):
    return Paragraph(text, styles["Body"])

def bold_body(text):
    return Paragraph(text, styles["BodyBold"])

def sub(title):
    return Paragraph(title, styles["SubHead"])

def subsub(title):
    return Paragraph(title, styles["SubSubHead"])

def code(text):
    return Paragraph(text, styles["CodeBlock"])

def callout(text):
    return Paragraph(text, styles["Callout"])

def qa(q, a):
    return [Paragraph(f"Q: {q}", styles["QA_Q"]), Paragraph(a, styles["QA_A"])]

def file_line(text):
    return Paragraph(text, styles["FileTree"])


# ── Build document ──────────────────────────────────────────────────
def build_pdf():
    doc = SimpleDocTemplate(OUTPUT, pagesize=letter, topMargin=56, bottomMargin=56, leftMargin=54, rightMargin=54)
    story = []

    # ══════════════════════════════════════════════════════════════
    #  COVER PAGE
    # ══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 50))
    story.append(Paragraph("SCOPE ALPHA", styles["DocTitle"]))
    story.append(Paragraph("Behind The Scenes \u2014 Complete Technical Walkthrough", styles["DocSubtitle"]))
    story.append(ColorBar(width=120, height=4, color=ACCENT_GREEN))
    story.append(Spacer(1, 16))
    story.append(body(
        "Everything you need to know to present Scope Alpha to a CS audience. "
        "This document walks through every layer of the application \u2014 from the landing page animations "
        "to the terminal data pipeline \u2014 explaining exactly which technology powers each feature "
        "and why each decision was made."
    ))
    story.append(Spacer(1, 12))

    toc_items = [
        "1.  What Scope Alpha Is (Product Pitch)",
        "2.  The Landing Page \u2014 Hero, Animations, Floating Dashboard",
        "3.  The Terminal Shell \u2014 Sidebar, TopBar, Keyboard Shortcuts",
        "4.  Dashboard Page \u2014 Charts, Watchlist, Data Flow",
        "5.  Every Terminal Page (OI, Funding, Liquidations, Basis, Screener)",
        "6.  The Design System \u2014 NeuCard, DataCell, Badge, Colors",
        "7.  The Data Layer \u2014 Seeded PRNG, Mock Generators",
        "8.  State Management \u2014 Zustand + Hydration Strategy",
        "9.  Fonts, CSS, Tailwind Configuration",
        "10. Full Tech Stack Summary",
        "11. Is There a Live API? (Honest Answer)",
        "12. Likely Questions &amp; Answers (Cheat Sheet)",
        "13. File Map \u2014 Every File and What It Does",
        "14. How to Run It",
    ]
    for item in toc_items:
        story.append(Paragraph(item, ParagraphStyle("TOC", parent=styles["Normal"], fontSize=10, leading=16, textColor=SUBHEADING, fontName="Helvetica", leftIndent=8, spaceAfter=3)))

    story.append(Spacer(1, 12))
    story.append(Paragraph("March 2026  \u00b7  Presentation Reference Document", styles["Caption"]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  1. PRODUCT PITCH
    # ══════════════════════════════════════════════════════════════
    story.extend(section("1. What Scope Alpha Is", [
        body("Scope Alpha is a <b>crypto derivatives analytics terminal</b>. Think of it as a Bloomberg Terminal but specifically for crypto futures and perpetual swap markets."),
        sub("Who is it for?"),
        bullet("<b>Quantitative traders</b> who need funding rate signals and basis arbitrage data."),
        bullet("<b>Risk managers</b> monitoring open interest shifts and liquidation cascades."),
        bullet("<b>Derivatives desks</b> that need a unified view of all leveraged market signals."),
        sub("What signals does it track?"),
        bullet("<b>Funding Rates</b> \u2014 the periodic fee perpetual swap holders pay. When longs pay shorts, the market is over-leveraged long."),
        bullet("<b>Open Interest (OI)</b> \u2014 total value of outstanding futures contracts. Rising OI + rising price = new money entering."),
        bullet("<b>Liquidations</b> \u2014 forced closures of leveraged positions. Cascading liquidations cause flash crashes."),
        bullet("<b>Basis</b> \u2014 the premium or discount of futures vs spot price. Positive basis (contango) = bullish sentiment."),
        bullet("<b>Health Score</b> \u2014 a composite metric combining all the above into a single risk regime indicator."),
        Spacer(1, 6),
        callout("<b>Key point for your presentation:</b> This is a <b>frontend prototype</b> with no live data yet. All numbers are generated by a seeded random number generator. The UI is production-quality, but the data is fake (by design)."),
    ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  2. LANDING PAGE
    # ══════════════════════════════════════════════════════════════
    story.extend(section("2. The Landing Page", [
        body("When you open <b>localhost:3000</b>, you see the landing page. This is rendered by <font face='Courier' size='9'>app/page.tsx</font> which just imports <font face='Courier' size='9'>components/landing/LandingPage.tsx</font> \u2014 a single 376-line file that contains the entire landing experience."),

        sub("2a. The Ambient Background (Mouse-Tracking Orbs)"),
        body("Behind everything, there are two large blurred circles that float around:"),
        bullet("A <b>green orb</b> (600px wide, rgba(0,212,170,0.12)) that tracks your mouse position with a 2-second eased delay."),
        bullet("A <b>blue orb</b> (400px, rgba(59,130,246,0.08)) that floats on its own using the <font face='Courier' size='9'>orbFloat</font> CSS keyframe animation."),
        bullet("A <b>dot grid</b> overlay \u2014 using CSS <font face='Courier' size='9'>backgroundImage</font> with two linear gradients at 60px intervals creating a subtle graph paper effect."),
        body("<b>Built with:</b> Pure CSS + React state. The mouse position is tracked via <font face='Courier' size='9'>window.addEventListener('mousemove')</font>, stored in <font face='Courier' size='9'>useState</font>, and applied as inline <font face='Courier' size='9'>top</font>/<font face='Courier' size='9'>left</font> CSS with <font face='Courier' size='9'>transition: top 2s ease, left 2s ease</font> for the smooth lag effect."),

        sub("2b. The Navigation Bar (Scroll-Aware)"),
        body("The nav bar is <b>fixed</b> at the top. It starts fully transparent and becomes a frosted glass panel when you scroll past 50px:"),
        bullet("<b>Transparency to glass:</b> Controlled by <font face='Courier' size='9'>scrollY</font> state from a scroll event listener. When scrollY &gt; 50, it applies <font face='Courier' size='9'>rgba(11,14,20,0.85)</font> background + <font face='Courier' size='9'>backdrop-filter: blur(20px) saturate(1.2)</font>."),
        bullet("<b>Logo:</b> The Scope Alpha logo is rendered with Next.js <font face='Courier' size='9'>&lt;Image&gt;</font> component (automatic optimization, lazy loading)."),
        bullet("<b>'Launch Terminal' button:</b> Uses our custom <font face='Courier' size='9'>NeuButton</font> component with <font face='Courier' size='9'>primary</font> prop. Clicking it calls <font face='Courier' size='9'>router.push('/terminal')</font> (Next.js client-side navigation)."),
        body("<b>Built with:</b> Next.js <font face='Courier' size='9'>useRouter</font> for navigation, React <font face='Courier' size='9'>useState</font>/<font face='Courier' size='9'>useEffect</font> for scroll tracking, CSS <font face='Courier' size='9'>backdrop-filter</font> for the glassmorphism effect."),

        sub("2c. The Hero Section"),
        body("The big headline area with staggered fade-in animations:"),
        bullet("<b>'DERIVATIVES INTELLIGENCE' pill:</b> A green-bordered pill with a pulsing green dot (CSS <font face='Courier' size='9'>pulse</font> animation)."),
        bullet("<b>'See Through The Market Noise' heading:</b> Uses the <font face='Courier' size='9'>Outfit</font> font at <font face='Courier' size='9'>clamp(40px, 7vw, 82px)</font> \u2014 this is CSS <font face='Courier' size='9'>clamp()</font> for responsive font sizing without media queries."),
        bullet("<b>'Noise' shimmer effect:</b> The word 'Noise' has a <font face='Courier' size='9'>shimmer-text</font> CSS class that applies a moving gradient (<font face='Courier' size='9'>background: linear-gradient(90deg, #E2E8F0, #00D4AA, #3B82F6, #00D4AA, #E2E8F0)</font>) with <font face='Courier' size='9'>background-clip: text</font> and <font face='Courier' size='9'>animation: textShimmer 6s linear infinite</font>."),
        bullet("<b>Staggered animation:</b> Each element uses <font face='Courier' size='9'>animation: fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) Xs both</font> where X increases (0.2s, 0.4s, 0.6s, 0.8s, 1s) for a waterfall effect."),
        body("<b>Built with:</b> CSS keyframe animations, CSS <font face='Courier' size='9'>clamp()</font> for responsive sizing, <font face='Courier' size='9'>-webkit-background-clip: text</font> for the gradient text effect."),
    ]))
    story.append(PageBreak())

    story.extend(section("2. The Landing Page (continued)", [
        sub("2d. The Floating Dashboard Mockup"),
        body("This is the hero image \u2014 a fake terminal screenshot that floats and rotates in 3D:"),
        bullet("<b>3D perspective:</b> The parent div has <font face='Courier' size='9'>perspective: 1200px</font>. The inner div uses the <font face='Courier' size='9'>float</font> CSS animation: <font face='Courier' size='9'>translateY(0px) rotateX(8deg) rotateY(-4deg)</font> oscillating to <font face='Courier' size='9'>translateY(-16px) rotateX(6deg) rotateY(-2deg)</font> over 8 seconds."),
        bullet("<b>Glow shadow:</b> <font face='Courier' size='9'>box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 120px rgba(0,212,170,0.06)</font> \u2014 a deep shadow plus a subtle green ambient glow."),
        bullet("<b>macOS title bar dots:</b> Three small circles (#FF5F57 red, #FEBC2E yellow, #28C840 green) to mimic a macOS window."),
        bullet("<b>Animated bar chart:</b> 20 bars with staggered <font face='Courier' size='9'>barGrow</font> animation (scaleY from 0 to 1), each delayed by <font face='Courier' size='9'>i * 0.04s</font> for a cascade effect. Bars alternate between green (bullish) and red (bearish) gradients."),
        bullet("<b>SVG funding overlay:</b> An inline SVG with a curved <font face='Courier' size='9'>&lt;path&gt;</font> using quadratic Bezier curves and a gradient stroke."),
        body("<b>Built with:</b> The entire mockup is a React component (<font face='Courier' size='9'>DashboardMockup</font>) \u2014 no images, no screenshots. It's JSX rendering divs with inline styles, plus one inline SVG. The animation is pure CSS."),

        sub("2e. Stats Counter Bar"),
        body("The '20+ Assets / &lt;500ms Latency / 14 Data Sources / 99% Uptime' section:"),
        bullet("<b>Counting animation:</b> A custom <font face='Courier' size='9'>Counter</font> component that uses <font face='Courier' size='9'>setInterval</font> at 16ms (~60fps) to increment from 0 to the target number over 2 seconds."),
        bullet("<b>Trigger on scroll:</b> Uses a custom <font face='Courier' size='9'>useInView</font> hook built with the <b>Intersection Observer API</b>. The counter only starts when the element scrolls into view."),
        bullet("<b>Gradient text:</b> The numbers use <font face='Courier' size='9'>background: linear-gradient(135deg, #00D4AA, #3B82F6)</font> with <font face='Courier' size='9'>-webkit-background-clip: text</font>."),

        sub("2f. Features Grid"),
        body("Six cards showing the core modules. Each card:"),
        bullet("Uses our <b>NeuCard</b> component with <font face='Courier' size='9'>glow</font> prop (adds green glow on hover)."),
        bullet("Has an icon in a gradient-bordered container with a subtle box-shadow glow matching the feature color."),
        bullet("Fades in on scroll using the <b>Reveal</b> component (Intersection Observer + CSS opacity/transform transition with staggered delays)."),

        sub("2g. Tech Strip + CTA + Footer"),
        bullet("<b>Tech pills:</b> ['Next.js', 'FastAPI', 'TimescaleDB', 'Redis', 'Binance WS', 'CoinGlass', 'WebSocket', 'Python'] rendered as neumorphic-styled pills. Each fades in on scroll."),
        bullet("<b>CTA card:</b> A large neumorphic card with a radial green glow behind the heading. 'Launch Scope Alpha' button navigates to /terminal."),
        bullet("<b>Footer:</b> Logo + tagline, very minimal."),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  3. TERMINAL SHELL
    # ══════════════════════════════════════════════════════════════
    story.extend(section("3. The Terminal Shell", [
        body("When you click 'Launch Terminal', Next.js navigates to <font face='Courier' size='9'>/terminal</font>. This route has its own <b>layout</b> (<font face='Courier' size='9'>app/terminal/layout.tsx</font>) that wraps all 6 terminal pages with a persistent sidebar and top bar."),

        sub("3a. Sidebar (components/layout/Sidebar.tsx)"),
        bullet("<b>Navigation:</b> 6 items \u2014 Dashboard (\u2318), Funding (\u26a1), Open Interest (\u25ce), Liquidations, Basis (\u25c8), Screener (\u229e). Each is a button that calls <font face='Courier' size='9'>router.push(path)</font>."),
        bullet("<b>Active state:</b> Detected by comparing <font face='Courier' size='9'>usePathname()</font> to the item's path. Active items get a green left border + green tinted background."),
        bullet("<b>Collapsible:</b> The sidebar width toggles between 220px and 56px. State is in Zustand (<font face='Courier' size='9'>sidebarCollapsed</font>) so it persists across refreshes."),
        bullet("<b>Logo:</b> Next.js <font face='Courier' size='9'>&lt;Image&gt;</font> component loading <font face='Courier' size='9'>/logo.png</font> from the public folder."),
        bullet("<b>Background:</b> CSS gradient: <font face='Courier' size='9'>linear-gradient(180deg, #0F1219 0%, #0B0E14 100%)</font>."),

        sub("3b. TopBar (components/layout/TopBar.tsx)"),
        bullet("<b>Asset selector:</b> Shows the currently selected asset (e.g. 'BTC / USDT') from Zustand state. Has a dropdown arrow indicator (non-functional in prototype)."),
        bullet("<b>Timeframe pills:</b> Seven buttons (1m, 5m, 15m, 1H, 4H, 1D, 1W). Active pill has green tint + inset shadow (neumorphic pressed state). Inactive pills have raised shadow."),
        bullet("<b>Connection status:</b> A pulsing green dot with 'Live' label. This is fake \u2014 <font face='Courier' size='9'>connectionStatus</font> is hardcoded to 'connected' in the Zustand store."),
        bullet("<b>Settings gear:</b> An inline SVG icon (no functionality, just visual)."),
        bullet("<b>Glass effect:</b> <font face='Courier' size='9'>background: rgba(15,18,25,0.8)</font> + <font face='Courier' size='9'>backdrop-filter: blur(12px)</font>."),

        sub("3c. Keyboard Shortcuts (components/terminal/KeyboardShortcuts.tsx)"),
        bullet("Press <b>?</b> to show a modal overlay listing all shortcuts."),
        bullet("Press <b>1-6</b> to navigate directly to any page."),
        bullet("Uses <font face='Courier' size='9'>window.addEventListener('keydown')</font> with <font face='Courier' size='9'>useCallback</font> to avoid stale closures."),
        bullet("The overlay is a <font face='Courier' size='9'>fixed inset-0</font> div with <font face='Courier' size='9'>bg-black/60 backdrop-blur-sm</font> backdrop."),
        bullet("Ignores keypresses when focus is in an input or textarea."),

        sub("3d. ErrorBoundary (components/ui/ErrorBoundary.tsx)"),
        body("Wraps the main content area. If any page throws a render error, it catches it and shows a recovery UI instead of crashing the whole terminal."),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  4. DASHBOARD
    # ══════════════════════════════════════════════════════════════
    story.extend(section("4. Dashboard Page", [
        body("File: <font face='Courier' size='9'>app/terminal/page.tsx</font> (85 lines). This is the default view when you enter the terminal."),

        sub("4a. Stats Bar (Top Row)"),
        body("Four <font face='Courier' size='9'>DataCell</font> components showing: Health Score, Funding Rate, Open Interest, Basis (Annualized)."),
        bullet("Data comes from calling <font face='Courier' size='9'>generateFundingData(selectedAsset)</font>, <font face='Courier' size='9'>generateOIData(selectedAsset)</font>, <font face='Courier' size='9'>generateHealthScore(selectedAsset)</font>."),
        bullet("All wrapped in <font face='Courier' size='9'>useMemo</font> keyed on <font face='Courier' size='9'>selectedAsset</font>, so they only recalculate when you switch assets."),

        sub("4b. Candlestick Chart"),
        body("The big chart is powered by <b>TradingView Lightweight Charts</b> \u2014 this is the only external charting library in the entire app."),
        bullet("<b>Component:</b> <font face='Courier' size='9'>components/charts/PriceChart.tsx</font> (138 lines)."),
        bullet("<b>How it works:</b> On mount, it calls <font face='Courier' size='9'>createChart()</font> from the <font face='Courier' size='9'>lightweight-charts</font> npm package, attaches it to a div ref, and creates two series: a <b>CandlestickSeries</b> (price) and a <b>HistogramSeries</b> (volume)."),
        bullet("<b>Colors:</b> Green (#10B981) for bullish candles, Red (#EF4444) for bearish. Volume bars are 30% opacity versions of the same colors."),
        bullet("<b>Styling:</b> Grid lines at rgba(255,255,255,0.03), crosshair at 0.15 opacity, JetBrains Mono font for axis labels."),
        bullet("<b>Data:</b> Generated by <font face='Courier' size='9'>generateCandles(basePrice, count)</font> from <font face='Courier' size='9'>mockData.ts</font>. Returns OHLCV objects with realistic price action (drift + volatility model)."),
        bullet("<b>Resize handling:</b> A <font face='Courier' size='9'>window.addEventListener('resize')</font> that calls <font face='Courier' size='9'>chart.applyOptions()</font> with new dimensions."),

        sub("4c. Watchlist (Right Panel)"),
        body("Component: <font face='Courier' size='9'>components/terminal/Watchlist.tsx</font> (85 lines)."),
        bullet("Shows all 20 tracked instruments with rank, price, 24h change, and volume."),
        bullet("<b>Sortable:</b> Click column headers to sort by rank, price, change, or volume."),
        bullet("<b>Interactive:</b> Click any row to change <font face='Courier' size='9'>selectedAsset</font> in Zustand \u2014 the entire terminal updates reactively."),
        bullet("Selected row gets a green left border + green background tint."),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  5. EVERY TERMINAL PAGE
    # ══════════════════════════════════════════════════════════════
    story.extend(section("5. Every Terminal Page", [
        body("Each page follows the same pattern: import data generators, call them with <font face='Courier' size='9'>selectedAsset</font> in <font face='Courier' size='9'>useMemo</font>, render with inline SVG charts + DataCells + tables."),

        sub("5a. Open Interest (app/terminal/oi/page.tsx)"),
        bullet("<b>Big OI card:</b> Shows aggregate OI with 1h/4h/24h change indicators."),
        bullet("<b>OI/Market Cap ratio:</b> Calculated inline as a leverage proxy."),
        bullet("<b>Momentum:</b> Compares average of last 24 hourly values vs previous 24."),
        bullet("<b>OI vs Price Correlation:</b> Deterministic estimate using a seed derived from OI and price changes."),
        bullet("<b>7-day area chart:</b> Inline SVG (<font face='Courier' size='9'>MiniChart</font> component) \u2014 168 data points, gradient fill, polyline stroke."),
        bullet("<b>Exchange breakdown bar:</b> A horizontal stacked bar showing Binance (gold), OKX (white), Bybit (amber) proportions."),
        bullet("<b>OI Leaderboard:</b> Table ranking all 20 instruments by OI size."),

        sub("5b. Funding Rates (app/terminal/funding/page.tsx)"),
        bullet("20-instrument funding rate table with z-score badges."),
        bullet("Selected asset detail panel with SVG line chart of 90 funding rate data points."),
        bullet("Exchange breakdown with horizontal bar comparison."),

        sub("5c. Liquidations (app/terminal/liquidations/page.tsx)"),
        bullet("Scrolling liquidation event ticker."),
        bullet("Long vs Short stacked bar with gradient fills."),
        bullet("24-bar hourly liquidation volume chart (SVG stacked bars)."),
        bullet("Top 10 largest liquidations table."),

        sub("5d. Basis Monitor (app/terminal/basis/page.tsx)"),
        bullet("Large basis display with contango/backwardation signal."),
        bullet("30-day area chart (180 data points at 4h intervals)."),
        bullet("<b>Dual-line overlay:</b> A <font face='Courier' size='9'>DualLineChart</font> component that normalizes two datasets to [0,1] and overlays them \u2014 basis (solid) vs funding rate (dashed)."),
        bullet("Exchange basis comparison with progress bars."),
        bullet("Basis leaderboard across all instruments."),

        sub("5e. Screener (app/terminal/screener/page.tsx)"),
        bullet("Full-width sortable table with 11 columns + sparkline mini-charts."),
        bullet("Click any header to sort. Active sort column highlighted in green."),
        bullet("Health score cells have dynamically calculated background opacity based on score."),
        bullet("Regime badges use <font face='Courier' size='9'>getRegimeColor()</font> to map 'Risk Off'/'Cautious'/'Neutral'/'Risk On'/'Overheated' to color schemes."),
        bullet("Click any row to select that asset globally."),

        Spacer(1, 6),
        callout("<b>Key technical point:</b> Every chart on every page is an <b>inline SVG</b> \u2014 there's no D3, no Recharts, no Chart.js. Each chart is a React component that calculates SVG coordinates from data arrays and renders &lt;polyline&gt;, &lt;polygon&gt;, &lt;rect&gt;, etc. This means <b>zero additional bundle size</b> for charts."),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  6. DESIGN SYSTEM
    # ══════════════════════════════════════════════════════════════
    story.extend(section("6. The Design System", [
        sub("6a. NeuCard (components/ui/NeuCard.tsx)"),
        body("The primary container component used everywhere. 40 lines of code."),
        bullet("<b>Background:</b> <font face='Courier' size='9'>linear-gradient(145deg, rgba(18,22,32,0.6), rgba(13,16,26,0.6))</font> \u2014 a subtle diagonal gradient."),
        bullet("<b>Glassmorphism:</b> <font face='Courier' size='9'>backdrop-filter: blur(20px)</font>."),
        bullet("<b>Neumorphic shadows:</b> Raised state = <font face='Courier' size='9'>6px 6px 20px rgba(0,0,0,0.4), -3px -3px 10px rgba(255,255,255,0.02)</font>. Two shadows, one dark (bottom-right) and one light (top-left), creating the 3D emboss effect."),
        bullet("<b>Hover state:</b> Border changes from white/5% to green/20%, shadow deepens, optional green glow."),
        bullet("<b>Props:</b> <font face='Courier' size='9'>glow</font> (adds green ambient glow), <font face='Courier' size='9'>noPadding</font> (for tables that need edge-to-edge content), <font face='Courier' size='9'>onClick</font> (adds pointer cursor + lift on hover)."),

        sub("6b. NeuButton (components/ui/NeuButton.tsx)"),
        body("Neumorphic button with press animation. 51 lines."),
        bullet("<b>Primary variant:</b> Green gradient background, dark text, green glow shadow."),
        bullet("<b>Default variant:</b> Dark gradient background, light text, subtle shadow."),
        bullet("<b>Press effect:</b> On mouseDown, shadow changes from raised to <font face='Courier' size='9'>inset</font> and scale drops to 0.97. This creates the physical 'pushed in' neumorphic feel."),

        sub("6c. DataCell (components/ui/DataCell.tsx)"),
        body("Standardized metric display. Used for every stat box across all pages."),
        bullet("Shows: label (10px mono uppercase), value (18px bold mono, colored), optional change indicator, optional subtitle."),
        bullet("Background: <font face='Courier' size='9'>bg-white/[0.02]</font> with <font face='Courier' size='9'>border border-white/[0.04]</font>."),

        sub("6d. Badge (components/ui/Badge.tsx)"),
        body("Colored pill labels. 6 variants: green, red, yellow, blue, purple, gray."),
        bullet("Each variant maps to a Tailwind class string like <font face='Courier' size='9'>bg-emerald-500/15 text-emerald-400 border-emerald-500/20</font>."),
        bullet("10px monospace font, semibold, rounded corners."),

        sub("6e. Color Palette"),
        Spacer(1, 4),
        ColorSwatch("#0B0E14", "Background (base) - used on body and root"),
        ColorSwatch("#0F1219", "Surface - sidebar, elevated panels"),
        ColorSwatch("#131620", "Elevated - card interiors, table headers"),
        ColorSwatch("#00D4AA", "Accent Green - primary actions, positive values, nav active"),
        ColorSwatch("#8B5CF6", "Accent Purple - basis data, secondary accent"),
        ColorSwatch("#3B82F6", "Accent Blue - OI data, informational"),
        ColorSwatch("#F59E0B", "Accent Yellow - warnings, selected asset dot"),
        ColorSwatch("#EF4444", "Negative - bearish, liquidations, errors"),
        ColorSwatch("#10B981", "Positive - bullish candles, positive changes"),
        ColorSwatch("#EC4899", "Accent Pink - health score, special highlights"),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  7. DATA LAYER
    # ══════════════════════════════════════════════════════════════
    story.extend(section("7. The Data Layer", [
        body("File: <font face='Courier' size='9'>lib/mockData.ts</font> (359 lines). This is the heart of the data pipeline."),

        sub("7a. Seeded PRNG (mulberry32)"),
        body("Instead of <font face='Courier' size='9'>Math.random()</font>, we use a <b>seeded pseudo-random number generator</b> called mulberry32. This is a well-known 32-bit hash-based PRNG."),
        code(
            "function mulberry32(seed: number) {\n"
            "  let s = seed | 0;\n"
            "  return (): number =&gt; {\n"
            "    s = (s + 0x6d2b79f5) | 0;\n"
            "    let t = Math.imul(s ^ (s &gt;&gt;&gt; 15), 1 | s);\n"
            "    t = (t + Math.imul(t ^ (t &gt;&gt;&gt; 7), 61 | t)) ^ t;\n"
            "    return ((t ^ (t &gt;&gt;&gt; 14)) &gt;&gt;&gt; 0) / 4294967296;\n"
            "  };\n"
            "}"
        ),
        bullet("<b>Seed derivation:</b> Each asset symbol (e.g. 'BTC') is hashed to a number using <font face='Courier' size='9'>Math.imul(31, h) + charCode</font>. Then different data types append a suffix (e.g. 'BTCfunding', 'BTCoi') for unique seeds per data type."),
        bullet("<b>Why?</b> Server-side rendering and client-side rendering must produce identical output. <font face='Courier' size='9'>Math.random()</font> gives different values each call, causing React hydration mismatches. Seeded PRNG gives the same sequence every time for the same seed."),

        sub("7b. The 20 Instruments"),
        body("Hardcoded in <font face='Courier' size='9'>INSTRUMENT_DEFS</font>: BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOGE, DOT, LINK, MATIC, UNI, ATOM, LTC, NEAR, APT, ARB, OP, FIL, INJ. Each has a realistic base price, market cap, and 24h volume."),

        sub("7c. Mock Generators"),
        body("Each generator takes a symbol string and returns structured data:"),
        bullet("<b>generateCandles(basePrice, count)</b> \u2014 Simulates OHLCV candles with drift + volatility model. Uses a fixed base timestamp (2025-03-17T00:00:00Z) to avoid server/client time differences."),
        bullet("<b>generateFundingData(symbol)</b> \u2014 Current rate, 8h avg, z-score, annualized carry, 90-point history (30 days at 8h intervals), per-exchange breakdown."),
        bullet("<b>generateOIData(symbol)</b> \u2014 Aggregate OI (1-5% of market cap), 1h/4h/24h changes, 168-point history (7 days hourly), per-exchange split."),
        bullet("<b>generateLiquidationData(symbol)</b> \u2014 50 liquidation events with random sides/amounts/exchanges, 24-bar hourly volume history."),
        bullet("<b>generateBasisData(symbol)</b> \u2014 Current basis, annualized, 180-point history (30 days at 4h), per-exchange comparison."),
        bullet("<b>generateHealthScore(symbol)</b> \u2014 Composite score from funding (30%), OI (25%), liquidation (25%), basis (20%) components. Maps to regime labels."),
        bullet("<b>generateScreenerData()</b> \u2014 Calls all the above for every instrument and combines into a flat row for the screener table."),

        Spacer(1, 6),
        callout("<b>If someone asks 'can you swap in real data?':</b> Yes. Each generator returns TypeScript interfaces (FundingData, OpenInterestData, etc.) that match what real exchange APIs return. You'd replace the generator function with an API call and the UI components wouldn't change at all."),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  8. STATE MANAGEMENT + HYDRATION
    # ══════════════════════════════════════════════════════════════
    story.extend(section("8. State Management &amp; Hydration", [
        sub("8a. Zustand Store (lib/store.ts)"),
        body("The entire app has one global store with 4 pieces of state:"),
        code(
            "selectedAsset: string      // e.g. 'BTC'\n"
            "selectedTimeframe: TimeFrame // e.g. '1D'\n"
            "sidebarCollapsed: boolean\n"
            "connectionStatus: 'connected' | 'connecting' | 'disconnected'"
        ),
        bullet("<b>Zustand</b> is a tiny state library (1.2KB). You call <font face='Courier' size='9'>create()</font> with a function that returns your state + actions. Components use <font face='Courier' size='9'>useAppStore()</font> hook to read/write."),
        bullet("<b>Persist middleware:</b> Wraps the store so state is automatically saved to <font face='Courier' size='9'>localStorage</font> under the key <font face='Courier' size='9'>scope-alpha-state</font>. This means if you select ETH, close the browser, and come back, ETH is still selected."),

        sub("8b. The Hydration Problem"),
        body("This was the biggest technical challenge in the project:"),
        bullet("1. Server renders the page with <b>default state</b> (selectedAsset = 'BTC')."),
        bullet("2. HTML arrives at the browser. React 'hydrates' it \u2014 attaches event listeners to the existing HTML."),
        bullet("3. Zustand's persist middleware loads saved state from localStorage (selectedAsset = 'ETH')."),
        bullet("4. React sees that the server HTML says 'BTC' but the client wants 'ETH'. <b>Hydration mismatch error.</b>"),

        sub("8c. The Solution: useHydrated() Hook"),
        code(
            "export function useHydrated() {\n"
            "  const [hydrated, setHydrated] = useState(false);\n"
            "  useEffect(() =&gt; setHydrated(true), []);\n"
            "  return hydrated;\n"
            "}"
        ),
        body("Every page that reads persisted state checks <font face='Courier' size='9'>if (!hydrated)</font> and shows a loading spinner. After <font face='Courier' size='9'>useEffect</font> fires (confirming hydration is complete), the real content renders with the correct persisted state."),
        body("<font face='Courier' size='9'>useEffect</font> never runs on the server, and it runs after the first client render. So the first render on both server and client shows the spinner (matching). Then the effect fires, hydrated becomes true, and the real content appears with the correct state."),

        Spacer(1, 6),
        callout("<b>If someone asks 'why not just disable SSR?':</b> We could use Next.js <font face='Courier' size='9'>dynamic(() =&gt; import(...), {ssr: false})</font>, but that gives us no server HTML at all \u2014 worse for initial load and SEO. The useHydrated approach gives us server-rendered layout structure while deferring only the data-dependent content."),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  9. FONTS, CSS, TAILWIND
    # ══════════════════════════════════════════════════════════════
    story.extend(section("9. Fonts, CSS, Tailwind", [
        sub("9a. Three Fonts"),
        bullet("<b>Outfit</b> (display font) \u2014 Used for headings, titles, branding. Loaded via Next.js <font face='Courier' size='9'>next/font/google</font> with <font face='Courier' size='9'>--font-display</font> CSS variable."),
        bullet("<b>Satoshi</b> (body font) \u2014 Used for body text. Loaded via Fontshare CDN link in <font face='Courier' size='9'>&lt;head&gt;</font>."),
        bullet("<b>JetBrains Mono</b> (monospace) \u2014 Used for all data, numbers, tables, code-like content. Loaded via <font face='Courier' size='9'>next/font/google</font> with <font face='Courier' size='9'>--font-mono</font> CSS variable."),

        sub("9b. globals.css (211 lines)"),
        body("Contains:"),
        bullet("<b>CSS custom properties (variables):</b> All colors, shadows, radii defined as <font face='Courier' size='9'>--bg-primary</font>, <font face='Courier' size='9'>--accent-green</font>, etc."),
        bullet("<b>13 keyframe animations:</b> heroGlow, float, barGrow, pulse, pulseRed, fadeInUp, textShimmer, orbFloat, gradientShift, scanline, slideInLeft, flashGreen/Red, shimmer, spin, ticker."),
        bullet("<b>Utility classes:</b> <font face='Courier' size='9'>.shimmer-text</font>, <font face='Courier' size='9'>.skeleton</font>, <font face='Courier' size='9'>.glass-panel</font>, <font face='Courier' size='9'>.neu-raised</font>, <font face='Courier' size='9'>.neu-pressed</font>, <font face='Courier' size='9'>.glow-green</font>, <font face='Courier' size='9'>.flash-green</font>, <font face='Courier' size='9'>.flash-red</font>, <font face='Courier' size='9'>.nav-active</font>."),
        bullet("<b>Custom scrollbar:</b> 6px wide, transparent track, white/8% thumb."),

        sub("9c. tailwind.config.ts"),
        body("Extends the default Tailwind theme with:"),
        bullet("15 custom color tokens (all the greens, blues, purples, etc.)"),
        bullet("3 font family stacks (display, body, mono)"),
        bullet("4 custom border-radius values (8/12/16/20px)"),
        bullet("4 custom box-shadow presets (raised, pressed, glow-green, card-hover)"),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  10. FULL TECH STACK
    # ══════════════════════════════════════════════════════════════
    story.extend(section("10. Full Tech Stack Summary", []))

    stack = [
        ["What", "Technology", "Where It's Used"],
        ["Framework", "Next.js 14 (App Router)", "File-based routing, server rendering, layout nesting"],
        ["Language", "TypeScript (strict)", "Every file \u2014 30+ type interfaces in types.ts"],
        ["Styling", "Tailwind CSS v3", "All components, custom design tokens in config"],
        ["CSS Animations", "Pure CSS @keyframes", "13 animations in globals.css \u2014 no Framer Motion"],
        ["State", "Zustand + persist", "store.ts \u2014 global asset/timeframe/sidebar state"],
        ["Candlestick Charts", "TradingView Lightweight", "PriceChart.tsx \u2014 only external chart lib"],
        ["All Other Charts", "Inline SVG (custom)", "Sparklines, area, bars, heatmaps \u2014 zero bundle cost"],
        ["Font Loading", "next/font/google + CDN", "Outfit, JetBrains Mono via Next.js; Satoshi via CDN"],
        ["Image Optimization", "next/image", "Logo in sidebar and landing page"],
        ["Navigation", "next/navigation", "useRouter, usePathname for client-side routing"],
        ["Scroll Animations", "Intersection Observer", "Custom useInView hook for scroll-triggered reveals"],
        ["Data Generation", "Seeded PRNG (mulberry32)", "mockData.ts \u2014 deterministic fake data"],
        ["Hydration Guard", "Custom useHydrated hook", "All 6 terminal pages"],
    ]
    st = Table(stack, colWidths=[1.2*inch, 1.8*inch, 3.0*inch])
    st.setStyle(TableStyle([
        ("FONT", (0,0), (-1,0), "Helvetica-Bold", 8.5),
        ("FONT", (0,1), (-1,-1), "Helvetica", 8.5),
        ("TEXTCOLOR", (0,0), (-1,0), white),
        ("BACKGROUND", (0,0), (-1,0), HEADING_DARK),
        ("TEXTCOLOR", (0,1), (-1,-1), BODY_TEXT),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LINEBELOW", (0,1), (-1,-2), 0.3, BORDER_GRAY),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, SECTION_BG]),
    ]))
    story.append(st)
    story.append(Spacer(1, 8))
    story.append(callout("<b>Important:</b> There is NO Framer Motion, no D3, no Chart.js, no Recharts, no Emotion, no styled-components. Animations are pure CSS keyframes. Charts are inline SVG. Styling is Tailwind utility classes + inline styles."))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  11. IS THERE A LIVE API?
    # ══════════════════════════════════════════════════════════════
    story.extend(section("11. Is There a Live API?", [
        bold_body("No. There is no live API, no backend, no database, and no WebSocket connection."),
        Spacer(1, 4),
        body("Everything you see on screen is generated client-side by the seeded PRNG in <font face='Courier' size='9'>mockData.ts</font>. The 'Live' connection indicator is fake \u2014 it's hardcoded to 'connected' in the Zustand store."),
        body("The landing page lists technologies like 'FastAPI', 'TimescaleDB', 'Redis', and 'Binance WS' in the tech strip \u2014 these are <b>planned</b> technologies for the backend, not currently implemented."),

        sub("What would the backend look like?"),
        bullet("<b>Data ingestion:</b> WebSocket connections to Binance, Bybit, OKX for real-time market data."),
        bullet("<b>API server:</b> FastAPI (Python) serving REST endpoints and relaying WebSocket streams."),
        bullet("<b>Storage:</b> PostgreSQL + TimescaleDB for time-series historical data."),
        bullet("<b>Cache:</b> Redis for hot data (current rates, latest OI)."),
        bullet("<b>Compute:</b> Background workers for z-scores, regime classification, health scores."),

        sub("How hard is the swap?"),
        body("The mock data generators return TypeScript interfaces (<font face='Courier' size='9'>FundingData</font>, <font face='Courier' size='9'>OpenInterestData</font>, etc.) that exactly match what real exchange APIs return. To go live, you'd replace each <font face='Courier' size='9'>generate*()</font> call with a React Query hook fetching from the real API. The UI components wouldn't change at all \u2014 they just consume the typed data."),
    ]))

    # ══════════════════════════════════════════════════════════════
    #  12. Q&A CHEAT SHEET
    # ══════════════════════════════════════════════════════════════
    story.extend(section("12. Likely Questions &amp; Answers", []))
    qa_items = [
        ("What framework is this built on?",
         "Next.js 14 with the App Router. It's React under the hood, but Next.js gives us file-based routing, server-side rendering, automatic code splitting, and optimized font/image loading."),
        ("What's the chart library?",
         "TradingView Lightweight Charts for the candlestick chart on the dashboard. Every other chart (area charts, bar charts, sparklines, heatmaps) is hand-built with inline SVG \u2014 no library at all."),
        ("How do the animations work? Is that Framer Motion?",
         "No external animation library. All animations are pure CSS @keyframes defined in globals.css. The landing page uses 8 different keyframe animations (fadeInUp, float, barGrow, textShimmer, orbFloat, heroGlow, pulse, ticker). Scroll-triggered animations use the browser's Intersection Observer API via a custom useInView() hook."),
        ("How does the floating dashboard work?",
         "It's a React component called DashboardMockup that renders divs and one inline SVG. The float effect is a CSS animation: translateY(0) rotateX(8deg) oscillating to translateY(-16px) rotateX(6deg) over 8 seconds. The parent has perspective: 1200px for the 3D effect."),
        ("Is the data real?",
         "No. All data is generated by a seeded PRNG (mulberry32 algorithm). The seed is derived from each asset's symbol, so the same asset always produces the same data. This was a deliberate choice to avoid hydration mismatches between server and client rendering."),
        ("What's hydration?",
         "In Next.js, the server renders HTML first, then the browser 'hydrates' it by attaching React event listeners. If the server and client produce different HTML, React throws errors. We use a useHydrated() hook to defer data-dependent rendering until after hydration completes."),
        ("What state management are you using?",
         "Zustand with the persist middleware. It's a 1.2KB library that gives us a global store with automatic localStorage sync. When you select an asset, it persists across page refreshes."),
        ("What about the styling? Is that a CSS framework?",
         "Tailwind CSS v3 with a custom configuration. We defined 15 custom colors, 3 font families, custom shadows, and border radii. The neumorphic effects (raised/pressed shadows) are a combination of Tailwind classes and inline styles."),
        ("Can this handle real-time data?",
         "The frontend architecture supports it. The mock data layer returns TypeScript interfaces that match real exchange API shapes. You'd swap the generator functions for WebSocket-fed React Query hooks. The UI components wouldn't need to change."),
        ("How many lines of code is this?",
         "Roughly 3,500 lines of TypeScript/TSX across 34 source files. The largest file is mockData.ts at 359 lines."),
        ("Why not use Redux?",
         "Zustand is simpler for our use case. We have 4 pieces of global state. Redux would add boilerplate (actions, reducers, selectors, provider) for no benefit. Zustand's persist middleware also handles localStorage automatically."),
        ("Why inline SVG instead of a chart library?",
         "Zero bundle size. A chart library like Recharts adds ~50KB. Our SVG charts are part of the component JSX \u2014 they add nothing to the bundle. Plus we get pixel-perfect control over every visual detail to match the neumorphic design language."),
    ]
    for q, a in qa_items:
        story.extend(qa(q, a))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  13. FILE MAP
    # ══════════════════════════════════════════════════════════════
    story.extend(section("13. File Map \u2014 Every File and What It Does", [
        sub("App Routes"),
        file_line("app/layout.tsx            Root layout: loads fonts, global CSS, sets metadata"),
        file_line("app/page.tsx              Entry point: renders LandingPage component"),
        file_line("app/globals.css           CSS variables, 13 keyframe animations, utility classes"),
        file_line("app/terminal/layout.tsx   Terminal shell: Sidebar + TopBar + ErrorBoundary"),
        file_line("app/terminal/page.tsx     Dashboard: candlestick chart + watchlist + stats"),
        file_line("app/terminal/oi/page.tsx  Open Interest: area chart + exchange bar + leaderboard"),
        file_line("app/terminal/funding/     Funding rates: table + history chart + exchange breakdown"),
        file_line("app/terminal/liquidations Liquidations: ticker + stacked bars + event table"),
        file_line("app/terminal/basis/       Basis monitor: area chart + dual-line + leaderboard"),
        file_line("app/terminal/screener/    Screener: full sortable table + sparklines"),
        Spacer(1, 6),
        sub("Components"),
        file_line("components/landing/LandingPage.tsx     376 lines \u2014 entire landing experience"),
        file_line("components/charts/PriceChart.tsx       138 lines \u2014 TradingView wrapper"),
        file_line("components/layout/Sidebar.tsx           81 lines \u2014 collapsible nav sidebar"),
        file_line("components/layout/TopBar.tsx            87 lines \u2014 asset selector + timeframes"),
        file_line("components/terminal/Watchlist.tsx        85 lines \u2014 sortable asset table"),
        file_line("components/terminal/KeyboardShortcuts    87 lines \u2014 ? overlay + 1-6 nav"),
        file_line("components/ui/NeuCard.tsx               40 lines \u2014 neumorphic container"),
        file_line("components/ui/NeuButton.tsx             51 lines \u2014 neumorphic button"),
        file_line("components/ui/DataCell.tsx              29 lines \u2014 metric display cell"),
        file_line("components/ui/Badge.tsx                 29 lines \u2014 colored pill label"),
        file_line("components/ui/ErrorBoundary.tsx          \u2014 render error catcher"),
        file_line("components/ui/Skeleton.tsx               \u2014 loading placeholder"),
        Spacer(1, 6),
        sub("Library"),
        file_line("lib/store.ts             30 lines \u2014 Zustand store + persist config"),
        file_line("lib/types.ts            108 lines \u2014 all TypeScript interfaces"),
        file_line("lib/utils.ts             53 lines \u2014 formatPrice, formatPercent, cn(), colors"),
        file_line("lib/mockData.ts         359 lines \u2014 seeded PRNG + all data generators"),
        file_line("lib/useHydrated.ts        8 lines \u2014 hydration guard hook"),
        Spacer(1, 6),
        sub("Config"),
        file_line("tailwind.config.ts       54 lines \u2014 custom colors, fonts, shadows"),
        file_line("next.config.js                   \u2014 Next.js configuration"),
        file_line("tsconfig.json                    \u2014 TypeScript strict mode"),
        file_line("package.json                     \u2014 dependencies + scripts"),
    ]))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    #  14. HOW TO RUN
    # ══════════════════════════════════════════════════════════════
    story.extend(section("14. How to Run It", [
        body("Requires <b>Node.js 20+</b>. No environment variables, no database, no external services."),
        Spacer(1, 4),
        code(
            "cd scope-alpha/frontend\n"
            "npm install\n"
            "npm run dev\n"
            "# Open http://localhost:3000"
        ),
        Spacer(1, 4),
        body("Or on this machine, just double-click <font face='Courier' size='9'>Start_Scope_Alpha.bat</font> in the Alpha folder."),
        Spacer(1, 8),
        body("The landing page loads first. Click 'Launch Terminal' to enter the terminal. Use the sidebar or press 1-6 to switch between views. Click any asset in the watchlist or screener to change the selected instrument \u2014 all views update reactively."),
        Spacer(1, 20),
        ColorBar(width=480, height=2, color=ACCENT_GREEN),
        Spacer(1, 12),
        Paragraph("End of document. You've got this.", styles["Caption"]),
    ]))

    doc.build(story, onFirstPage=first_page_template, onLaterPages=footer_template)
    print(f"PDF generated: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
