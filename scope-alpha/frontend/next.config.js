/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  experimental: {
    serverComponentsExternalPackages: ['ws'],
  },
  env: {
    NEXT_PUBLIC_TELEGRAM_BOT_NAME: process.env.TELEGRAM_BOT_NAME ?? '',
  },
};

// Phase 7: optionally wrap with Sentry's webpack plugin when both
// SENTRY_DSN is set AND @sentry/nextjs is installed. Either condition
// missing → ship the bare config (Sentry stays inert via the runtime
// require() guards in lib/sentry.ts and the sentry.*.config.ts files).
let exported = nextConfig;
if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { withSentryConfig } = require('@sentry/nextjs');
    exported = withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }, {
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch {
    // @sentry/nextjs not installed — keep the bare config.
  }
}

module.exports = exported;
