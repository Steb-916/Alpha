/**
 * Phase 7: pure-string disclaimer constant.
 *
 * Lives in lib/ (not components/) so server-only modules like the
 * notification dispatcher can import it without pulling in React or
 * "use client" boundaries.
 */

export const SIGNAL_DISCLAIMER_TEXT =
  "This signal is for informational purposes only and does not constitute financial advice. Past performance does not guarantee future results. Trade at your own risk.";
