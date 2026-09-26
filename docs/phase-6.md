# Phase 6 — Plans & limits

**Built:** `plans` table (trial 500 photos total / 1 event / 2 GB; Starter ₹999; Pro ₹2,499 with branding;
Studio ₹5,999), `usage` metering (uploads + processed per month), server-side enforcement in check/complete
uploads and event creation, `/pricing`, `/app/billing` with meters, `/app/brand` (accent colour for Pro/Studio).
Razorpay Subscriptions checkout + signature-verified webhook. **Optional:** with no keys set, the buttons are
disabled with a note, and everything else works.

**To enable Razorpay (test mode):** create plans in the dashboard, then set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_PLAN_{STARTER,PRO,STUDIO}`. Point the webhook at `/api/billing/webhook`.

**Costs:** Razorpay per-transaction fees only when real payments flow.
