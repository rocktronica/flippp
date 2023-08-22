#!/bin/bash

{

# Exit on error
set -o errexit
set -o errtrace

# Constants
timestamp=$(git log -n1 --date=unix --format="%ad")
commit_hash=$(git log -n1 --format="%h")

input="input.mov"
fps="4"
dir="output/$timestamp-$commit_hash-$fps-$input"

function help() {
    echo "\
Make frames from video

Usage:
./make_frames.sh [-h] [-p fps] [-f path]

Usage:
./make_frames.sh                    Export all STLs
./make_frames.sh -h                 Show this message and quit
./make_frames.sh -f <fps>           Set frames/second (Default: 4)
./make_frames.sh -fi <path>         Set input file path (Default: input.mov)

Examples:
./make_frames.sh -f 2
"
}

function _make_frames() {
    ffmpeg -i "${input}" -vf fps="${fps}" "${dir}/%04d.png"

    # for filename in "${dir}"/*.png; do
      # echo -i "$filename" -o "$filename.png"
      # TODO: run processing
    # done
}

function _make_site() {
    python3 build_site.py --directory "$dir"
}

function run() {
    mkdir -pv $dir

    function finish() {
        # Kill descendent processes
        pkill -P "$$"
    }
    trap finish EXIT

    start=`date +%s`

    _make_frames
    _make_site

    end=`date +%s`
    runtime=$((end-start))

    echo
    echo "Finished in $runtime seconds"
}

while getopts "h?i:f:" opt; do
    case "$opt" in
        h) help; exit ;;
        i) input="$OPTARG" ;;
        f) fps="$OPTARG" ;;
        *) help; exit ;;
    esac
done

run "${query[@]}"

}