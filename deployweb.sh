#!/bin/bash
# Copy contents of stratux/map into /opt/stratux/www

SRC_DIR="$(dirname "$0")/stratux/map"
DEST_DIR="/opt/stratux/www"

# Copy all contents, preserving permissions and attributes
cp -a "$SRC_DIR/." "$DEST_DIR/"

echo "Contents of $SRC_DIR copied to $DEST_DIR."
