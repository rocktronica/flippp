# flippp

A deno script to make a flipbook PDF from a movie file using ffmpeg and Chrome.

Print it out, cut it up, staple, and flip!

## Usage

``` bash
# Install requirements
# (Here I'm using homebrew but, of course, you do you)
brew install deno
brew install ffmpeg

# Install Puppeteer's Chrome version
PUPPETEER_PRODUCT=chrome \
    deno run -A --unstable \
    https://deno.land/x/puppeteer@16.2.0/install.ts

# View help to see full flag list
deno run flippp.ts -h

# Flipbook with default "business card" layout options
deno run -A --unstable flippp.ts -i <input>

# Flipbook with big, full-bleed images
deno run -A --unstable flippp.ts -i <input> \
    --rows 3 --columns 1 \
    --pagePadding "0 0" --imageMargin 0 \
    --imageHeight 100% --imageWidth 7.5in \
    --crop false --imagePosition "center right"
```

Then:

1. Print output PDF at 100% scale on cardstock or, if using default options, business card paper.
1. If necessary, cut with a guillotine trimmer or similar; note that cutting guides are on-screen only and don't print.
1. Bind with a heavy-duty stapler. A binder clip works okay too.

### Notes

* Image dimensions are left up to the user and don't update based on layout.
* Double-sided flipbooks are possible using `pageSide` flag. Printing these can be tricky, so experiment with short books first to figure it out.

## License

MIT