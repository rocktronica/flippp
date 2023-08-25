#!/bin/bash

{

# Exit on error
set -o errexit
set -o errtrace

# Constants
timestamp=$(git log -n1 --date=unix --format="%ad")
commit_hash=$(git log -n1 --format="%h")

input="input.mov"
input_basename=$(basename "$input")
fps="4"
rows="3"
columns="2"

dir="output/${timestamp}-${commit_hash}/${fps}-${rows}x${columns}-${input_basename}"

function help() {
    echo "\
Make frames from video

Usage:
./make_frames.sh [-h] [-f fps] [-f path]

Usage:
./make_frames.sh                    Export all STLs
./make_frames.sh -h                 Show this message and quit
./make_frames.sh -i <path>          Set input file path (Default: input.mov)
./make_frames.sh -f <fps>           Set frames/second (Default: ${fps})
./make_frames.sh -r <rows>          Set panel rows/sheet (Default: ${rows})
./make_frames.sh -c <columns>       Set panel columns/sheet (Default: ${columns})

Examples:
./make_frames.sh -f 2 -i path/to/file.mp4
"
}

function _extract_frames() {
    echo "Extracting frames"
    ffmpeg -i "${input}" \
        -vf fps="${fps}" \
        -hide_banner -loglevel error \
        "${dir}/%04d.png"

    # for filename in "${dir}"/*.png; do
      # echo -i "$filename" -o "$filename.png"
      # TODO: run processing
    # done
}

function _build_html() {
    echo "Building HTML"
    python3 build_html.py \
        --directory "$dir" \
        --rows "$rows" \
        --columns "$columns"
}

function _report() {
    frame_count=$(ls -lR "$dir"/*.png | wc -l | xargs)

    echo
    echo "Extracted ${frame_count} frames from ${input} into ${dir}"
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
    # TODO: PDF output
    _report

    end=`date +%s`
    runtime=$((end-start))

    echo
    echo "Finished in $runtime seconds"
}

while getopts "h?i:f:r:c:" opt; do
    case "$opt" in
        h) help; exit ;;
        i) input="$OPTARG" ;;
        f) fps="$OPTARG" ;;
        r) rows="$OPTARG" ;;
        c) columns="$OPTARG" ;;
        *) help; exit ;;
    esac
done

# Remake output directory
input_basename=$(basename "$input")
dir="output/${timestamp}-${commit_hash}/${fps}-${rows}x${columns}-${input_basename}"

run "${query[@]}"

}