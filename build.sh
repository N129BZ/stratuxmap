#!/bin/bash
npm run build

distpath="/home/bro/sources/stratuxmap/dist"
stxexpresspath="/home/bro/sources/stratuxexpress/dist"
stxpath="/home/bro/sources/stratux-es6/stratux/web"

if [ "$EUID" -ne 0 ]; then
    mkdir -p "$stxexpresspath"
    cp -r -f "$distpath"/* "$stxexpresspath"
    echo "dist copied to $stxexpresspath"

    if [ -d "$distpath" ]; then
        cp -r -f "$distpath"/* "$stxpath"
        echo "dist copied to $stxpath"
    fi
fi

if [ "$EUID" -eq 0 ]; then
    cp -r -f "$distpath"/* /opt/stratux/www
    echo "dist copied to /opt/stratux/www"
else
    echo "RUN: sudo cp -r -f $distpath/* /opt/stratux/www"
fi