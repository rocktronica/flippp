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

# Default "business card" layout options
deno run -A --unstable flippp.ts -i <input>

# Big and easy to cut
deno run -A --unstable flippp.ts -i <input> \
    --rows 3 --columns 1 \
    --pagePadding "0 0" --imageMargin .25in \
    --imageHeight 3.17in --imageWidth 7.5in \
    --crop false --imagePosition "center right"

# Baseball card size, square image, handle on top
deno run -A --unstable flippp.ts -i <input> \
    --rows 4 --columns 2 \
    --pagePadding ".5in .75in" \
    --imageHeight 2.38in --imageWidth 2.38in \
    --imageRotate -90deg
```

Then:

1. Print output PDF at 100% scale.
1. Default layout options fit standard "business card" paper, which won't need to be cut. Otherwise, cut with a paper trimmer.
1. Bind with a heavy-duty stapler. A binder clip works okay too.

### Notes

* Panel dimensions are derived from `rows` and `columns` count minus `pagePadding`
* "Handle" is always on the left but can be effectively changed with `imageRotate` option.
* Most options use CSS units/syntax, ie `1in 2in` means "1 inch on top and bottom, 2 inches on right and left"
* Image dimensions are left up to the user and don't update based on layout.
* Double-sided flipbooks are possible using `pageSide` flag. Printing these can be tricky, so experiment with short books first to figure it out.

## License

MIT