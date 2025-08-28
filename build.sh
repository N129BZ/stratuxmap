#!/bin/bash
npm run build
cp -r -f dist /home/bro/sources/stratuxexpress/
echo "Build and copy /dist to stratuxexpress COMPLETE!"
