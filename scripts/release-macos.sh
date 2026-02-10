#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEME="angle-rfp"
PROJECT="$ROOT_DIR/angle-rfp.xcodeproj"

DIST_DIR="$ROOT_DIR/dist"
WORK_DIR="$(mktemp -d /tmp/angle-rfp-release.XXXXXX)"
ARCHIVE_PATH="$WORK_DIR/${SCHEME}.xcarchive"

ZIP_OUT="$DIST_DIR/${SCHEME}-macos.zip"
DMG_OUT="$DIST_DIR/${SCHEME}-macos.dmg"

echo "== angle-rfp macOS release build =="
echo "Project: $PROJECT"
echo "Scheme:  $SCHEME"
echo "Work:    $WORK_DIR"
echo "Dist:    $DIST_DIR"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo
echo "-> Archiving (Release)"
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  archive

APP_PATH="$ARCHIVE_PATH/Products/Applications/${SCHEME}.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "ERROR: expected app at $APP_PATH"
  exit 1
fi

STAGE_DIR="$WORK_DIR/stage"
mkdir -p "$STAGE_DIR"
cp -R "$APP_PATH" "$STAGE_DIR/${SCHEME}.app"

if [[ -n "${MACOS_SIGNING_IDENTITY:-}" ]]; then
  echo
  echo "-> Signing with: $MACOS_SIGNING_IDENTITY"
  # Prefer Xcode signing, but allow post-sign for local packaging.
  codesign --force --options runtime --timestamp --sign "$MACOS_SIGNING_IDENTITY" "$STAGE_DIR/${SCHEME}.app"
  codesign --verify --deep --strict --verbose=2 "$STAGE_DIR/${SCHEME}.app"
fi

echo
echo "-> Creating zip: $ZIP_OUT"
ditto -c -k --sequesterRsrc --keepParent "$STAGE_DIR/${SCHEME}.app" "$ZIP_OUT"

echo
echo "-> Creating dmg: $DMG_OUT"
hdiutil create -volname "$SCHEME" -srcfolder "$STAGE_DIR" -ov -format UDZO "$DMG_OUT" >/dev/null

if [[ -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_PASSWORD:-}" ]]; then
  echo
  echo "-> Notarizing zip (this can take a few minutes)"
  xcrun notarytool submit "$ZIP_OUT" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" --wait

  echo
  echo "-> Stapling notarization ticket"
  xcrun stapler staple "$STAGE_DIR/${SCHEME}.app"

  echo
  echo "-> Re-packaging stapled app"
  ditto -c -k --sequesterRsrc --keepParent "$STAGE_DIR/${SCHEME}.app" "$ZIP_OUT"
  hdiutil create -volname "$SCHEME" -srcfolder "$STAGE_DIR" -ov -format UDZO "$DMG_OUT" >/dev/null
fi

echo
echo "✅ Release artifacts created:"
echo "  - $ZIP_OUT"
echo "  - $DMG_OUT"

