# PRD — `orrery`: a relationship operating system

**Status:** Draft for review · **Author:** Claude (with Johnathan) · **Date:** 2026-07-26
**Codebase:** `codex/web` (Next.js 16.2.6, React 19.2.4, Supabase) · replaces and absorbs `/relationships`
**Proposed code name:** `orrery` — a clockwork model of a solar system that shows where bodies *are* and where they *will be*. Follows the `financials → ephemeris` naming convention.

---

## 0. Where things actually stand

I queried the live Supabase project before writing this. The gap between the schema's ambition and the data in it is the single most important input to this document.

| Signal | Count | Read |
|---|---:|---|
| Contacts total | **1,186** | The corpus is a phone-book import, not a curated network |
| `tracked = true` | 348 | A reasonable working set already exists |
| `strength_tier = 'none'` | 837 | Tiering is 70% unfilled |
| `strength_tier = 'strong'` | **2** | Effectively unused |
| `last_contact_date` present | 349 | …but **318 of them are the identical date `2025-11-26`** |
| `target_contact_date` present | 339 | …but **295 are the identical date `2026-02-24`**, and **308 are now overdue** |
| `timeline_notes` non-empty | 242 | **The one genuinely valuable curated asset in the DB** |
| `notes` present | 7 | Unused |
| `organization` present | 134 | 89% of contacts have no employer |
| Any email address | **12** | 1,174 contacts have `emails = []` |
| Any phone number | 930 | Phone-first corpus (iCloud origin) |
| `linkedin` present | 9 | Unused |
| `looking_for` present | 2 | Unused |
| `birthday` present | 11 | Unused |
| `follow_up_fl = true` | 9 | Unused |
| Companies / Projects | 179 / 14 | Reference data exists and is unlinked to people |

**Three conclusions drive the entire design:**

1. **The follow-up system is already dead on arrival.** 308 overdue reminders, 295 of which share one date, is not a queue — it's wallpaper. You will never open a screen that says "308 overdue." Any design that surfaces raw overdue counts fails on day one. *The queue must be scored and capped, never listed.*

2. **Bulk-stamped dates are worse than null.** `last_contact_date = 2025-11-26` on 318 people is a lie the system tells itself. Every downstream calculation inherits it. This must be quarantined before anything is built on top.

3. **The valuable asset is `timeline_notes` (242 people), not the structured fields.** What you actually did was write down things you remembered about people. The product should be built around that behavior, not around making you fill in dropdowns.

**Also found:** migration `20260624000000_relationship_sqs_flags.sql` is marked ✅ applied in `RUNBOOK.md`, but `contacts.sqs`, `.fundraising`, `.consulting`, and `.hiring` **do not exist in the live database** (`42703: column contacts.sqs does not exist`). The runbook is wrong. This is a prerequisite fix, not part of this PRD.

---

## 1. Product thesis

> **You get 12 minutes a day. The product's job is to spend them on the highest-value 8 decisions in your network, and to make each decision cost one keystroke.**

Every CRM ever built fails the individual for the same reason: it is a *database that asks you to maintain it*. The maintenance cost exceeds the recall value, so it rots. Your own data is a textbook case — 1,174 empty email fields and 318 identical dates are what rot looks like.

`orrery` inverts the contract:

| Conventional CRM | `orrery` |
|---|---|
| You maintain records; it stores them | It proposes; you confirm or dismiss |
| Shows you everything, sorted | Shows you ~8 things, scored |
| Data entry is a form | Data entry is a byproduct of triage |
| Completeness is the goal | Timeliness and recall are the goals |
| Reminders you set | Cadence the system derives |

**The 15-minute contract.** The daily session has a hard shape:

```
~2 min   Catch up      — auto-detected interactions since yesterday, confirm/correct
~8 min   The Round     — 8–12 scored cards, one keystroke each
~3 min   Capture       — anything on your mind, typed in natural language
~2 min   Dots          — one goal-oriented prompt: "who moves Goal X this week?"
```

If a session takes longer than 15 minutes, that is a **product defect**, not user diligence. Session length is a tracked metric with an SLO (§9).

---

## 2. Goals & non-goals

### Goals
- **G1** — Never lose a person worth keeping. Decay is detected before the relationship is unrecoverable.
- **G2** — Never walk into a conversation without the things you should remember.
- **G3** — Turn 1,186 rows into a working portfolio of ~150 with honest tiers.
- **G4** — Make the network legible against long-term goals: for any goal, know who moves it.
- **G5** — Reduce marginal cost of recording an interaction to **under 5 seconds**.
- **G6** — The daily ritual is genuinely completable in 10–15 minutes, and pleasant enough to be habitual.

### Non-goals
- Team/multi-user CRM. Single-operator, service-role, no RLS policies (consistent with the rest of `codex`).
- Automated outreach. `orrery` drafts and opens; **it never sends**. (§4.8)
- Third-party data-broker enrichment (Clearbit, Apollo, PDL). Scraping people you know is a trust violation and a legal grey zone. Enrichment comes from your own mailbox, calendar, and typing.
- A mobile app. Responsive PWA only.
- Replacing iCloud Contacts as the address-book of record for phone numbers.

---

## 3. The ten ideas

| # | Idea | One-line | Solves | Phase |
|---|---|---|---|---|
| 1 | **The Daily Round** | One time-boxed, scored, keyboard-driven triage queue — the entire daily ritual | The 308-overdue problem | 1 |
| 2 | **Cadence Engine** | Derived next-touch from real signal + tier, replacing frozen `target_contact_date` | Dead reminder data | 1 |
| 3 | **Portfolio Tiers** | Capped tiers (Inner 15 / Active 60 / Network 250 / Archive) with suggested placement | 837 `none`, 2 `strong` | 1 |
| 4 | **Interaction Log** | First-class `interactions` table — one row per touch, not a jsonb blob | Untrustworthy dates | 1 |
| 5 | **Signal Ingestion** | Gmail + Calendar auto-detect touches; you confirm, never type | 5-second recording cost | 2 |
| 6 | **Memory Cards** | Structured, sourced, dated facts about people, surfaced before contact | "Remember key details" | 2 |
| 7 | **Goal Graph** | Link people ↔ goals/projects/companies; rank who moves each goal | "Connect the dots" | 2 |
| 8 | **Quick Capture** | Natural-language bar + paste-parser + voice; parse to structure | Capture friction | 3 |
| 9 | **Path Finder** | Second-degree warm-intro paths through your own graph | Leverage the network | 3 |
| 10 | **Health & Hygiene** | Network health metrics + a self-repairing enrichment queue | 1,174 empty emails | 3 |

Ideas 1–4 are one interlocking system and ship together; 1 is useless without 2 and 4, and dangerous without 3. Ideas 5–10 layer on.

---

## 4. Detailed specifications

---

### 4.1 — The Daily Round

**Problem.** You have 308 overdue follow-ups. Any UI that renders that list is a wall of guilt you will close and never reopen. The product needs to make a *decision on your behalf* about what the best ~10 minutes of relationship work today looks like.

**Solution.** A single route, `/orrery`, that is a finite deck of scored cards. It has an end. You finish it. The completion state is the point.

#### The card

Each card is one person and one proposed action, rendered as a full-width focus card (not a table row):

```
┌──────────────────────────────────────────────────────────────┐
│  ● Active · last touched 94 days ago · cadence 60d           │
│                                                              │
│  Mike Antipas                                     [ SQS — ]  │
│  Data / analytics · Notre Dame                               │
│                                                              │
│  ┌ You should remember ──────────────────────────────────┐   │
│  │ Fencer at ND, also loves data. Studied ACMS.          │   │
│  │ Tagged: Data Analysis                    2025-11-26   │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  Why now: 34 days past cadence · linked to goal "Raise seed" │
│                                                              │
│  [E] Draft email   [L] Log a touch   [S] Snooze 30d          │
│  [N] Add a memory  [T] Retier        [X] Not worth tracking  │
└──────────────────────────────────────────────────────────────┘
                                              card 3 of 9  ▓▓▓░░░░░░
```

Non-negotiables:
- **One card at a time.** No list view in the Round. Lists invite scrolling instead of deciding.
- **Every card shows what you already know** about the person. This is the reward loop — the product gives before it asks.
- **Every card states "why now."** An unexplained prompt gets dismissed.
- **Every card is dismissible in one key.** `S` and `X` are first-class, not buried.
- **The deck has a floor and ceiling:** 6 min, 14 max, sized to the time budget.

#### Card types

| Type | Trigger | Default action |
|---|---|---|
| `RECONNECT` | Overdue vs. cadence (§4.2) | Draft / log / snooze |
| `CELEBRATE` | Birthday, anniversary, work-anniversary within 7d | Draft a note |
| `CONFIRM` | Auto-detected interaction (§4.5) needs confirmation | Yes / no / edit |
| `REMEMBER` | High-tier person with thin memory cards (§4.6) | Add 1 fact |
| `CONNECT` | Person plausibly linked to an active goal (§4.7) | Link / dismiss |
| `TIDY` | Hygiene: duplicate, missing email, untiered (§4.10) | Merge / fill / tier |
| `MILESTONE` | Detected job change, funding, press | Congratulate |

**Composition rule — the mix is enforced, not emergent:** at most **3** `TIDY` and at most **2** `REMEMBER` per deck. Hygiene work is real but it is not networking; letting it dominate turns the ritual into data entry and kills the habit.

#### Scoring

```
score(person, card) =
    tierWeight            // Inner 3.0 · Active 2.0 · Network 1.0 · Archive 0
  × overdueRatio          // daysSinceTouch / cadenceDays, clamped [0, 3]
  + eventBoost            // birthday ≤7d: +5 · milestone: +4 · their ask due: +4
  + goalBoost             // linked to an active goal: +2 (+1 per extra goal, cap +4)
  + reciprocityBoost      // they reached out last and you didn't reply: +3
  - snoozeDecay           // snoozed within 90d: −4, decaying linearly to 0
  - fatiguePenalty        // shown but not acted on 2× in 30d: −2 (3× ⇒ auto-archive prompt)
```

Ties break toward the person with richer memory cards — a card you can act on well beats a card you can only act on.

`reciprocityBoost` matters more than it looks: the highest-regret failure mode is *ignoring someone who reached out to you*. Once §4.5 lands, this becomes the single strongest signal in the model.

#### Session flow

1. **Catch up** — `CONFIRM` cards first, batched. Auto-detected touches confirm with `Y`; this repairs `last_contact_date` for free.
2. **The Round** — scored deck.
3. **Capture** — free-text bar (§4.8).
4. **Dots** — one `CONNECT` prompt tied to a goal.
5. **Done** — completion screen: touches logged, memories added, people retiered, streak. Then the app tells you to leave.

#### Interaction & performance

- Keyboard-first: `J/K` navigate · `Enter` open profile · single-letter actions · `U` undo (10s toast) · `/` search · `?` shortcuts.
- Every action is optimistic; the card animates out immediately. No spinners inside the Round.
- **Latency budget:** deck built server-side in <400ms p95; card transition <16ms; action ack <100ms perceived.
- Touch targets ≥44px; swipe left = snooze, right = done on mobile.
- The deck is **built once per day and frozen** (`daily_rounds` row). Re-opening resumes the same deck rather than reshuffling — a deck that changes under you is not completable.

#### Data

```sql
create table daily_rounds (
  id            uuid primary key default gen_random_uuid(),
  round_date    date not null unique,
  cards         jsonb not null,       -- frozen card list w/ scores + reasons
  minutes_spent numeric,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table card_dispositions (
  id           uuid primary key default gen_random_uuid(),
  round_date   date not null,
  contact_id   uuid not null references contacts(id) on delete cascade,
  card_type    text not null,
  score        numeric not null,
  reason       text not null,
  disposition  text not null check (disposition in
                 ('acted','snoozed','dismissed','archived','skipped')),
  acted_at     timestamptz
);
create index card_dispositions_contact_idx on card_dispositions (contact_id, round_date desc);
```

`card_dispositions` is the training data for `fatiguePenalty` and the honest answer to "is this thing working."

**Success metrics.** ≥5 sessions/week · median session 8–14 min · ≥70% of served cards acted on (not dismissed) · deck completion rate ≥80%.

**Risks.** *Deck feels arbitrary* → always render "why now," and ship a `/orrery/why/[id]` score breakdown. *Guilt accumulation* → never show global overdue counts anywhere in the product; the number 308 must not appear in the UI.

---

### 4.2 — The Cadence Engine

**Problem.** `target_contact_date` is a static column that was bulk-written once. 295 people share the date `2026-02-24`; 308 are overdue. It cannot self-correct, because nothing updates it when you actually talk to someone. It is structurally guaranteed to rot.

**Solution.** Delete the concept of a stored target date. **Next-touch is derived, on read, from the interaction log.** It is always correct because it is never stored.

```
cadenceDays(person)  = person.cadence_override
                    ?? tierDefault[person.tier]
nextTouch(person)    = lastRealInteraction(person) + cadenceDays(person)
overdueRatio(person) = daysSince(lastRealInteraction) / cadenceDays
```

| Tier | Default cadence | Rationale |
|---|---:|---|
| Inner | 21 days | Roughly monthly; a real friendship |
| Active | 60 days | Quarterly-ish with slack |
| Network | 180 days | Twice a year keeps a door open |
| Archive | — | Never surfaced |

**Adaptive cadence (Phase 2).** After ~6 months of log data, per-person observed intervals inform the default: if you have historically touched someone every ~40 days, the system proposes 40, not 60. Proposal only — it asks, never silently rewrites. One-line diff, `Y` to accept.

**Seasonality damping.** Reconnect cards suppress Dec 20 – Jan 2, and the overdue clock pauses across that window so January doesn't open with an avalanche.

#### The migration problem — this is the important part

The 318 identical `2025-11-26` stamps must not be trusted, but they are not worthless either (they mark "curated at some point"). Treatment:

1. Backfill `interactions` from `timeline_notes` where a note has a **plausible, non-bulk date** (a date held by <20 contacts).
2. For contacts whose `last_contact_date` is a bulk-stamp date, write `interactions` rows with `confidence = 'imported_bulk'` and **exclude them from `lastRealInteraction()`**.
3. Those people therefore have **no known last touch** — which is the truth — and enter the Round as `TIDY`/`REMEMBER` cards asking one question: *"When did you last talk to Mike? [in the last month / 3 months / year / longer / never]"* — four buttons, no date picker.
4. Rate-limited to 3/day so repair rides along with normal use instead of becoming a project.

**Full-network repair therefore takes ~4 months of daily use at 3/day for 348 tracked contacts.** That is deliberate. A bulk "fix your data" weekend is exactly the kind of project that never happens. If you want it faster, a `/orrery/repair` bulk mode exists with the same four buttons in a rapid-fire list — opt-in, not the default path.

```sql
alter table contacts
  add column if not exists tier text default 'network'
    check (tier in ('inner','active','network','archive')),
  add column if not exists cadence_override_days integer,
  add column if not exists cadence_paused_until date,
  add column if not exists snoozed_until date;
-- target_contact_date / contact_frequency / follow_up_fl retained read-only
-- for one release, then dropped in a follow-up migration.
```

**Success metric.** Within 90 days, ≥80% of Inner+Active contacts have a `lastRealInteraction` derived from a confirmed (not imported) interaction.

**Risk.** Derived-on-read costs a query per person. Mitigate with a `contact_cadence_state` materialized view refreshed on interaction write — but only if p95 exceeds the 400ms deck budget. Do not pre-optimize.

---

### 4.3 — Portfolio Tiers

**Problem.** 837 contacts are `strength_tier = 'none'` and exactly 2 are `'strong'`. The five-value scale (`strong/medium/weak/loose/none`) mixes two different questions — *how close are we?* and *how much attention should this get?* — so neither gets answered. And with 1,186 contacts, any system that treats them uniformly is asking you to maintain 1,186 relationships. You cannot. Nobody can.

**Solution.** An explicit, **capped portfolio**. Tiers are commitments of attention, not descriptions of affection.

| Tier | Cap | Meaning | Daily Round share |
|---|---:|---|---:|
| **Inner** | 15 | People whose lives you want to actually know | ~40% |
| **Active** | 60 | Live professional relationships; real reciprocity | ~40% |
| **Network** | 250 | Warm enough to email cold; keep the door open | ~15% |
| **Archive** | ∞ | Address-book entries. Searchable, never surfaced | 0% |

Caps are **soft but enforced by friction**: promoting a 16th person to Inner triggers *"Inner is full. Who moves out?"* with the lowest-scoring current member pre-selected. This is the mechanic that makes the whole product honest — it forces the tradeoff you're already making implicitly.

The caps are Dunbar-shaped on purpose (~5 intimate / ~15 close / ~50 meaningful / ~150 stable), rounded to numbers that feel operational rather than academic.

**Assisted tiering.** The system never auto-assigns, but it proposes, with evidence:

```
Suggested: Active                                    [Y] accept  [→] Network
Why: 4 interactions in 6 months · 2 inbound · shares "Notre Dame" ·
     linked to project "Halo" · you wrote 3 memory cards
```

Signals: interaction count & recency, inbound ratio, memory-card depth, goal/project links, shared tags, whether you have their email, `timeline_notes` richness.

**Bootstrapping the 837.** Not a wizard — a **10-per-day** flow inside the Round's `TIDY` budget, sorted by strongest signal first, so the highest-value people get tiered in the first fortnight rather than alphabetically. Estimated ~5 weeks to a fully tiered working set at 10/day. There is also a one-time optional "Sort the top 50" onboarding pass (~10 min, rapid-fire) for people who want a running start — this is the one place a bulk flow earns its keep.

**Migration.** `strength_tier → tier`: `strong|medium → active` · `weak|loose → network` · `none → archive` **if untracked**, `network` **if `tracked = true`**. That single rule seeds ~348 people into the working set on day one. `strength_tier` is retained as `affinity` (an honest, uncapped, purely descriptive field) so the emotional read isn't lost.

**Success metric.** ≥95% of `tracked` contacts tiered within 60 days · Inner and Active at or under cap · <10% of tier assignments changed twice in a quarter (a proxy for "the tiers mean something").

**Risk.** Cap enforcement reads as punitive. Framing is the mitigation: *"Inner is full"* not *"you have too many friends."* Demotion is one key and always reversible; nothing is ever deleted.

---

### 4.4 — The Interaction Log

**Problem.** `timeline_notes` is a jsonb array of `{date, content}`. It cannot be queried across people, aggregated, filtered by channel, or attributed to a source. It cannot distinguish "I emailed her" from "she called me" — and the inbound/outbound distinction is the highest-signal thing in a relationship. 242 contacts have entries, and that content is genuinely good; it deserves a real home.

**Solution.** Promote interactions to a first-class table. This is the substrate everything else reads from — cadence (§4.2), scoring (§4.1), health (§4.10) are all views over it.

```sql
create table interactions (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  occurred_at  timestamptz not null,
  channel      text not null check (channel in
                 ('email','call','text','meeting','event','social','mail','other')),
  direction    text not null check (direction in ('inbound','outbound','mutual')),
  summary      text,                       -- one line, what happened
  detail       text,                       -- optional longer note
  source       text not null default 'manual'
                 check (source in ('manual','gmail','calendar','import','inferred')),
  source_ref   text,                       -- gmail msg id / gcal event id, for dedupe
  confidence   text not null default 'confirmed'
                 check (confidence in ('confirmed','detected','imported_bulk')),
  sentiment    smallint check (sentiment between -2 and 2),
  location     text,
  created_at   timestamptz not null default now(),
  unique (source, source_ref)
);
create index interactions_contact_time_idx on interactions (contact_id, occurred_at desc);
create index interactions_time_idx         on interactions (occurred_at desc);
create index interactions_confidence_idx   on interactions (confidence)
  where confidence <> 'confirmed';
```

**Group interactions.** A dinner with four people writes four rows sharing a `group_key uuid`, so the profile can render "Dinner with Sarah, Mike, and 2 others" without a join table.

**Backfill.** Every `timeline_notes` entry → an `interactions` row (`source='import'`, `channel='other'`, `direction='mutual'`, `confidence` per §4.2's bulk-date rule). `timeline_notes` becomes read-only, then drops one release later. **Snapshot the column to a `timeline_notes_backup` table before dropping** — those 242 entries are irreplaceable and there is no other copy.

**Derived reads.** `lastRealInteraction` · `interactionCount(window)` · `inboundRatio` · `channelMix` · `longestGap` · `currentStreak`. All power §4.1 and §4.10.

**UI.** Profile gets a real timeline: reverse-chronological, channel icons, inbound/outbound arrows, detected-vs-confirmed styling, inline add, `E` to edit. The 5-second logging path is `L` from any card → channel chip → one line of text → `Enter`.

**Success metric.** ≥3 interactions logged per active day · ≥60% of Active+Inner contacts with ≥1 confirmed interaction in the trailing 90 days.

---

### 4.5 — Signal Ingestion (Gmail + Calendar)

**Problem.** The 5-second logging cost is still 5 seconds × every interaction, and you will forget most of them. Meanwhile, Gmail and Calendar already know exactly who you talked to and when. Manual entry, in a world where that record exists, is a design failure.

This is also the highest-leverage feature in the document: it is what makes `last_contact_date` permanently trustworthy without you typing anything.

**Solution.** A read-only sync that proposes interactions. Nothing lands unconfirmed above `confidence='detected'`.

**Gmail.** Nightly (and on-demand) pull of message **metadata only** — `From`, `To`, `Cc`, `Date`, `Subject`, `threadId`. Match participants to contacts by email. Emit `interactions` rows with `channel='email'`, direction from whether you're the sender, `confidence='detected'`.

- **Message bodies are never fetched or stored by default.** Subject lines are stored because they carry the "what was this about" signal at negligible privacy cost. Body access is a separate opt-in used only for the draft-assist feature, and even then is not persisted.
- Excludes: newsletters/automated senders (`List-Unsubscribe` header, `no-reply` patterns), your own aliases, and any thread with >8 recipients (that's a mailing list, not a relationship).
- You already have a Gmail rules system (`~/Documents/email-management-runbook.md`, `mailFilters.xml`); label-derived context can enrich `interactions` later, but v1 stays metadata-only.

**Calendar.** Pull events with ≥1 external attendee. Emit `channel='meeting'`, `direction='mutual'`, `summary` = event title, `location`. Declined/cancelled events are skipped. All-day events without attendees are skipped.

**Contact discovery.** People you email repeatedly who aren't in `contacts` become `TIDY` cards: *"You've exchanged 6 emails with dana@acme.com. Add her?"* — one key. **This is the fix for the 1,174-missing-emails problem**: it repairs the corpus from your actual behavior instead of asking you to type addresses.

**Confirmation UX.** Batched at the top of the Round, grouped by person, dismissible as a group:

```
Since Thursday                                      [A] accept all
  ✉  Sarah Chen — 3 emails, you replied last          Tue
  📅 Mike Antipas — "Coffee" 45m                      Wed
  ✉  dana@acme.com — 6 emails · not a contact yet     [+] add
```

Accepting flips `confidence` to `confirmed`. Ignoring leaves them `detected` — they still count for cadence at a discount (0.7×) because a detected email *is* real evidence, just unverified.

**Auth.** Google OAuth (`gmail.metadata`, `calendar.readonly`) via a dedicated `/orrery/settings/connections` flow. Refresh token encrypted at rest in a `service_connections` table. **Not** the session's MCP connectors — those are interactive-only and won't survive a cron job.

```sql
create table service_connections (
  id            uuid primary key default gen_random_uuid(),
  service       text not null unique check (service in ('gmail','gcal')),
  access_token  text, refresh_token text, expires_at timestamptz,
  scopes        text[] not null default '{}',
  last_sync_at  timestamptz, last_sync_status text, last_sync_error text,
  created_at    timestamptz not null default now()
);
```

**Failure mode to design for:** the sync silently stops (token revoked, quota) and the product goes quiet, which reads as "nothing to do." A stale-sync banner appears after 48h without a successful run. Silence must never be ambiguous.

**Success metric.** ≥80% of email/meeting interactions captured without manual entry · <5% false-positive rate on confirmation · median confirm-batch time <90 seconds.

**Risks.** *Privacy* — metadata-only default, explicit scope list at connect time, one-click disconnect-and-purge. *Volume* — a heavy mail day generating 40 confirmations breaks the time budget; cap the batch at 12 and roll the rest forward, prioritized by tier.

---

### 4.6 — Memory Cards

**Problem.** "Make sure I remember key details about people" is the stated goal, and the schema's answer is a single `notes` text field — used by **7 of 1,186 contacts**. Meanwhile `timeline_notes` has 242 entries because writing *"Fencer at ND, also loves data. Studied ACMS"* is a natural thing to do and filling a form is not. The behavior is there; the structure isn't.

**Solution.** Small, typed, dated, **sourced** facts. Not a notes field — a set of atoms that can be surfaced, aged, and verified.

```sql
create table memory_cards (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  kind        text not null check (kind in
                ('family','origin','education','career','interest','preference',
                 'health','milestone','opinion','ask','offer','logistics','other')),
  content     text not null,
  learned_on  date,
  source      text,                  -- "she told me", "LinkedIn", "his blog"
  confidence  text not null default 'told'
                check (confidence in ('told','observed','inferred','unverified')),
  sensitive   boolean not null default false,
  expires_on  date,                  -- for time-bounded facts
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index memory_cards_contact_idx on memory_cards (contact_id, pinned desc, created_at desc);
```

**Kinds that earn their place:**
- `ask` — what *they* are looking for. Feeds Path Finder (§4.9) and makes you useful to them.
- `offer` — what they can help with. Feeds Goal Graph (§4.7).
- `logistics` — kids' names, timezone, dietary restriction, spouse's name. The stuff that is mortifying to forget.
- `health` and `family` default `sensitive = true`.

**Sensitivity.** `sensitive` cards are blurred until hovered/focused, excluded from any exported or shared view, and never included in AI draft context unless explicitly pinned. These are facts about real people who did not consent to being in a database; the product should behave as if they might one day read it.

**Aging.** `career` and `logistics` cards older than 18 months surface a `REMEMBER` card: *"Still at Acme? Learned Jan 2025."* Two keys: still true / update. This is how the memory stays true rather than becoming a museum.

**Capture.** Ambient, never a form:
- `N` from any card → one line → auto-classified by keyword heuristics (kids' names → `family`, company names → `career`), confirmable with `Tab`.
- Backfill: the 242 `timeline_notes` entries get parsed into candidate memory cards by an LLM pass. Proposed, never auto-committed — 3/day in the Round. *"Mike Antipas — 'Fencer at ND' → `interest`. Keep?"*

**Surfacing — the payoff.** Memory cards appear:
- On every Round card (the "You should remember" box).
- On a **pre-meeting brief**: when Calendar shows a meeting with a contact in the next 2h, `/orrery` leads with their brief — last 3 interactions, pinned memories, open asks, goal links. This is the moment the product proves its worth.
- In search results, so `/` search for "sailing" finds the three people who sail.

**Success metric.** ≥3 memory cards on 80% of Inner+Active contacts within 90 days · pre-meeting brief opened before ≥50% of eligible meetings.

**Risk.** Memory cards become a chore. Hard cap: never more than 2 `REMEMBER` cards per Round, and always for someone you're about to interact with — the ask has to feel timely, not administrative.

---

### 4.7 — The Goal Graph

**Problem.** *"Connect the dots for my longer term goals"* is the request the current schema can't touch. There are 179 companies and 14 projects in the database with **zero links to people**. There is no goals table at all (`/goals` renders, but nothing in the data model backs it). The network and the ambitions are two disconnected islands.

**Solution.** An explicit graph: **Goals ← People → Companies/Projects**, with a ranked "who moves this" view per goal.

```sql
create table goals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  horizon     text not null default 'year'
                check (horizon in ('quarter','year','three_year','life')),
  status      text not null default 'active'
                check (status in ('active','paused','achieved','abandoned')),
  target_date date,
  parent_id   uuid references goals(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table contact_links (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  target_type  text not null check (target_type in ('goal','project','company')),
  target_id    text not null,
  relevance    text not null default 'related'
                 check (relevance in ('critical','helpful','related')),
  role         text,     -- "could intro me to X", "did this at Stripe", "potential hire"
  note         text,
  created_at   timestamptz not null default now(),
  unique (contact_id, target_type, target_id)
);
create index contact_links_target_idx on contact_links (target_type, target_id);
```

Goals nest (`parent_id`), so *"Raise a seed round"* can sit under *"Build a company by 2028"* and inherit relevance.

**The Goal Board — `/orrery/goals/[id]`.** For a goal, the people ranked by:

```
goalScore = relevanceWeight(critical 3 / helpful 2 / related 1)
          × tierWeight
          + recencyBonus(touched in 90d: +2)
          + offerMatch(memory card `offer` matching goal keywords: +2)
          − stalenessPenalty(no touch in 180d: −2)
```

Rendered in three columns that map to what you'd actually do:

| **Warm** | **Cooling** | **Unlinked but relevant** |
|---|---|---|
| Touched recently, ready to ask | Linked but going cold — reconnect *before* you need them | Suggested by tag/company/university overlap |

That middle column is the whole point. **The most expensive networking mistake is contacting someone only when you need something**, and it is exactly what a goal-driven view encourages if you build it naively. Cooling exists to make you reach out 90 days early, and its cards are always framed as *"reconnect"*, never *"ask."*

**Suggested links.** Heuristics propose `CONNECT` cards: contact's `organization` matches a company tagged to a goal · shared `university_tags` with an existing critical link · memory card `offer` keyword-matching goal text · worked at a company in the goal's sector. One key to link, one to dismiss forever.

**Reverse view — on the profile:** *"Mike is critical to: Raise seed round · Hire a data lead."* Every conversation gets its context back.

**The "Dots" prompt** (step 4 of the daily session) rotates one goal per day and asks exactly one question: *"Who's the one person who could move 'Raise a seed round' this month?"* Answering creates a link and usually a `RECONNECT` card. This is the mechanism that turns 15 minutes/day into strategy rather than maintenance.

**Success metric.** Every active goal has ≥5 linked contacts within 30 days · ≥1 goal-linked interaction per week · a quarterly review can answer "which relationships moved this goal" from data.

**Risk.** Instrumentalizing friendships. Mitigations are real, not cosmetic: goal links are **never** shown on `CELEBRATE` cards; Inner-tier people never surface with a goal framing; and the Cooling column exists precisely to decouple contact from need.

---

### 4.8 — Quick Capture

**Problem.** The gap between *"I just had coffee with Sarah and she mentioned she's hiring a PM"* and that fact being in the system is where every personal CRM dies. If capture costs more than the thought is worth, the thought is lost.

**Solution.** Three paths, each optimized for a different moment.

**1. The bar.** `Cmd/Ctrl+K` from anywhere. Natural language in, structured preview out:

```
> coffee w sarah chen tues, she's hiring a PM, intro her to mike?

  Interaction   Sarah Chen · meeting · 2026-07-21 · mutual
  Memory        Sarah Chen · ask · "hiring a PM"
  Task          Intro Sarah Chen → Mike Antipas
                                    [Enter] save all  [Tab] edit  [Esc] cancel
```

Parsing is LLM-based with a deterministic fallback (name-match + date-phrase regex). Names resolve via trigram match against `full_name` (`pg_trgm` is already installed) with an inline disambiguation chip when ambiguous. **The preview is always shown** — the parse is a proposal, never a silent write.

**2. Paste-parse.** Drop in an email signature, LinkedIn "About" text, or a conference bio → extracts name, title, company, email, phone, LinkedIn → diff view against the existing contact (green = new, amber = conflict) → accept per-field. This is the fastest realistic path to fixing 1,174 empty emails.

**3. Voice.** Hold-to-record on mobile → transcribe → identical preview flow. The genuine use case is the 90 seconds in the car after a meeting, which is when your recall is at its absolute peak and your typing ability at its lowest.

**Drafting assistance.** `E` on a Round card opens a draft that has actually read the context: last interaction, pinned memories, open asks, goal links, and their communication style inferred from prior threads. Three registers — *Warm check-in* / *Direct ask* / *Share something useful*.

**`orrery` never sends.** The draft opens in `mailto:` or copies to clipboard. Automated outreach from a relationship tool is how you destroy the relationships it's meant to protect — and the value of a personal note collapses to zero the moment it could have been generated. Hard product boundary, not a v1 limitation.

> ⚠️ **Clipboard caveat (this machine):** `Set-Clipboard` invoked by an agent writes to that session's clipboard, not the desktop — see `RUNBOOK.md`. Browser-side `navigator.clipboard` from the app is unaffected. Any server-side copy path must not use PowerShell.

**Success metric.** Median capture-to-saved <15 seconds · ≥60% of parses accepted with zero edits · ≥1 capture per active day.

**Risk.** Bad parses silently corrupting data. Mitigations: mandatory preview, `U` undo, every parsed write tagged `source='inferred'` so it can be audited or bulk-reverted.

---

### 4.9 — The Path Finder

**Problem.** The most valuable thing a 1,186-person network can do is reach the 100,000 people *it* knows. Today that lives entirely in your head, which means it effectively doesn't exist. The `contacts.related` jsonb field was built for this and holds nothing.

**Solution.** Explicit edges between people, plus inferred edges from shared attributes, plus a path query.

```sql
create table contact_edges (
  id           uuid primary key default gen_random_uuid(),
  from_contact uuid not null references contacts(id) on delete cascade,
  to_contact   uuid not null references contacts(id) on delete cascade,
  kind         text not null check (kind in
                 ('colleague','classmate','friend','family','introduced_by',
                  'investor','client','knows')),
  strength     text not null default 'known'
                 check (strength in ('close','known','weak')),
  note         text,
  created_at   timestamptz not null default now(),
  check (from_contact <> to_contact),
  unique (from_contact, to_contact, kind)
);
create index contact_edges_from_idx on contact_edges (from_contact);
create index contact_edges_to_idx   on contact_edges (to_contact);
```

Edges are treated as **undirected** for pathfinding except `introduced_by`, which carries direction and is the highest-confidence edge type there is.

**Inferred edges** (not stored; computed, shown dashed): same `organization` with overlapping tenure · shared `university_tags` · both attended the same logged event (via `group_key`, §4.4) · both linked to the same project.

**Edge capture is the hard part, and the answer is that you never "add edges."** They accrue as byproducts:
- Logging a group interaction creates `knows` edges among all attendees.
- The bar understands *"met dana through mike"* → `introduced_by`.
- `TIDY` cards ask one binary at a time: *"Do Sarah Chen and Mike Antipas know each other?"* — Y/N/skip. Two keystrokes. **This is the cheapest possible way to build a graph, and it only works if it stays inside the 3-card hygiene budget.**

**The query — "How do I reach ___?"** Type a company, person, or sector. BFS to depth 3, ranked by:

```
pathScore = Π(edgeStrength) × tierWeight(firstHop) × recency(firstHop) / pathLength
```

Rendered as a ranked, plain-language list, not a force-directed graph:

```
Reaching someone at Stripe

1. via Mike Antipas → Priya Raman (Eng Manager, Stripe)     ★★★
   Mike is Active, touched 3 weeks ago · classmates at ND
   [Draft the ask to Mike]

2. via Sarah Chen → (2 people at Stripe)                     ★★
   Sarah is Network, last touched 8 months ago
   ⚠ Reconnect first — asking cold after 8 months is a withdrawal
```

That warning is a feature. The tool should make you aware of the social debt you're about to incur.

**Deliberately not a graph visualization.** Force-directed layouts of 1,186 nodes are beautiful, unreadable, and answer no question you actually have. A ranked list of paths answers the real one. A small ego-graph (depth 2, ≤30 nodes) on the profile page is the one exception, and it earns its place by being bounded.

**Success metric.** ≥300 edges within 6 months (≈2/day from `TIDY` cards) · ≥1 successful warm intro per quarter attributable to the finder.

**Risk.** Sparse graph = useless results. Gate the feature behind ~100 edges and show a progress state until then, rather than shipping an empty room.

---

### 4.10 — Network Health & Hygiene

**Problem.** Two distinct failure modes need one answer. **Hygiene:** 1,174 contacts with no email, ~180 likely duplicates from the iCloud import, 837 untiered, 9 LinkedIn URLs. **Health:** no way to answer "am I actually maintaining this network, or just feeling busy about it?"

**Solution.** A metrics page you glance at weekly, plus a repair queue that never becomes a project because it's rationed into the daily 3-card `TIDY` budget.

#### Health metrics — `/orrery/health`

| Metric | Definition | Target |
|---|---|---|
| **Coverage** | % of Inner+Active touched within cadence | ≥85% |
| **Decay risk** | Inner+Active at >1.5× cadence | ≤5 people |
| **Reciprocity** | inbound ÷ outbound interactions, trailing 90d | 0.4–0.6 |
| **Freshness** | median days since last touch, by tier | Inner ≤21 |
| **Breadth** | distinct people touched per month | ≥20 |
| **New blood** | contacts added + first-touched per month | ≥3 |
| **Goal coverage** | active goals with ≥3 warm linked contacts | 100% |
| **Memory depth** | Inner+Active with ≥3 memory cards | ≥80% |

**Reciprocity is the metric that will surprise you.** A ratio near 0 means you're broadcasting, not relating — a network that only ever hears from you when you initiate isn't a network, it's a mailing list. Near 1.0 means you're purely reactive and letting the relationships you chose go untended. The 0.4–0.6 band is the honest middle.

Rendered as sparklines over 12 months with a plain-language read: *"You're broadcasting more than usual — 8 outbound, 1 inbound this month."* Follow the `dataviz` skill; reuse the `/wealth` card and KPI components so money and network read as one app.

#### Hygiene queue

Prioritized by value-per-second, not by count:

| Issue | Est. count | Card | Cost |
|---|---:|---|---|
| Likely duplicates | ~180 | Side-by-side merge, field-level pick, `M` to merge | 10s |
| No email, but you've emailed them | ~340 (post §4.5) | Auto-fill from Gmail, confirm | 2s |
| No email, never emailed | ~800 | *Only surfaces if tier ≥ Network* | 15s |
| Untiered | 837 | Suggested tier, `Y` accept | 3s |
| Bulk-stamped date | 318 | Four-button "when did you last talk?" | 3s |
| Stale career fact | grows | "Still at Acme?" | 2s |
| No memory cards, Inner/Active | TBD | Add one fact | 20s |

**Duplicate detection:** trigram similarity on `full_name` (>0.85) + shared phone/email + same organization. Auto-merge only on exact phone match with compatible names; everything else is proposed. Merges write to a `merge_log` so they can be reversed — the iCloud corpus will have genuine father/son and married-couple near-duplicates that must not be silently collapsed.

**The rationing principle:** at 3 cards/day the full hygiene backlog is ~18 months of work, which sounds absurd until you notice that the alternative — a weekend cleanup project — has a completion rate of approximately zero. Value-ordering means the *useful* 10% is done in the first two months. A `/orrery/hygiene` bulk mode exists for when you're in the mood, but the product never nags you toward it.

**Weekly review** (Sunday, ~5 min, replaces that day's Round): the week's touches, decay-risk list, goal movement, one reflective prompt (*"Who did you enjoy talking to this week?"* → often the best Inner-tier signal there is).

**Success metric.** Duplicates <2% of corpus in 6 months · coverage ≥85% sustained for 8 consecutive weeks · weekly review completed ≥3 of 4 weeks/month.

---

## 5. Consolidated data model

**New tables:** `interactions` · `memory_cards` · `goals` · `contact_links` · `contact_edges` · `daily_rounds` · `card_dispositions` · `service_connections` · `merge_log` · `timeline_notes_backup`

**`contacts` changes:**

| Action | Column | Note |
|---|---|---|
| Add | `tier` | Capped portfolio tier (§4.3) |
| Add | `cadence_override_days`, `cadence_paused_until`, `snoozed_until` | §4.2 |
| Add | `affinity` | Renamed from `strength_tier`; descriptive, uncapped |
| Add | `sqs`, `fundraising`, `consulting`, `hiring` | **Prerequisite** — migration marked applied but absent from prod |
| Deprecate → drop | `target_contact_date`, `contact_frequency`, `follow_up_fl` | Superseded by derived cadence |
| Deprecate → drop | `timeline_notes` | → `interactions` (backup first) |
| Deprecate → drop | `last_contact_date` | Derived; kept as a mirror one release for `contacts/*.py` loaders |
| Keep | `related` | Seeds `contact_edges`, then read-only |

**Migration sequence** (each idempotent, applied via the Supabase SQL editor — no CLI on this machine, per `RUNBOOK.md`):

```
20260801000000_fix_sqs_flags.sql          -- repair the phantom migration
20260801000100_interactions.sql           -- table + backfill from timeline_notes
20260801000200_tiers_cadence.sql          -- tier, cadence, snooze; strength_tier → affinity
20260801000300_memory_cards.sql
20260801000400_goals_links.sql
20260801000500_contact_edges.sql
20260801000600_round_state.sql            -- daily_rounds, card_dispositions
20260801000700_service_connections.sql
20260901000000_drop_deprecated.sql        -- one release later, after backup verified
```

RLS enabled, no policies, service-role only — consistent with `contacts`, `wealth_items`, and `eph_*`.

**Server modules** (mirroring the `lib/*-server.ts` convention):
`lib/orrery-server.ts` (deck construction, scoring, health) · `lib/orrery-actions.ts` (Server Actions) · `lib/interactions-server.ts` · `lib/memory-server.ts` · `lib/graph-server.ts` (paths, edges) · `lib/ingest/gmail.ts` · `lib/ingest/gcal.ts`

**⚠️ Read `web/AGENTS.md` before writing any Next.js code.** Next 16.2.6 has breaking changes vs. common knowledge; the authoritative docs ship at `web/node_modules/next/dist/docs/`.

---

## 6. Information architecture

| Route | Purpose |
|---|---|
| `/orrery` | **The Daily Round** — default landing |
| `/orrery/people` | Full list: filter by tier, cadence status, tag, goal |
| `/orrery/people/[id]` | Profile: memories, timeline, links, ego-graph |
| `/orrery/goals` · `/goals/[id]` | Goal board — warm / cooling / suggested |
| `/orrery/paths` | Path finder |
| `/orrery/health` | Metrics + weekly review |
| `/orrery/hygiene` | Opt-in bulk repair |
| `/orrery/settings/connections` | Google OAuth, sync status |
| `/relationships/*` | **307 → `/orrery/*`** (same pattern as `/financials` → `/ephemeris`) |

Sidebar: **Relationships → Orrery**, matching the Financials → Ephemeris precedent.

---

## 7. Design & interaction principles

1. **Propose, don't demand.** Every empty field is a question the system should try to answer first.
2. **One keystroke per decision.** If a decision needs a mouse, it's designed wrong.
3. **Show what you know before asking for more.** Reward precedes request, on every card.
4. **The session ends.** Completion states, not infinite scroll. The app tells you to leave.
5. **Never show a number that induces guilt.** No "308 overdue," no red badges, no streak-shaming. Streaks are shown only when positive.
6. **Everything is reversible.** Undo on every action; nothing hard-deletes; merges are logged.
7. **Honest about uncertainty.** Detected ≠ confirmed, inferred ≠ told, and the UI always distinguishes them.
8. **Reuse the `codex` visual system.** Same cards, KPIs, tables, and money formatting as `/wealth` and `/ephemeris`.

**Performance budgets:** deck build <400ms p95 · card transition <16ms · action ack <100ms perceived (optimistic) · full-list route <1s with 1,186 rows · search results <150ms.

**Accessibility:** full keyboard reachability, visible focus rings, `aria-live` on card transitions, WCAG AA contrast in both themes, respect `prefers-reduced-motion`.

---

## 8. Phasing

### Phase 1 — The Ritual (ideas 1–4)
The daily loop, standalone-valuable without any integration.
`interactions` + backfill · tiers + caps + assisted tiering · derived cadence + bulk-date quarantine · the Round with `RECONNECT`/`REMEMBER`/`TIDY`/`CELEBRATE` · profile timeline · 5-second logging.
**Ships when:** you complete 5 consecutive daily sessions without wanting to close the tab.

### Phase 2 — The Intelligence (ideas 5–7)
The system starts knowing things you didn't tell it.
Gmail + Calendar ingest · `CONFIRM` cards · contact discovery · memory cards + backfill parse · pre-meeting brief · goals + links + goal board · the Dots prompt.
**Ships when:** ≥80% of interactions land without manual entry.

### Phase 3 — The Leverage (ideas 8–10)
Compounding value from an established graph.
Quick-capture bar + paste-parse + voice · draft assist · edges + path finder · health dashboard · hygiene queue · weekly review.
**Ships when:** the graph has ≥100 edges and paths return useful results.

**Sequencing rationale:** every phase is independently valuable and none depends on a later one. Phase 1 is the riskiest — it is a habit bet, and if the habit doesn't form, Phases 2–3 are wasted engineering. Do not start Phase 2 until Phase 1's session metrics hold for three weeks.

---

## 9. Success metrics

**North star:** *number of relationships in honest, active maintenance* — Inner+Active contacts with a confirmed interaction inside their cadence window. Baseline today: effectively **0** (no trustworthy interaction data exists). 6-month target: **60**.

| | 30 days | 90 days | 180 days |
|---|---:|---:|---:|
| Sessions/week | 4 | 5 | 5 |
| Median session length | 12 min | 11 min | 10 min |
| Cards acted on (not dismissed) | 50% | 65% | 75% |
| Tracked contacts tiered | 60% | 95% | 100% |
| Inner+Active within cadence | 40% | 70% | 85% |
| Interactions auto-captured | — | 70% | 85% |
| Contacts with ≥3 memory cards | 20 | 60 | 120 |
| Active goals with ≥5 links | — | 100% | 100% |
| Contact edges | — | 100 | 300 |

**Counter-metrics (watch for harm):** session length trending >15 min (scope creep) · dismissal rate >40% (scoring is wrong) · `TIDY` share of acted cards >30% (it became a data-entry tool) · consecutive days missed >5 (the habit is dead — stop building and diagnose).

---

## 10. Risks & open questions

| Risk | Severity | Mitigation |
|---|---|---|
| Habit doesn't form; app abandoned in 3 weeks | **High** | Phase 1 is small and self-contained; measure sessions from day one; kill or rethink at 3 weeks rather than building Phase 2 on a dead base |
| Deck feels arbitrary or nagging | High | "Why now" on every card; `/why/[id]` breakdown; fatigue penalty; hard hygiene cap |
| Gmail sync breaks silently | Medium | Stale-sync banner at 48h; visible last-sync status; manual re-sync |
| Bulk-date quarantine leaves 318 people in limbo for months | Medium | Value-ordered repair (highest-signal first) + opt-in bulk mode |
| Instrumentalizing relationships | Medium | No goal framing on Inner tier or celebration cards; Cooling column; never auto-send |
| LLM parsing corrupts data | Medium | Mandatory preview; `source='inferred'` tagging; universal undo |
| Sparse edge graph makes §4.9 useless | Medium | Gate behind 100 edges with a visible progress state |
| Scope creep past 15 min | Medium | Session length is a tracked counter-metric with an SLO |
| Sensitive personal facts in a service-role DB | Medium | `sensitive` flag, excluded from exports and AI context; single-user, no RLS exposure; local-first posture |

### Open questions for you

1. **Tier caps** — are 15 / 60 / 250 right for how you actually work, or is Inner too tight?
2. **The 837 untiered** — 10/day inside the Round (~5 weeks, low effort), or one 30-minute bulk pass to start with a clean portfolio?
3. **Gmail scope** — metadata-only as specified, or do you want subject lines *and* an opt-in body read for draft quality?
4. **Session timing** — is this a morning-coffee ritual or an end-of-day one? Changes whether the Round leads with `CONFIRM` (retrospective) or `RECONNECT` (prospective).
5. **`ask`/`offer` cards** — worth the extra taxonomy, or does a single `interest` kind cover it in practice?
6. **Phone-first corpus** — 930 have phones and 12 have emails. Should the Round default to *"text them"* rather than *"draft an email"*?
7. **Name** — `orrery`, or something else? It fits the `ephemeris` convention, but you own the naming.
8. **iCloud round-trip** — should `orrery` ever write back to iCloud Contacts, or stay strictly downstream?

---

## Appendix A — What I deliberately left out

- **Social-media monitoring** (LinkedIn/X scraping). ToS violations, brittle, and the signal-to-noise is poor. Manual `MILESTONE` entry covers the same ground honestly.
- **Sentiment analysis of email bodies.** Creepy, inaccurate, and it would require the body access this design deliberately avoids.
- **Automated birthday messages.** An automated birthday message is worse than no birthday message.
- **A relationship "score" per person.** Reducing a person to a number is both offensive and useless. Tiers are commitments of attention; SQS (if revived) rates professional capability, which is a different and legitimate thing.
- **Team/sharing features.** Single-operator by design.
- **Force-directed network visualization.** See §4.9 — pretty, unreadable, answers nothing.

## Appendix B — Prerequisites before Phase 1

1. **Apply the missing `sqs`/flags migration.** `RUNBOOK.md` says ✅; the live DB says `42703: column contacts.sqs does not exist`. Fix the DB and correct the runbook.
2. **Push the three unpushed commits** and rotate the exposed Supabase service key (both already open in `RUNBOOK.md` §1–2).
3. **Back up `timeline_notes`** to a table and to a local JSON file before any migration touches it. 242 entries, no other copy.
4. **Decide the open questions in §10** — at minimum #1, #2, and #6, which change Phase 1's shape.
