from glob import glob
import argparse
import chevron
import math
import os
import sys


# [1-18] ->  [1,4,7,10,13,16,2,5,8,11,14,17,3,6,9,12,15,18]
def panelize(input, panels_per_page=6):
    output = []
    page_count = math.ceil(len(input) / panels_per_page)

    for i, value in enumerate(input):
        page_index = math.floor(i / panels_per_page)
        panel_index = i % panels_per_page
        index = panel_index * page_count + page_index

        output.append(input[index])

    return output


def get_files(directory):
    filenames = glob(directory + "/*.png")

    return [
        {"i": i + 1, "filename": os.path.relpath(filename, directory)}
        for i, filename in enumerate(sorted(filenames))
    ]


def get_html(directory):
    values = {
        "files": get_files(directory),
    }

    return chevron.render(template, values)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--directory", type=str, required=True, help="path to images' folder"
    )
    arguments = parser.parse_args()

    dir_path = os.path.dirname(os.path.realpath(__file__))

    if not os.path.isdir(arguments.directory):
        sys.exit("ERROR: " + arguments.directory + " directory does not exist")

    with open(dir_path + "/template.mustache", "r") as template:
        output = open(arguments.directory + "/index.html", "w")
        output.write(
            get_html(
                directory=arguments.directory,
            )
        )
        output.close()
