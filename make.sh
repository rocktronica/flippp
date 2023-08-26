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
fps="4"
rows="3"
columns="2"

function _help() {
    echo "\
Make flipbook from video

Usage:
./make.sh [-h] [-f fps] [-f path] [-r rows] [-c columns]

Usage:
./make.sh                    Export all STLs
./make.sh -h                 Show this message and quit
./make.sh -i <input>         Set input file path (Required)
./make.sh -f <fps>           Set frames/second (Default: ${fps})
./make.sh -r <rows>          Set panel rows/sheet (Default: ${rows})
./make.sh -c <columns>       Set panel columns/sheet (Default: ${columns})

Examples:
./make.sh -i path/to/file.mp4 -f 2
"
}

function _extract_frames() {
    echo "Extracting frames"
    ffmpeg -i "${input}" \
        -vf fps="${fps}" \
        -hide_banner -loglevel error \
        "${dir}/%04d.png"

    frame_count=$(ls -lR "$dir"/*.png | wc -l | xargs)

    echo "  - ${frame_count} frames extracted"

    echo
}

function _build_html() {
    echo "Building HTML"
    python3 build_html.py \
        --directory "$dir" \
        --rows "$rows" \
        --columns "$columns"
    echo "  - Built to ${dir}"

    echo
}

function _export_pdf() {
    echo "Export PDF"

    echo "  - Starting server"
    pushd "$dir" &> /dev/null
    python3 -m http.server 9002 &> /dev/null &
    pid=$!
    popd &> /dev/null

    echo "  - Server at PID ${pid}"
    sleep 1

    echo "  - \"Printing\" to PDF via Chrome"
    "$chrome" \
        --headless \
        --print-to-pdf="$dir/output.pdf" \
        "http://localhost:9002" \
        2> /dev/null

    echo "  - PDF at $dir/output.pdf"

    echo "  - Stopping PID ${pid}"
    { kill "${pid}" && wait "${pid}"; } 2>/dev/null

    # TODO: fix ^ preventing anything thereafter from being called

    echo
}

function _report() {
    start="$1"
    end=`date +%s`
    runtime=$((end-start))

    echo "Done!"
    echo "  - Finished in $runtime seconds"
    echo "  - ${input} -> ${dir}/"
}

function run() {
    mkdir -pv $dir 1> /dev/null

    function finish() {
        # Kill descendent processes
        pkill -P "$$"
    }
    trap finish EXIT

    start=`date +%s`

    _extract_frames
    _build_html
    _export_pdf

    _report "${start}"
}

while getopts "h?i:f:r:c:" opt; do
    case "$opt" in
        h) _help; exit ;;
        i) input="$OPTARG" ;;
        f) fps="$OPTARG" ;;
        r) rows="$OPTARG" ;;
        c) columns="$OPTARG" ;;
        *) echo; _help; exit ;;
    esac
done

if [ -z "$input" ]; then
    echo "ERROR: -i [input] is required"
    echo
    _help
    exit
fi

input_basename=$(basename "$input")
dir="output/${timestamp}-${commit_hash}/${fps}-${rows}x${columns}-${input_basename}"

run "${query[@]}"

}