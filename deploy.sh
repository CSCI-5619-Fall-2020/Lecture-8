#!/bin/sh

USER="suma"
MACHINE="csel-kh1250-02.cselabs.umn.edu"
DIRECTORY=".www/Lecture-8/"

rm -rf dist/assets
cp -r assets dist/assets
rsync -avr --delete --chmod=D701,F644 dist/ "$USER"@"$MACHINE":"$DIRECTORY"