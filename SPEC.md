# Annoto × Kaltura Player Configurator – SPEC

**Version:** 1.0.0 | **Status:** Production Ready | **Updated:** 2026-07-22

## 1. Overview

A **local web tool** that configures Kaltura V7 players (uiConf) to automatically load the Annoto plugin.

### Key Features
- **Non-destructive merges** — preserves existing plugins
- **Local-only execution** — secrets never leave machine
- **Preview-before-apply** — verifies before writing
- **Clone mode** — safely test on player copy
- **SharePoint-compatible** — works in Kaltura iframe embeds

## 2. Functional Architecture

### Two Core Operations

**1. Add Plugin to Bundler** (`confVars.versions`)
- Adds `"playkit-annoto-loader": "{version}"`
- Not editable in KMC UI — API-only operation

**2. Set Plugin Config** (`config.plugins["annoto-loader"]`)
- Sets runtime config: `{ clientId, region }`
- Optional — can configure in KMC manually

## 3. Technical Stack

- **Runtime:** Node.js 18+
- **Server:** Express.js 4.19+
- **Frontend:** Vanilla HTML/CSS/JS
- **Hosting:** Local (127.0.0.1:8090)
- **Dependencies:** express ^4.19.2

## 4. Project Structure

```
server.js                    Express server, route handlers
lib/kaltura.js              Kaltura API integration + merge logic
public/index.html           Web UI
test/merge.test.js          Unit tests for merge functions
docs/ui-screenshot.png      UI preview
README.md                   User documentation
SPEC.md                     Technical specification
PROJECT_REVIEW.md           Code review & assessment
package.json                Dependencies
.gitignore                  Git exclusions
```

## 5. API Routes

### POST /api/preview
Show what changes would be applied without modifying anything.

**Request:** { serviceUrl, partnerId, adminSecret, uiConfId, version, clientId, region, setConfig, mode }

**Response:** { ok, mode, current, plan }

### POST /api/apply
Apply changes, optionally clone, and verify.

**Response:** { ok, cloned, targetId, applied, verified }

## 6. Security Model

- ✅ Local-only: Bound to 127.0.0.1
- ✅ No persistence: Secrets held in memory
- ✅ No env config: All inputs via UI
- ✅ Preview pattern: Enforced before apply
- ✅ Clean git: .env and node_modules gitignored

## 7. Installation & Usage

```bash
npm install
npm start
# Open http://127.0.0.1:8090
```

Test: `npm test`

## 8. Requirements

- Node.js 18+ (built-in fetch required)
- Kaltura Account (Partner ID + Admin Secret)
- Annoto API Key (JWT clientId) + Region
- Existing V7 Player (uiConfId)

## 9. Best Practices

✅ DO:
- Use Clone mode to test first
- Always preview before apply
- Verify player ID before proceeding
- Enter credentials fresh each session

❌ DON'T:
- Save credentials to auto-fill
- Share URL or credentials
- Run on public networks
- Commit secrets to git

## Version History

- **1.0.0** (2026-07-22) — Initial release

---

**Production Ready**
