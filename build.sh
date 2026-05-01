#!/bin/bash
npm run build

distpath="/home/bro/sources/stratuxmap/dist"
expresspath="/home/bro/sources/stratuxexpress/dist"

mkdir -p "$expresspath"

cp -r -f "$distpath"/* "$expresspath"
echo "dist copied to $expresspath"
