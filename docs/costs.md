# What costs money (and when)

Building and piloting cost **₹0**. Everything below is optional or only matters past the free tiers.

| Item | Free tier | When it starts costing | Rough cost |
|---|---|---|---|
| Cloudflare R2 (photos) | 10 GB storage, 1M writes and 10M reads a month, zero egress | Past 10 GB: roughly 3–4 medium weddings of originals + derivatives | $0.015/GB-month (~₹1.3/GB). 100 GB ≈ ₹120/month |
| R2 sign-up | — | A card is required to enable R2, but nothing is charged within the free tier | ₹0 |
| Supabase | 500 MB DB, 50k MAU, 1 GB file storage | Past ~2–3M faces (128-d vectors + indexes), or if you need no pausing or PITR backups | Pro $25/month |
| Cloudflare Workers | 100k requests/day, 10 ms CPU per request | Very large events with thousands of concurrent guests | Paid plan $5/month (also raises the bundle limit to 10 MiB) |
| Oracle Cloud Always Free | 4 OCPU / 24 GB Ampere | A card is required for sign-up verification. Always Free resources are not billed | ₹0 |
| Worker alternative | Your laptop | — | ₹0 |
| Resend (email) | 3,000/month, 100/day | More than 100 "photos ready" emails a day | $20/month |
| Razorpay | No setup or monthly fee | Per successful payment | ~2% + GST per transaction |
| Sentry (optional) | 5k errors/month | Past that | $26/month |
| Custom domain | — | Always | ~₹800–1,200/year |

Nothing in the code needs a paid service. Payments, email and error tracking stay off until keys are added.
