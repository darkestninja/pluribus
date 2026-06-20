#!/bin/bash
set -e
cd /opt/pluribus
echo '→ building...'
/root/.bun/bin/bun run build
echo '→ publishing...'
rm -rf /var/www/pluribus/assets /var/www/pluribus/index.html
cp -r dist/* /var/www/pluribus/
echo '✓ live at https://pluribus.danielasiegbunam.com'
