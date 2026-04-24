# Contributing

Thanks for helping improve this project.

## Conventions

Branch names, commit messages, and PR titles follow the rules in [REVIEW.md](REVIEW.md).

## Development setup

```bash
npm install
cd mobile && npm install
```

## Data build

```bash
npm run build:hsk:web
```

## Mobile build

```bash
cd mobile
npm run sync
npm run open:ios
npm run open:android
```

## Before opening a PR

- Open PRs against `dev`.
- Use the PR template; fill in every section.
- Link the related issue with `Closes #<n>` when applicable.
- Keep the PR focused on a single feature (see `REVIEW.md` §3).

## Issues

- **Bugs** — use the bug report template.
- **Features** — use the feature request template.
- **Security** — do NOT open a public issue. See [SECURITY.md](SECURITY.md).
