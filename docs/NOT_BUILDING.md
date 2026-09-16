# Deliberately not building — with reasons

> **Current as of 2026-09-16.** This file previously listed, as deliberately
> deferred, a dozen things that have since shipped — team seats, client review
> links, real publishing, self-serve billing, the feedback→DNA loop. A document
> that tells you a built feature does not exist is worse than no document: it is
> read as an authority. It has been rewritten against the code as it stands.
>
> The pre-build version is in git history (`docs/NOT_BUILDING.md` before
> 2026-09-16) if the original reasoning is ever wanted.

A plan without edges is not a plan. Each of these is deferred by a decision, not
by forgetting, and each says what would change the decision.

## Not building now

- **A native mobile app.** The web app is responsive and works on a phone. A
  native app doubles the maintenance surface before we know customers want one.
  *Changes when* customers ask for one specifically, rather than for "an app".

- **Gulf payment rails — mada, STC Pay, Tabby.** Stripe is enough to prove
  willingness to pay. These get added when payment friction is the measured
  blocker, not assumed to be.

- **A third language.** Arabic and English are at exact key parity (1815 keys
  each, guarded by a test). A third means 50% more work on every feature after
  it. *Changes when* a market asks in volume.

- **A visual redesign.** The interface is consistent and works in both
  directions. Redesigning before a customer says what confuses them is expensive
  guessing.

- **ZATCA phase-two e-invoicing (Saudi Arabia).** XML, cryptographic stamping
  and invoice clearance are a certification path, not a coding task. What exists
  is a standard tax invoice, which is enough to operate and to hand an
  accountant. *Changes when* the Saudi market becomes a priority — a commercial
  decision, and a deliberate one either way.

- **Sending our own transactional email.** Invitations return a link the owner
  sends themselves. This is honest about who delivers it and works today; an
  invitation that silently fails to arrive is worse than none. *Changes when*
  SMTP is configured in Supabase — the seam is one function.

- **Audio playback from a citation.** Sources are transcribed and the original
  upload is deleted (ADR-009 chose this over ~$20/brand/month of retained
  media). Citations therefore carry text, not a timestamp you can hear. A
  permanent low-bitrate derivative would restore it and is not built.

- **Dialect-authenticity review as a separate model pass.** The DNA carries
  dialect and register into every generation prompt, and the voice test checks a
  draft against it. A dedicated reviewer pass is a second inference on every
  draft for a gain nobody has measured.

## Shipped — and once listed here

Kept deliberately, as a record of what the deferral list got wrong:

| Once deferred | Now |
|---|---|
| Self-serve billing | Stripe Checkout, subscriptions, webhooks, invoices, VAT |
| Real social publishing | LinkedIn, X, Facebook, Instagram — live behind each platform's credentials |
| Real platform analytics | Metrics collected per post; findings only when the evidence supports them |
| Team seats and roles | Owner / editor / reviewer, one capability matrix (ADR-012) |
| Public client review links | Token-scoped review surface, no account (ADR-013) |
| Calendar, Approvals, Analytics, Ideas | All built |
| The feedback→DNA loop | Closed: real performance now informs the voice model, with provenance and a revert |

The lesson worth keeping: the loop was described here as "architected in, not
out" — and that turned out to be the part that held. The schema anticipated it,
so closing the loop was a feature rather than a migration.
