# Release macOS App (Downloadable)

There are two “levels” of distribution:

1. **Unsigned**: fastest for internal testing (users must bypass Gatekeeper).
2. **Signed + Notarized (recommended)**: “legit” downloadable app experience.

## Build Unsigned (Local)

```bash
./scripts/release-macos.sh
```

Outputs in `dist/`:
- `angle-rfp-macos.zip`
- `angle-rfp-macos.dmg`

## Signed + Notarized (Recommended)

Prereqs:
- Apple Developer account
- Developer ID Application certificate installed in Keychain
- Notarization credentials

Set env vars and run:

```bash
export MACOS_SIGNING_IDENTITY="Developer ID Application: <Your Name> (<TEAMID>)"
export APPLE_ID="you@company.com"
export APPLE_TEAM_ID="<TEAMID>"
export APPLE_APP_PASSWORD="<app-specific-password>"

./scripts/release-macos.sh
```

If notarization succeeds, the script staples the notarization ticket to the app.

## Publish (GitHub Releases)

1. Create a tag:
```bash
git tag v0.1.0
git push origin v0.1.0
```

2. GitHub Actions will build `dist/*` and attach artifacts to a release.

Note: signing/notarization in CI requires adding Apple credentials as GitHub Actions secrets.

