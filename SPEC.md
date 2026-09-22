# Annoto × Kaltura Player Configurator – SPEC

**Version:** 1.1.0 | **Status:** Production Ready (shipped as a Windows one-click exe) | **Updated:** 2026-09-22 (as-built; code last changed 2026-07-23)

## 1. Overview

A **local web tool** that configures Kaltura V7 players (uiConf) to load the Annoto plugin —
and, since 1.1.0, to *check* and to *remove* that configuration. Runs on the operator's own
machine; the customer receives a single self-contained `AnnotoConfigurator.exe`.

### Key Features
- **Six operation modes** — `update-both` · `update-versions-only` · `update-config-only` · `clean-all` · `clean-versions-only` · `clean-config-only` (1.1.0)
- **Status checker** — `GET /api/check` reads the player and reports, with ✅/❌, whether the bundler version and the runtime config are present (1.1.0)
- **Before / after comparison** — colour-coded diff of `confVars` and `config` in the preview (1.1.0)
- **Non-destructive merges** — preserves every other plugin and setting
- **Local-only execution** — bound to `127.0.0.1`; secrets never leave the machine or persist
- **Preview-before-apply** — the plan is shown and the write is a second step
- **Clone mode** — apply to a copy of the player first
- **SharePoint-compatible** — works with Kaltura iframe embeds
- **One-click Windows build** — no Node.js on the customer's machine (1.1.0)

## 2. Functional Architecture

### Two Core Operations

**1. Bundler version** (`confVars.versions`)
- Adds or removes `"playkit-annoto-loader": "{version}"`
- Not editable in the KMC UI — API-only operation

**2. Runtime config** (`config.plugins["annoto-loader"]`)
- Sets or removes `{ clientId, region }`
- Optional — can be configured in KMC manually

### Operation modes

| Mode | Bundler version | Runtime config | Needs `clientId` |
|---|---|---|---|
| `update-both` (default) | set | set | yes |
| `update-versions-only` | set | untouched | no |
| `update-config-only` | untouched | set | yes |
| `clean-all` | removed | removed | no |
| `clean-versions-only` | removed | untouched | no |
| `clean-config-only` | untouched | removed | no |

### The three-step UI
1. **Connect & check** — service URL, partner ID, admin secret, player ID → current Annoto status.
2. **Choose & preview** — mode, version, clientId/region, optional clone → plan + before/after diff.
3. **Apply & verify** — writes (to the clone if chosen), re-reads the player, confirms.

## 3. System Architecture

```
 Operator's machine (or the customer's, as the exe)
 ┌───────────────────────────────────────────────────────────────────────────┐
 │  Browser  ──── http://127.0.0.1:8090 ────▶  server.js (Express 4.19)      │
 │  public/index.html                          GET  /            the UI      │
 │  (vanilla HTML/CSS/JS, 3 steps,             GET  /api/check   status      │
 │   status icons, diff view)                  POST /api/preview plan+diff   │
 │                                             POST /api/apply   write+verify│
 │                                                  │                        │
 │                                             lib/kaltura.js                │
 │                                             session · getUiConf · merge   │
 │                                             checkAnnotoStatus · clone     │
 └──────────────────────────────────────────────────┼────────────────────────┘
                                                    │ HTTPS, admin-secret KS per request
                                                    ▼
                                    Kaltura API  (uiConf get / clone / update)
                                    default serviceUrl, overridable per request

 Build (operator only):  buildtools/embed-html.js  → buildtools/index_html.cjs  (UI baked in)
                         bun build --compile --target=bun-windows-x64 buildtools/entry.cjs
                         → dist/AnnotoConfigurator.exe  (~115 MB; ~40 MB zipped)
                         build-release.sh → dist/AnnotoConfigurator-v<version>-win-x64.zip
```

- **No state.** Credentials arrive with each request (query for `/api/check`, body for the POSTs), are used to open a Kaltura session, and are not written anywhere.
- **Merge logic is pure** (`lib/kaltura.js`) and unit-tested (`test/merge.test.js`) independently of the network.
- **The exe embeds the UI** — `global.__ANNOTO_HTML__` is served at `/`, so the binary has no files beside it. On start it opens the default browser; if the port is busy it says the app is already running.

## 4. Technical Stack

- **Runtime:** Node.js 18+ (built-in `fetch`) for `npm start`; **Bun** on the build machine only, to cross-compile the Windows exe from any OS
- **Server:** Express.js 4.19+
- **Frontend:** Vanilla HTML/CSS/JS, single file
- **Hosting:** Local (`127.0.0.1:8090`)
- **Dependencies:** `express ^4.19.2`

## 5. Project Structure

```
server.js                    Express server, route handlers, auto-open + port-busy handling
lib/kaltura.js               Kaltura API integration + merge / clean / status logic
public/index.html            Web UI (embedded into the exe at build time)
buildtools/embed-html.js     Bakes public/index.html into buildtools/index_html.cjs
buildtools/entry.cjs         Exe entry point
build-release.sh             One-command release: prerequisites → build:win → zip
BUILD.md                     Build + shipping notes (SmartScreen / code-signing)
test/merge.test.js           Unit tests for merge functions
docs/ui-screenshot.png       UI preview
README.md                    User documentation
SPEC.md                      This document
PROJECT_REVIEW.md            Code review & assessment
dist/                        Built exe + zip (git-ignored)
```

## 6. API Routes

### GET /api/check
Read the player and report its Annoto state without changing anything.

**Query:** `serviceUrl?`, `partnerId`, `adminSecret`, `uiConfId`

**Response:** `{ ok, player: { id, name }, annoto: { …status }, currentConfVars, currentConfig }`

### POST /api/preview
Show what changes would be applied without modifying anything.

**Request:** `{ serviceUrl, partnerId, adminSecret, uiConfId, version, clientId, region, operationMode, mode }`

**Response:** `{ ok, operationMode, mode, current, plan }` — `plan` carries the before/after the UI diffs

### POST /api/apply
Apply changes, optionally to a clone, and verify by re-reading.

**Response:** `{ ok, operationMode, cloned, targetId, applied, verified }`

Validation is shared (`pickInputs`): the config-setting modes require `clientId`; every route requires partner ID, admin secret and player ID and answers `400` with a list of errors.

## 7. Security Model

- ✅ Local-only: bound to `127.0.0.1`
- ✅ No persistence: secrets held in memory for the request only
- ✅ No env config: all inputs via the UI
- ✅ Preview pattern: enforced before apply
- ✅ Clone mode: test on a copy first
- ✅ Clean git: `.env`, `node_modules`, `dist/` ignored
- ⚠️ The exe is unsigned — Windows SmartScreen warns on first run (see `BUILD.md` for code-signing)

## 8. Installation & Usage

Operator (from source):

```bash
npm install
npm start
# Open http://127.0.0.1:8090
```

Customer (Windows): unzip `AnnotoConfigurator-v1.1.0-win-x64.zip`, double-click
`AnnotoConfigurator.exe`, the browser opens at the configurator. Nothing to install.

Build the exe: `npm run build:win` (needs Bun) or `./build-release.sh`. Test: `npm test`.

## 9. Requirements

- Node.js 18+ (source) — or nothing at all (exe)
- Kaltura account (Partner ID + Admin Secret)
- Annoto API key (JWT `clientId`) + region
- An existing V7 player (`uiConfId`)

## 10. Brand book

The configurator is an **operator utility**, not a marketing surface; it borrows Annoto's ink
and stays otherwise neutral. The canonical Annoto brand lives in the website repo:

| Source | Where | What it fixes |
|---|---|---|
| Annoto design tokens | `../annoto-website/design_handoff_annoto_website/README.md` → *Design Tokens* and *Brand rules* | Coral `#F1615C` (tint `#ED7571`, shade `#E6534E`); yellow accent `#FFD15A`; illustration teal `#0AC6BF` **only inside SVG artwork**; ink `#16181A` / `#3B3F45` / `#6B7280`; hairline `#E2E2E5`; **Poppins only**; radii 8/12/20/28/pill; neutral-ink shadows; spring motion `cubic-bezier(0.2,0.8,0.2,1)`; the wordmark is never re-typeset |
| Decisions and amendments | `../annoto-website/DESIGN-DECISIONS.md` | Coral is the token not a hex; teal `#007D78` is the button surface (AA with white); one neutral shadow system; no gradients as UI surfaces; type scale in variables |
| Illustration system | `../annoto-website/feature-assets/` (the SVG hero/card art) and the handoff's `assets/illus/` (25 SVGs) | Flat two-colour (coral + teal) + yellow accent, no gradients, no characters; scene images at radius 28 px |

**Where this tool stands against it.** `public/index.html` uses ink `#16181A` and Annoto-adjacent
surfaces (`#F5F7F8`, `#EEF0F2`) but sets **Roboto**, not Poppins, and uses its own utility
palette for status — green `#1C7A43`, amber `#8A6D1B` / `#FFDB80`, red `#B3300F` / `#FDECEA`.
That is acceptable for an internal/operator tool; if the exe is ever put in front of customers as
an Annoto-branded product, switch the face to Poppins and the primary action to teal `#007D78`
per the website tokens, and keep coral out of status colours (it is the brand, not a warning).

## 11. Best Practices

✅ DO:
- Run `/api/check` first — know what is there before choosing a mode
- Use Clone mode to test first
- Always preview before apply
- Verify the player ID before proceeding
- Enter credentials fresh each session

❌ DON'T:
- Save credentials to auto-fill
- Share the URL or credentials
- Run on public networks
- Commit secrets to git
- Ship a `dist/` zip built from an uncommitted tree

## Version History

- **1.1.0** (2026-07-22/23) — Six operation modes (update / clean × both / versions / config), `GET /api/check` status checker, before/after comparison view, redesigned 3-step UI, clone mode surfaced; one-click Windows executable (Bun cross-compile, UI embedded, auto-opens the browser, port-busy handling); `build-release.sh` one-command release; `BUILD.md`.
- **1.0.0** (2026-07-22) — Initial release.

---

**Production Ready**
