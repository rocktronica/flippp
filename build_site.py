from glob import glob
import argparse
import chevron
import math
import os
import sys


def get_page_index(i, panels_per_page=6):
    return math.floor(i / panels_per_page)


# [1-18] ->  [1,4,7,10,13,16,2,5,8,11,14,17,3,6,9,12,15,18]
def panelize(input, panels_per_page=6):
    output = []
    page_count = math.ceil(len(input) / panels_per_page)

    for i in range(page_count * panels_per_page):
        page_index = get_page_index(i, panels_per_page)
        panel_index = i % panels_per_page
        input_index = panel_index * page_count + page_index

        appendee = input[input_index] if input_index <= len(input) - 1 else None

        output.append(appendee)

    return output


def get_panels(directory):
    filenames = glob(directory + "/*.png")

    return [
        {
            "i": i + 1,
            "filename": os.path.relpath(filename, directory) if filename else None,
        }
        for i, filename in enumerate(panelize(sorted(filenames)))
    ]


def get_html(directory):
    values = {
        "files": get_panels(directory),
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
