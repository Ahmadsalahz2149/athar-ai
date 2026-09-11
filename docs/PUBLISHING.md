# Publishing (Phase 7.4)

How a draft becomes a live post on LinkedIn, X, Facebook or Instagram.

Nothing here activates by itself. A platform publishes only when its client
credentials are present **and** a user has connected an account for that brand.
With no credentials the app behaves exactly as before: drafts get scheduled and
sit on the calendar.

## The path a post takes

```
approved ──schedule──► scheduled ──dispatcher──► publishing ──handler──► published
                            ▲                                    │
                            └────── requeue (stranded) ───────────┴──► publish_failed
```

1. **Schedule.** The calendar sets `status='scheduled'` and `scheduled_at`.
   "Publish now" is the same thing with `scheduled_at = now()`.
2. **Dispatch** (`lib/social/dispatch.ts`). On every worker tick, each draft
   whose slot has arrived is claimed — `scheduled → publishing` — and a
   `publish_draft` job is inserted **in the same transaction**. If the insert
   fails, the claim rolls back with it and the draft stays schedulable. The
   claim uses `FOR UPDATE SKIP LOCKED`, so overlapping cron runs cannot claim
   the same draft and nothing is posted twice.
3. **Publish** (`lib/jobs/handlers/publishDraft.ts`). Refreshes the token if it
   is expiring, re-runs the content guard against what is stored *now* (a draft
   can be edited after approval), then calls the platform.
4. **Record.** `published` with the platform's post id and permalink, or
   `publish_failed` with a reason the user can act on.

## Failure handling

The handler separates two kinds of failure, because they need opposite
treatment:

| Kind | Examples | What happens |
|---|---|---|
| Permanent | text over the limit, Instagram with no image, revoked token, unsupported platform, unsafe content | the job **completes**, the draft becomes `publish_failed`, the reason is shown. Retrying would fail identically and only delay telling the user. |
| Transient | 429, 5xx, timeout, connection reset | the job **throws** and the queue retries with backoff (30s · 2m · 8m), up to 3 attempts. The draft stays `publishing` until the last attempt, so the calendar never shows a failure a retry is about to undo. |

A 401/403 additionally marks the connection `expired`, which is what turns
"posts silently stopped working" into a visible "reconnect this account".

If a worker dies between claiming a draft and running the job, the draft would
sit in `publishing` forever. `requeueAbandonedPublishes` returns it to
`scheduled` — but only when there is no live job for it *and* the claim is over
an hour old, well past both the queue's 30-minute reaper window and the
30-second cap on any single platform call, so no request that could still land
is in flight.

## Cron

Publishing rides the existing worker cron — `POST /api/worker` with
`Authorization: Bearer $WORKER_SECRET` (see `scripts/run-worker-cron.mjs`).
There is nothing extra to keep alive. Its response reports
`{ dispatched, requeued, processed, reaped }`.

The cron interval is the resolution of the schedule: a post set for 10:00 goes
out on the first tick at or after 10:00.

## Per-platform notes

| Platform | Posts as | Needs |
|---|---|---|
| LinkedIn | the member (`urn:li:person:…` from `/v2/userinfo`) | the "Share on LinkedIn" product for `w_member_social` |
| X | the authorized user | a **paid** API tier — the free tier cannot create posts |
| Facebook | the first Page on the account, using that Page's own token | App Review for `pages_manage_posts` |
| Instagram | the Business/Creator account linked to that Page | App Review for `instagram_content_publish`, **and an image on every post** |

Two details that are easy to get wrong and are covered by tests:

- LinkedIn's `commentary` is "little text": `( ) [ ] { } < > @ | ~ _ * #` and
  the backslash itself are markup and must be escaped, or the call 422s.
- X counts **code points**, not UTF-16 units (so Arabic is one per letter) and
  charges every URL a flat 23 characters regardless of length.

Meta tokens are handled at connect time, not publish time: the short-lived code
token is exchanged for a long-lived one, and the Page token derived from it does
not expire. Meta has no `refresh_token` grant, so a dead Meta connection means
re-consent — the publisher does not pretend otherwise.

## Operator checklist

1. Put the platform's client id/secret in `.env.production` (see
   `.env.example`). `OAUTH_BASE_URL` must be the public https origin.
2. Register `"$OAUTH_BASE_URL"/api/social/<platform>/callback` as an allowed
   redirect URI on the platform.
3. Deploy. `scripts/deploy-cpanel.sh` applies migrations itself, before the new
   release goes live (`drizzle/0023_draft_publishing.sql` adds the columns the
   publisher writes).
4. Restart, then connect an account from **Settings → Platforms**. A connect
   that fails because the account has no Page or no linked Instagram account
   fails *there*, with the cause in the logs (`social.connect_failed`), instead
   of at the first scheduled slot.
5. Verify with one post: schedule it a minute out, or use "Publish now" on the
   calendar, and confirm the card turns green with a working link.
