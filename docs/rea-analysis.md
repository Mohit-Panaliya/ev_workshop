# REA Analysis — PHP Garage App → Frappe PWA Migration Evidence

> Produced with [REA (Reverse Engineer Anything)](https://github.com/morluto/rea) v6.4.0,
> installed server-wide (`rea` on PATH, Chromium headless shell for Playwright).
> This document records what was observed at runtime (not just read from source),
> what differed from the Frappe PWA, and what was migrated as a result.

## 1. Tooling installed on this server

| Piece | State |
|---|---|
| `rea-agents@6.4.0` (npm global + `/usr/local/bin` symlinks) | ✅ installed |
| Playwright Chromium headless shell (v1.58.2 build) | ✅ `~/.cache/ms-playwright` |
| Binary engines (Hopper/Ghidra/IDA) | ❌ not installed — not needed for web analysis |
| MCP registration (`rea setup`, interactive) | ⏭️ skipped — CLI used directly; run `rea setup` to wire it into an agent client |

Verify any time: `rea doctor` (node/host healthy; engine checks fail closed as expected).

## 2. Captures performed (Evidence)

All scenarios run headless against the live sites, secrets via env vars (never on disk).

| # | Target | Scenario | Evidence |
|---|---|---|---|
| 1 | `https://test.indtools.in/login` | fill username + password (secret), submit, wait sidebar | login → `/dashboard` observed in `before_url`/`after_url` |
| 2 | PHP jobs page | login, goto `/job-cards`, wait `main`, capture a11y + screenshot + url | `ev_aa1b…` series; 1280×720 screenshot + accessibility tree retained |
| 3 | `https://evhub.indtools.in/evhub#/login` | same login flow (Administrator), service workers allowed (PWA) | login works; shell renders |
| 4 | PWA jobs page | login, goto `/evhub#/jobs`, wait `main table`, capture | screenshot + a11y retained |

Scenario files live in the agent workspace (`/tmp/opencode/rea_*.json`, deleted secrets after runs).

## 3. Runtime findings (beyond source reading)

1. **Login redirect is server-side 302** (`/login` → `/dashboard`), confirmed in navigation Evidence — the SPA's client-side redirect after `/api/method/login` matches this behavior exactly.
2. **PHP sidebar renders TWO `<aside>` elements** (desktop + mobile drawer). REA strict-mode locator failure on `aside` proved it; the PWA replicates both, including the hidden drawer.
3. **Active nav uses solid-weight heroicons**, inactive uses outline — confirmed from rendered HTML classes, not just Blade conditionals. PWA now swaps weights the same way.
4. **Filter inputs are plain** (`w-full border-gray-300 rounded-lg`, no `h-10`), unlike `x-text-input` components — caught from rendered DOM, not Blade source. PWA filter helpers corrected.
5. **Export dropdown width class is literally `64`** (and user dropdown `56`) — upstream quirk, replicated verbatim so computed layout matches.
6. **Jobs table has NO actions column** in PHP (actions live only in the selection bar) — PWA jobs table corrected to match; per-row actions kept only where PHP has them (customers/counters models).

## 4. Visual comparison (1280×720 screenshots)

| Area | PHP | PWA | Verdict |
|---|---|---|---|
| Logo / sidebar / active pill | GMS wordmark, 9 items, collapse + user footer | identical (own username shown, correct behavior) | ✅ match |
| Header + Import/Export buttons | outlined buttons, chevron | identical | ✅ match |
| Search row + indigo button | identical | identical | ✅ match |
| Filter panel (4-col) | From/To/Tech/Status + Brand/Payment/Type/PerPage + Hide-Delivered | Brand added this round; rest identical | ✅ match |
| Table header/row/badges/pager | checkbox, link, date, badges, right totals | identical | ✅ match |
| Analytics/Company in nav | **absent** (Analytics hidden by design) | Analytics was shown — **removed to match** | ✅ fixed |

## 5. Migration deltas applied from this analysis

- Sidebar: Analytics entry removed (route still live at `#/analytics`, as PHP keeps `/analytics` URL-live).
- Jobs: Vehicle Brand filter end-to-end (UI select + 3-hop backend chain + count + export).
- Icons: 26 outline + 26 solid vendored (active-state weights now correct).
- Filters/inputs split into component vs filter variants per rendered evidence.
- Numbered pagination, selection-bar behavior, export menu (All/Filtered/Template).

## 6. Known intentional divergences (not migrated)

- Status *values* (Frappe `Admitted…Completed` vs PHP `received…delivered`) — workflow truth differs; badges/design identical.
- Single-user lock vs Frappe roles; SQLite vs MariaDB; stock moves ON (ERPNext-native) vs PHP-disabled.
- Test-site data differs (PHP site empty; Frappe site has 1 live job) — screenshots compared structure, not rows.
