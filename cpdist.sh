#!/bin/bash

# Source and destination directories
DIST="/home/bro/sources/stratuxmap/dist"
DEST="/home/bro/sources/stratux-es6/stratux/web"
STXDEST="/opt/stratux/www"
# Create destination directory if it doesn't exist
# mkdir -p "$DEST"

# Copy JS and CSS files
cp "$DIST/map.js" "$DIST/map.css" "$DIST/map.js.map" "$DEST"


echo "Files copied to: $DEST"

if [ "$EUID" -eq 0 ]; then
  cp "$DIST/map.js" "$DIST/map.css" "$DIST/map.js.map" "$STXDEST"
  echo "Files copied to: $STXDEST"  
else
  echo "Files NOT copied to $STXDEST, user is not running as sudo."
fi