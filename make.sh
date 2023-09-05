#!/bin/bash

{

# Exit on error
set -o errexit
set -o errtrace

# Constants
timestamp=$(git log -n1 --date=unix --format="%ad")
commit_hash=$(git log -n1 --format="%h")
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Option defaults
# TODO: DRY against built_html.py
output="output.pdf"
fps="4"
rows="4"
columns="3"
print_orientation="landscape"

# Local variables, set later
_dir=""
_server_pid=""
_frame_count=""
_page_count=""

function _help() {
    echo "\
Make flipbook from video

Usage:
./make.sh [-h] [-f fps] [-f path] [-r rows] [-c columns]

Usage:
./make.sh                    Run!
./make.sh -h                 Show this message and quit
./make.sh -i <input>         Input file path (Required)
./make.sh -o <output>        Output PDF file path (Default: ${output})
./make.sh -f <fps>           Frames/second (Default: ${fps})
./make.sh -r <rows>          Panel rows/sheet (Default: ${rows})
./make.sh -c <columns>       Panel columns/sheet (Default: ${columns})
./make.sh -p <print>         Print orientation (Default: ${print_orientation})

Examples:
./make.sh -i path/to/file.mp4 -f 2
"
}

function _extract_frames() {
    echo "Extracting frames"
    ffmpeg -i "${input}" \
        -vf fps="${fps}" \
        -hide_banner -loglevel error \
        "${_dir}/%04d.png"

    _frame_count=$(find "${_dir}"/*.png | wc -l | xargs)

    echo "  - ${_frame_count} frames extracted"

    echo
}

function _build_html() {
    echo "Building HTML"
    python3 build_html.py \
        --directory "${_dir}" \
        --rows "${rows}" \
        --columns "${columns}" \
        --orientation "${print_orientation}"
    echo "  - Built to ${_dir}"

    # TODO: fix math, hehe
    _page_count=$(echo "${_frame_count} / (${columns} * ${rows})" | bc)
    echo "  - Expecting ${_page_count} page(s)"

    echo
}

function _export_pdf() {
    echo "Export PDF"

    echo "  - Starting server"
    pushd "${_dir}" &> /dev/null
    python3 -m http.server 9002 &> /dev/null &
    _server_pid=$!
    popd &> /dev/null

    echo "  - Server at PID ${_server_pid}"
    sleep 1

    echo "  - \"Printing\" to PDF via Chrome"
    "$chrome" \
        --headless \
        --print-to-pdf="${_dir}/${output}" \
        "http://localhost:9002" \
        2> /dev/null

    echo "  - PDF at ${_dir}/${output}"

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
    echo "  - ${input} -> ${_dir}/"
}

function run() {
    mkdir -pv "${_dir}" 1> /dev/null

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

while getopts "h?i:o:f:r:c:p:" opt; do
    case "$opt" in
        h) _help; exit ;;
        i) input="$OPTARG" ;;
        o) output="$OPTARG" ;;
        f) fps="$OPTARG" ;;
        r) rows="$OPTARG" ;;
        c) columns="$OPTARG" ;;
        p) print_orientation="$OPTARG" ;;
        *) echo; _help; exit ;;
    esac
done

if [ -z "$input" ]; then
    echo "ERROR: -i [input] is required"
    echo
    _help
    exit
fi

# Set output directory after all dependent options have been set
_dir="output/\
${timestamp}-${commit_hash}/\
${fps}-${rows}x${columns}-${print_orientation}-$(basename "$input")"

run

}