#!/bin/bash
set -e
cd /opt/pluribus
echo '→ building...'
/root/.bun/bin/bun run build
echo '→ publishing...'
rm -rf /var/www/pluribus/*
cp -r dist/* /var/www/pluribus/
echo '✓ live at http://185.158.132.125'
