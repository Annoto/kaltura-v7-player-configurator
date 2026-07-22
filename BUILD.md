# Building the Windows one-click executable

The customer-facing deliverable is a single `AnnotoConfigurator.exe` — no Node.js,
no npm, no terminal needed on the customer's machine. They double-click it, their
default browser opens automatically at the configurator, done.

## Prerequisites (build machine only)
- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash` or `powershell -c "irm bun.sh/install.ps1 | iex"`)
- Node.js 18+ (for the embed step)

## Build
```bash
npm run build:win
```
This does two things:
1. `buildtools/embed-html.js` — embeds `public/index.html` into `buildtools/index_html.cjs`
   so the exe is fully self-contained.
2. `bun build --compile --target=bun-windows-x64` — bundles the server + Bun runtime
   into `dist/AnnotoConfigurator.exe` (~115 MB, ~40 MB zipped).

Cross-compilation works: you can build the Windows exe from macOS or Linux.

## Shipping to customers
Zip the exe and send it:
```bash
cd dist && zip AnnotoConfigurator-vX.Y.Z-win-x64.zip AnnotoConfigurator.exe
```

Customer instructions (all of them):
1. Unzip the file
2. Double-click `AnnotoConfigurator.exe`
3. If Windows SmartScreen shows "Windows protected your PC" → click **More info** → **Run anyway**
   (this goes away if the exe is code-signed — see below)
4. The browser opens automatically; keep the black window open while working

## Recommended: code signing
Unsigned exes trigger the SmartScreen warning. To remove it, sign with an
Authenticode certificate (e.g. via `signtool sign /fd SHA256 /a AnnotoConfigurator.exe`).
An EV certificate removes the warning immediately; a standard one after reputation builds.
