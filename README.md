# Annoto × Kaltura — Player Configurator

A small **local web tool** that configures a Kaltura **V7 player (uiConf)** so it
automatically loads the **Annoto** plugin — turning a multi-step, API-only Kaltura
change into a form you fill in and click.

Once a player is configured, **every embed code KMC generates for it includes
Annoto automatically** — including the plain **iframe embed**, so Annoto works
inside a Kaltura video embedded in **SharePoint's Embed web part** with no
host-page script.

![Annoto × Kaltura Player Configurator UI](docs/ui-screenshot.png)

## What it does

To make a Kaltura V7 player load a plugin without touching each embed, two fields
on the player's `uiConf` have to be set (confirmed with Kaltura PS). This tool
sets both, via the Kaltura API:

1. **`confVars.versions`** → adds `"playkit-annoto-loader": "{latest}"`.
   This tells the player bundler to include the Annoto plugin in the JS bundle.
   **This field is not editable in the KMC UI** — it can only be set via the API,
   which is the main reason this tool exists.
2. **`config.plugins["annoto-loader"]`** → sets the plugin's runtime config
   (`clientId`, `region`). This part *can* be done in KMC, but the tool does it
   for you in the same step.

Both changes are **non-destructive merges**: any existing plugin versions, other
plugins, and other config keys are preserved — the tool only adds/updates the
Annoto entries.

## Requirements

- **Node.js 18+** (uses the built-in `fetch`). Check with `node -v`; install from
  <https://nodejs.org> if needed.
- Your Kaltura **Partner ID** and **admin secret** — in KMC under
  **Settings → Integration Settings**.

## Run it

```sh
# 1. Go to the project folder
cd kaltura-v7-player-configurator

# 2. Install dependencies (first time only)
npm install

# 3. Start the tool
npm start
```

Then open **<http://127.0.0.1:8090>** in your browser.

## Using it

1. **Kaltura account** — enter your **Partner ID** and **admin secret**. Leave
   **Service URL** as the default (`https://cdnapisec.kaltura.com`) for Kaltura
   SaaS; change it only for a dedicated/on-prem service URL.
2. **Player / uiConf ID** — the player you want to enable Annoto on.
3. **Annoto clientId** — your Annoto API key (JWT), and pick the **Region**
   (`eu` / `us` / `staging`).
4. Click **Preview** — the tool starts a Kaltura session, reads the player, and
   shows exactly what would change. **Nothing is written.**
5. Click **Apply** — writes the change, then re-reads the player to **verify** the
   plugin is now listed.

### Options

- **Also set the plugin config (clientId / region)** — on by default. Turn it off
  if you only want the `confVars.versions` entry and prefer to set the config in
  KMC yourself.
- **Clone into a new dedicated player** — duplicates the player first and applies
  the change to the copy, leaving the original untouched. The new player's ID is
  returned so you can use it in KMC. Recommended for a safe first run.

## Security

- Runs **only on `127.0.0.1`** (local machine). Your **admin secret** is sent to
  this local server to start a Kaltura session and is **never stored** — not
  written to disk, not logged.
- Always use **Preview** before **Apply**. Prefer the **Clone** option so you
  never edit a production player directly.
- `.env` and `node_modules` are gitignored; there are no committed secrets.

## How it works (Kaltura API)

```
session.start (ADMIN)  →  uiConf.get  →  merge confVars + config
   →  uiConf.update  (or uiConf.clone first)  →  uiConf.get  (verify)
```

Naming note: the **bundler / versions** key is `playkit-annoto-loader`; the
**runtime config** key is `annoto-loader`. Both defaults are set for you.

## Tests

```sh
npm test   # unit tests for the non-destructive merge logic
```

## Project structure

```
server.js            Express server (localhost), /api/preview + /api/apply
lib/kaltura.js       Kaltura API helpers + non-destructive merge logic
public/index.html    The web UI
test/merge.test.js   Merge-logic unit tests
docs/ui-screenshot.png   UI preview used in this README
```

## License

MIT
