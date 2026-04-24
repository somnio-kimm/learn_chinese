# learn_chinese

Web-first HSK vocabulary app. A single `web/` codebase ships to:

- **Web / PWA**
- **iOS** (Capacitor wrapper)
- **Android** (Capacitor wrapper)

## Layout

```text
.
├── web/                   # The app (static assets)
│   └── data/              # Vocabulary JSON consumed at runtime (hsk-{1..7}.json)
├── data/                  # Augment tooling (augment.json, augment/parts/) — not copied into web/data
├── scripts/               # Data build scripts
├── mobile/                # Capacitor wrapper
│   ├── ios/
│   └── android/
└── package.json           # Root dev scripts (build:hsk, sync:web-data, ...)
```

## Data workflow

The web runtime loads `web/data/hsk-{1..7}.json`. `npm run build:hsk` fetches upstream and writes **only** into `web/data/`, so repo-root `data/hsk-*.json` does not replace the web bundle.

```bash
npm run build:hsk:web
```

## Mobile workflow

```bash
cd mobile
npm install
npm run sync
npm run open:ios
npm run open:android
```

## Conventions

See [REVIEW.md](REVIEW.md) for branch, commit, and PR conventions, and [CONTRIBUTING.md](CONTRIBUTING.md) for the dev loop.
