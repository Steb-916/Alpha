# Deploy Scope Alpha to Vercel — Step-by-Step PRD

## Context
Scope Alpha is a Next.js 14 app that needs to be deployed to Vercel for demo purposes. The repo currently has node_modules tracked in git (1,255 files staged) and uses SQLite locally. We need to: clean the repo, switch to cloud Postgres, and deploy.

**This is a sequential checklist. Complete each step before moving to the next.**

---

## Step 1: Fix .gitignore

Create or replace `.gitignore` in the project root (same level as `package.json`):

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/

# Environment
.env
.env.local
.env.production.local
.env.development.local

# Database
prisma/dev.db
prisma/dev.db-journal

# Build
dist/
build/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.log

# OS
.DS_Store
Thumbs.db

# Vercel
.vercel/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Generated files
generate-pdf.mjs
*.pdf
```

### Verification
```
□ .gitignore file exists in project root
□ File contains all entries listed above
```

---

## Step 2: Remove node_modules from Git Tracking

If node_modules was previously committed or staged, remove it from git's index:

```bash
git rm -r --cached node_modules
```

If this command says "fatal: pathspec 'node_modules' did not match any files" that means it was never committed — that's fine, skip to Step 3.

Then check what's staged:

```bash
git status
```

The changed file count should now be your actual source code only — roughly 40-80 files, NOT 1,255.

### Verification
```
□ `git status` shows no node_modules files staged
□ Total staged files is under 100 (your source code only)
□ No .env or .env.local files are staged
□ No prisma/dev.db file is staged
□ No generate-pdf.mjs is staged
```

---

## Step 3: Remove Hardcoded Local Paths

Search the entire codebase for any hardcoded local file paths like `E:\\` or `C:\\` or absolute paths that reference your local machine:

```bash
grep -r "E:\\\\" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" .
grep -r "C:\\\\" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" .
grep -r "Telegram Desktop" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" .
```

Delete or .gitignore any files that are local utility scripts (like `generate-pdf.mjs`). These are not part of the app.

### Verification
```
□ No hardcoded local paths exist in any committed source file
□ generate-pdf.mjs is either deleted or in .gitignore
```

---

## Step 4: Switch Database from SQLite to PostgreSQL (Neon)

### 4a. Update Prisma Schema

In `prisma/schema.prisma`, change the datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

If it currently says `provider = "sqlite"`, change it to `"postgresql"`.

### 4b. Fix SQLite-incompatible Field Types

SQLite doesn't support some Postgres types, and the reverse is also true. Scan the schema for these issues:

**If any field uses `String` to store arrays (SQLite workaround), convert back to proper types:**
```prisma
// SQLite workaround (remove this pattern):
primaryAssets  String    // stored as JSON string

// PostgreSQL proper:
primaryAssets  String[]
```

**If any field uses `Float` instead of `Decimal` (SQLite workaround), convert back:**
```prisma
// SQLite workaround:
entryPrice    Float

// PostgreSQL proper:
entryPrice    Decimal   @db.Decimal(20, 8)
targetPrice   Decimal   @db.Decimal(20, 8)
stopLossPrice Decimal   @db.Decimal(20, 8)
resolvedPrice Decimal?  @db.Decimal(20, 8)
resultPnlPercent Decimal? @db.Decimal(10, 4)
priceUsd      Int       // keep as cents if already Int
```

**If any `DateTime` fields need adjustment:**
- SQLite uses `DateTime` without timezone
- PostgreSQL should use `DateTime` (Prisma handles the mapping)
- No changes needed unless there are raw SQL queries with timezone issues

**If any `@unique` constraints or `@@unique` pairs exist, they should work on both — no changes needed.**

### 4c. Update .env.example

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-string-here"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### 4d. Create .env.local with Neon Connection String

The user needs to:
1. Go to https://neon.tech and create a free account
2. Create a new project (any name, e.g., "scope-alpha")
3. Copy the connection string from the Neon dashboard
4. Paste it into `.env.local` as `DATABASE_URL`

**Claude Code cannot do this step** — it requires the user to create an account and copy credentials. Print clear instructions:

```
ACTION REQUIRED — You need to set up the database:

1. Go to https://neon.tech and sign up (free)
2. Click "New Project" → name it "scope-alpha" → select the closest region
3. On the dashboard, copy the connection string (it looks like):
   postgresql://username:password@ep-xxx-xxx-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
4. Create a file called .env.local in the project root with:
   DATABASE_URL="paste-your-connection-string-here"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="run-this-command-to-generate: openssl rand -base64 32"
5. Then run: npx prisma db push
   This creates all 13 tables in your Neon database.
6. Verify with: npx prisma studio
   This opens a browser UI where you can see your tables.
```

### Verification
```
□ prisma/schema.prisma datasource provider is "postgresql"
□ All field types are PostgreSQL-compatible (Decimal, String[], etc.)
□ .env.example exists with placeholder DATABASE_URL
□ Instructions printed for user to set up Neon and .env.local
□ After user sets up Neon: `npx prisma db push` completes without errors
□ After user sets up Neon: `npx prisma studio` shows all 13 tables
```

---

## Step 5: Verify Build Passes Locally

Before deploying, ensure the app builds without errors:

```bash
npx next build
```

This will catch:
- TypeScript errors
- Import errors
- Missing environment variables
- Server/client component boundary issues

**Common issues to fix:**

If build fails with "missing environment variable":
- Ensure all required env vars have fallbacks or are checked with `process.env.VARIABLE ?? ''`
- NextAuth requires NEXTAUTH_SECRET in production — ensure it's set

If build fails with "prisma client not generated":
- Run `npx prisma generate` before building
- Add to package.json scripts: `"postinstall": "prisma generate"`

If build fails with "window is not defined" or SSR errors:
- Ensure any browser-only code (localStorage, window) is wrapped in `typeof window !== 'undefined'` checks or inside `useEffect`
- Ensure PriceChart (TradingView Lightweight Charts) uses dynamic import with `ssr: false`

### Add postinstall Script

In `package.json`, add or verify this script exists:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

This ensures Vercel generates the Prisma client during deployment.

### Verification
```
□ `npx next build` completes with 0 errors
□ package.json has "postinstall": "prisma generate"
□ No TypeScript errors in the build output
□ Build output shows all routes compiled successfully
```

---

## Step 6: Prepare the Initial Commit

Stage only your source code:

```bash
git add -A
git status
```

Review the staged files. You should see ONLY:
- `app/` directory (pages, layouts, API routes)
- `components/` directory
- `lib/` directory
- `prisma/schema.prisma` (NOT prisma/dev.db)
- `public/` directory (logo, static assets)
- `package.json` and `package-lock.json`
- `tailwind.config.ts`
- `tsconfig.json`
- `next.config.js`
- `middleware.ts`
- `.gitignore`
- `.env.example`
- `README.md`

You should NOT see:
- `node_modules/` (anything)
- `.env` or `.env.local`
- `prisma/dev.db`
- `generate-pdf.mjs`
- Any `.pdf` files
- `.next/` directory

Commit:

```bash
git commit -m "feat: Scope Alpha marketplace - full platform with auth, signals, annotations, chat, reviews"
```

### Verification
```
□ `git status` after commit shows "nothing to commit, working tree clean"
□ `git log --oneline -1` shows the commit message
□ Committed file count is reasonable (40-100 files, not 1,000+)
```

---

## Step 7: Push to GitHub

If the remote is already set up:

```bash
git push origin main
```

If the remote is NOT set up (new repo):

```
ACTION REQUIRED — Create a GitHub repository:

1. Go to https://github.com/new
2. Name it "scope-alpha" (or whatever you prefer)
3. Set it to PRIVATE (important — this has your business logic)
4. Do NOT initialize with README (you already have one)
5. Copy the remote URL and run:
   git remote add origin https://github.com/YOUR_USERNAME/scope-alpha.git
   git push -u origin main
```

### Verification
```
□ Code is pushed to GitHub
□ GitHub repo does NOT contain node_modules (check in browser)
□ GitHub repo does NOT contain .env or .env.local
□ GitHub repo shows your source files correctly
```

---

## Step 8: Deploy to Vercel

```
ACTION REQUIRED — Connect to Vercel:

1. Go to https://vercel.com and sign in with your GitHub account
2. Click "Add New..." → "Project"
3. Select your "scope-alpha" repository
4. Configure the project:
   - Framework Preset: Next.js (should auto-detect)
   - Root Directory: "frontend" (if your project has a frontend/ subfolder)
     OR leave as "./" if package.json is in the repo root
   - Build Command: leave default (next build)
   - Output Directory: leave default (.next)
5. Add Environment Variables (click "Environment Variables" section):
   - DATABASE_URL = your Neon connection string (same as .env.local)
   - NEXTAUTH_URL = https://your-project-name.vercel.app (Vercel will show you the URL after first deploy — you can update this after)
   - NEXTAUTH_SECRET = your secret string (same as .env.local)
   - GOOGLE_CLIENT_ID = your Google OAuth client ID (if using Google login)
   - GOOGLE_CLIENT_SECRET = your Google OAuth secret (if using Google login)
6. Click "Deploy"
7. Wait 1-3 minutes for the build to complete
```

### Post-Deploy Steps

After the first deploy, Vercel gives you a URL like `scope-alpha-abc123.vercel.app`. You need to:

1. **Update NEXTAUTH_URL:** Go to Vercel project → Settings → Environment Variables → update `NEXTAUTH_URL` to the actual deployed URL (e.g., `https://scope-alpha-abc123.vercel.app`). Then redeploy.

2. **Update Google OAuth (if using):** Go to Google Cloud Console → your OAuth app → add the Vercel URL to "Authorized redirect URIs": `https://scope-alpha-abc123.vercel.app/api/auth/callback/google`

3. **Push the database schema:** The database tables should already exist from Step 4. If not, you can run Prisma commands locally pointing at the same Neon database — the schema is shared.

### Verification
```
□ Vercel build completes without errors
□ Deployed URL loads the landing page
□ Landing page animations work (hero glow, floating dashboard, scroll effects)
□ Clicking "Launch Terminal" or "Get Started" navigates to /login
□ Sign up with email/password works (creates user in Neon database)
□ Login works and redirects to /terminal
□ Terminal loads with chart, watchlist, sidebar navigation
□ Marketplace page loads at /marketplace
□ Analyst profile pages load at /analyst/[slug]
□ Theme toggle works (light/dark)
□ Chat drawer opens (and is opaque, not transparent)
□ All terminal sub-pages work (funding, OI, liquidations, basis, screener)
□ Signing out works and redirects to landing page
□ The URL is shareable — open in incognito browser and verify it loads
```

---

## Troubleshooting Common Vercel Deploy Failures

### "Module not found" errors
- A file import path is case-sensitive on Linux (Vercel) but case-insensitive on Windows
- Example: `import Sidebar from './sidebar'` works on Windows but fails on Vercel if the file is `Sidebar.tsx`
- Fix: match the exact casing of filenames in all imports

### "PrismaClient not initialized" or "prisma generate" errors
- Ensure `"postinstall": "prisma generate"` is in package.json scripts
- Ensure `prisma/schema.prisma` is committed to the repo

### "NEXTAUTH_URL" mismatch
- NEXTAUTH_URL must exactly match the deployed URL including https://
- No trailing slash

### "Cannot find module 'lightweight-charts'"
- Ensure `lightweight-charts` is in `dependencies` (not `devDependencies`) in package.json
- Run `npm install lightweight-charts --save` if needed

### Build timeout
- Vercel free tier has a 45-second function timeout and 5-minute build timeout
- If build is slow, check for unnecessary imports or large dependencies

### Database connection failures
- Neon free tier pauses after 5 minutes of inactivity — first request after pause takes ~1 second to wake
- Ensure the DATABASE_URL includes `?sslmode=require`
- Ensure the Neon project region is close to Vercel's default region (us-east-1)

---

## Summary

After completing all 8 steps:
- Your code is on GitHub (private repo, clean, no node_modules)
- Your database is on Neon (free PostgreSQL, 13 tables)
- Your app is on Vercel (free hosting, auto-deploys on push)
- You have a shareable URL to give to your investor
- Total cost: $0

When you pick a real name and buy a domain, add it to Vercel: Project → Settings → Domains → add your domain → update DNS. Done.
