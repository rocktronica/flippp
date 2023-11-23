#!/bin/bash

{

# Exit on error
set -o errexit
set -o errtrace

# Constants
timestamp=$(date +%s)
commit_hash=$(git log -n1 --format="%h")
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Option defaults
# TODO: DRY against built_html.py
input=""
dir=""
fps="4"
rows="5"
columns="2"
order="alphanumeric"
page_side="front"

# Local variables, set later
_output_slug=""
_server_pid=""
_frame_count="0"
_page_count="0"

function _help() {
    echo "\
Make flipbook from video

Usage:
./make.sh [-h] [-f fps] [-f path] [-r rows] [-c columns]

Usage:
./make.sh                    Run!
./make.sh -h                 Show this message and quit
./make.sh -i <input>         Input file path (Required)
./make.sh -d <directory>     Output directory
./make.sh -f <fps>           Frames/second (Default: ${fps})
./make.sh -r <rows>          Panel rows/sheet (Default: ${rows})
./make.sh -c <columns>       Panel columns/sheet (Default: ${columns})
./make.sh -o <order>         Panel order (Default: ${order})
./make.sh -s <page_side>     Front or back (Default: ${page_side})

Examples:
./make.sh -i path/to/file.mp4 -f 2
"
}

function _make_folder() {
    echo "Creating output directory ${dir}"
    mkdir -pv "${dir}" 1> /dev/null
    echo
}

function _extract_frames() {
    echo "Extracting frames"
    ffmpeg -i "${input}" \
        -vf fps="${fps}" \
        -hide_banner -loglevel error \
        "${dir}/%04d.png"

    _frame_count=$(find "${dir}"/*.png | wc -l | xargs)

    echo "  - ${_frame_count} frames extracted"

    echo
}

function _build_html() {
    echo "Building HTML"

    deno run --allow-read --allow-write build_html.ts \
        --title "${_output_slug}" \
        --directory "${dir}" \
        --rows "${rows}" \
        --columns "${columns}" \
        --order "${order}" \
        --pageSide "${page_side}"

    echo "  - Built to ${dir}/index.html"

    # TODO: fix math, hehe
    _page_count=$(echo "${_frame_count} / (${columns} * ${rows})" | bc)
    echo "  - Expecting ${_page_count} page(s)"

    echo
}

function _export_pdf() {
    echo "Export PDF"

    echo "  - Starting server"
    pushd "${dir}" &> /dev/null
    python3 -m http.server 9002 &> /dev/null &
    _server_pid=$!
    popd &> /dev/null

    echo "  - Server at PID ${_server_pid}"
    sleep 1

    # TODO: use puppeteer, ditch PID stuff
    echo "  - \"Printing\" to PDF via Chrome"
    "$chrome" \
        --headless \
        --print-to-pdf="${dir}/${_output_slug}.pdf" \
        "http://localhost:9002" \
        2> /dev/null

    echo "  - PDF at ${dir}/${_output_slug}.pdf"

    echo "  - Stopping PID ${_server_pid}"
    kill "${_server_pid}"

    echo
}

function _report() {
    start="$1"
    end=$(date +%s)
    runtime=$((end-start))

    echo "Done!"
    echo "  - Finished in $runtime seconds"
    echo "  - ${input} -> ${dir}/"
}

function run() {
    _make_folder

    function finish() {
        # Kill descendent processes
        pkill -P "$$"
    }
    trap finish EXIT

    start=$(date +%s)

    _extract_frames
    _build_html
    _export_pdf

    _report "${start}"

    wait "${_server_pid}" 2>/dev/null
}

while getopts "h?i:d:f:r:c:o:s:" opt; do
    case "$opt" in
        h) _help; exit ;;
        i) input="$OPTARG" ;;
        d) dir="$OPTARG" ;;
        f) fps="$OPTARG" ;;
        r) rows="$OPTARG" ;;
        c) columns="$OPTARG" ;;
        o) order="$OPTARG" ;;
        s) page_side="$OPTARG" ;;
        *) echo; _help; exit ;;
    esac
done

if [ -z "$input" ]; then
    echo "ERROR: -i [input] is required"
    echo
    _help
    exit
fi

# Set local variables after all dependent options have been set
_basename="$(basename "$input")"
_output_slug="${_basename%.*}"
if [ -z "$dir" ]; then
    dir="output/${commit_hash}/${timestamp}-${_output_slug}"
fi

run

}