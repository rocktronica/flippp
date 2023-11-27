#!/bin/bash

{

# Exit on error
set -o errexit
set -o errtrace

# Install puppeteer's chrome
PUPPETEER_PRODUCT=chrome \
    deno run -A --unstable \
    https://deno.land/x/puppeteer@16.2.0/install.ts \
    1> /dev/null

# Run, passing all arguments
deno run \
    --allow-run --allow-read --allow-write --allow-env --allow-net --unstable \
    make.ts ${@}

}