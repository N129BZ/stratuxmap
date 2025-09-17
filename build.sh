#!/bin/bash
npm run build

distpath="/home/bro/sources/stratuxmap/dist"
stxexpresspath="/home/bro/sources/stratuxexpress/dist"
stxpath="/home/bro/sources/stratux-es6/stratux/web"
optpath="/opt/stratux/www"

if [ "$EUID" -ne 0 ]; then
    mkdir -p "$stxexpresspath"
    cp -r -f "$distpath"/* "$stxexpresspath"
    echo "dist copied to $stxexpresspath"

    if [ -d "$distpath" ]; then
        mkdir -p "$stxpath"
        cp -r -f "$distpath"/* "$stxpath"
        echo "dist copied to $stxpath"
    fi
fi

if [ "$EUID" -eq 0 ]; then
    mkdir -p "$optpath"
    cp -r -f "$stxpath"/* "$optpath"
    echo "dist copied to $optpath"
else
    echo "RUN: sudo cp -r -f $distpath/* /opt/stratux/www/map"
fi