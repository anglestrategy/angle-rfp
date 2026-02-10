#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${1:-}"

if [[ -z "$SRC" ]]; then
  echo "Usage: $0 /absolute/path/to/icon-1024.png" >&2
  exit 2
fi

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: icon file not found: $SRC" >&2
  exit 2
fi

DEST_DIR="$ROOT_DIR/angle-rfp/Assets.xcassets/AppIcon.appiconset"
CONTENTS_JSON="$DEST_DIR/Contents.json"

if [[ ! -d "$DEST_DIR" ]]; then
  echo "ERROR: app icon set not found: $DEST_DIR" >&2
  exit 2
fi

width="$(sips -g pixelWidth "$SRC" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
height="$(sips -g pixelHeight "$SRC" 2>/dev/null | awk '/pixelHeight/ {print $2}')"

if [[ -z "${width:-}" || -z "${height:-}" ]]; then
  echo "ERROR: unable to read image dimensions (is this a valid PNG?): $SRC" >&2
  exit 2
fi

if [[ "$width" != "$height" ]]; then
  echo "ERROR: icon must be square (got ${width}x${height}): $SRC" >&2
  exit 2
fi

if [[ "$width" != "1024" ]]; then
  echo "ERROR: expected 1024x1024 icon, got ${width}x${height}: $SRC" >&2
  exit 2
fi

echo "Generating AppIcon assets from: $SRC"
echo "Destination: $DEST_DIR"

gen() {
  local size="$1"
  local out="$2"
  sips -z "$size" "$size" "$SRC" --out "$DEST_DIR/$out" >/dev/null
}

gen 16  "icon_16.png"
gen 32  "icon_16@2x.png"
gen 32  "icon_32.png"
gen 64  "icon_32@2x.png"
gen 128 "icon_128.png"
gen 256 "icon_128@2x.png"
gen 256 "icon_256.png"
gen 512 "icon_256@2x.png"
gen 512 "icon_512.png"
cp -f "$SRC" "$DEST_DIR/icon_512@2x.png"

cat >"$CONTENTS_JSON" <<'JSON'
{
  "images" : [
    {
      "filename" : "icon_16.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "16x16"
    },
    {
      "filename" : "icon_16@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "16x16"
    },
    {
      "filename" : "icon_32.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "32x32"
    },
    {
      "filename" : "icon_32@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "32x32"
    },
    {
      "filename" : "icon_128.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "128x128"
    },
    {
      "filename" : "icon_128@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "128x128"
    },
    {
      "filename" : "icon_256.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "256x256"
    },
    {
      "filename" : "icon_256@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "256x256"
    },
    {
      "filename" : "icon_512.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "512x512"
    },
    {
      "filename" : "icon_512@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "512x512"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON

plutil -lint "$CONTENTS_JSON" >/dev/null

echo "✅ AppIcon assets generated."
