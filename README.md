# Annoto × Kaltura — Player Configurator

A small **local web tool** that configures a Kaltura **V7 player (uiConf)** so it
automatically loads the Annoto plugin — without editing anything per embed.

It performs the two changes Kaltura PS confirmed are required, via the Kaltura API:

1. **`confVars.versions`** → adds `"playkit-annoto-loader": "{latest}"`
   (this field is **not** editable in the KMC UI).
2. **`config.plugins["annoto-loader"]`** → sets the plugin config (`clientId`,
   `region`).

Both merges are **non-destructive**: existing plugin versions, other plugins, and
other config keys are preserved. Once applied, every embed code KMC generates for
that player includes Annoto — so it works inside the Kaltura iframe embedded in
SharePoint's Embed web part, with no host-page script.

## Requirements

- Node.js **18+** (uses the built-in `fetch`).
- Your Kaltura **Partner ID** and **admin secret** (KMC → Settings → Integration
  Settings).

## Run

```sh
cd annoto-kaltura-configurator
npm install
npm start
```

Then open **<http://127.0.0.1:8090>** in your browser.

1. Enter Partner ID + admin secret (Service URL default is fine for SaaS).
2. Enter the **Player / uiConf ID** you want to enable, and the Annoto
   **clientId**.
3. Click **Preview** — it starts a Kaltura session, reads the player, and shows
   exactly what would change (nothing is written).
4. Click **Apply** to write the change, then it re-reads the player to **verify**.

### Options

- **Also set the plugin config** (default on) — writes `clientId`/`region`. Turn
  off if you only want the `confVars.versions` entry and will set the config in
  KMC yourself.
- **Clone into a new dedicated player** — duplicates the player first and applies
  the change to the copy, leaving the original untouched. The new player's ID is
  returned so you can use it in KMC.
- **Plugin version** — defaults to `{latest}`; set a pinned version if needed.

## Security

- Runs **only on `127.0.0.1`**. The admin secret is sent to this local server to
  start a Kaltura session and is **never stored** (not written to disk, not
  logged).
- Prefer **Preview** before **Apply**. Consider the **Clone** option so you never
  touch a production player directly.
- `.env` and `node_modules` are gitignored; there are no committed secrets.

## How it works (API)

`session.start` (ADMIN) → `uiConf.get` → merge `confVars` + `config` →
`uiConf.update` (or `uiConf.clone` first) → `uiConf.get` to verify.

Naming note: the **bundler/versions** key is `playkit-annoto-loader`; the
**runtime config** key is `annoto-loader` (both defaults are set for you).

## Tests

```sh
npm test   # unit tests for the non-destructive merge logic
```

## Files

```
server.js            Express server (localhost), /api/preview + /api/apply
lib/kaltura.js       Kaltura API helpers + merge logic
public/index.html    The web UI
test/merge.test.js   Merge-logic unit tests
```
