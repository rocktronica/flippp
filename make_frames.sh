#!/bin/bash

{

# Exit on error
set -o errexit
set -o errtrace

# Constants
timestamp=$(git log -n1 --date=unix --format="%ad")
commit_hash=$(git log -n1 --format="%h")

fps="4"
dir="output/$fps-$timestamp-$commit_hash"

function help() {
    echo "\
Make frames from video

Usage:
./make_frames.sh [-hectb] [-p fps] [-d DIRECTORY] [-q COMMA,SEPARATED,QUERY]

Usage:
./make_frames.sh                    Export all STLs
./make_frames.sh -h                 Show this message and quit
./make_frames.sh -f <fps>           Set frames/second
                                    Default is 4

Examples:
./make_frames.sh -f 2
"
}

function _make_frames() {
    ffmpeg -i input.mov -vf fps="${fps}" "${dir}/%d.jpg"

    # for filename in "${dir}"/*.jpg; do
      # echo -i "$filename" -o "$filename.jpg"
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

while getopts "h?f:" opt; do
    case "$opt" in
        h) help; exit ;;
        f) fps="$OPTARG" ;;
        *) help; exit ;;
    esac
done

run "${query[@]}"

}