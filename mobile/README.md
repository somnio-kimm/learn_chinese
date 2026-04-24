# Mobile (iOS/Android) wrapper

This directory wraps the `../web` app into native iOS/Android shells using Capacitor.

## Prereqs
- iOS: Xcode installed
- Android: Android Studio installed

## Common commands

```bash
cd mobile
npm install
npm run sync
```

Open native projects:

```bash
npm run open:ios
npm run open:android
```

## Web assets & data
- The web app lives in `../web`
- Vocabulary files are `../web/data/hsk-{1..7}.json` (built by `npm run build:hsk` from the repo root; not copied from `../data/`)

