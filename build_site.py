from glob import glob
import argparse
import chevron
import math
import os
import sys


def get_page_index(i, panels_per_page):
    return math.floor(i / panels_per_page)


# [1-18] ->  [1,4,7,10,13,16,2,5,8,11,14,17,3,6,9,12,15,18]
def panelize(input, panels_per_page):
    output = []
    page_count = math.ceil(len(input) / panels_per_page)

    for i in range(page_count * panels_per_page):
        page_index = get_page_index(i, panels_per_page)
        panel_index = i % panels_per_page
        input_index = panel_index * page_count + page_index

        appendee = input[input_index] if input_index <= len(input) - 1 else None

        output.append(appendee)

    return output


def get_panels(directory, panels_per_page):
    filenames = glob(directory + "/*.png")

    return [
        {
            "filename": os.path.relpath(filename, directory) if filename else None,
            "page": get_page_index(i, panels_per_page),
        }
        for i, filename in enumerate(panelize(sorted(filenames), panels_per_page))
    ]


def get_html(directory, rows, columns):
    values = {
        "files": get_panels(directory, panels_per_page=rows * columns),
        "rows": rows,
        "columns": columns,
    }

    return chevron.render(template, values)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--directory",
        type=str,
        required=True,
        help="path to images' folder",
    )
    parser.add_argument("--rows", type=int, default=3, help="# of panel rows per page")
    parser.add_argument(
        "--columns", type=int, default=2, help="# of panel columns per page"
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
                rows=arguments.rows,
                columns=arguments.columns,
            )
        )
        output.close()
