#!/bin/bash
npm run build

distpath="/home/bro/sources/stratuxmap/dist"
stxpath="/home/bro/sources/stratux"

if [ -d "$distpath" ]; then
    cp -r -f dist "$stxpath"
    echo "dist copied to $stxpath"
fi

echo "RUN: sudo cp -r -f dist /opt/stratux/www"
