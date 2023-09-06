from glob import glob
import argparse
import chevron
import math
import os
import sys


def get_page_count(panel_count, panels_per_page):
    return math.ceil(panel_count / panels_per_page)


def get_page_index(i, panels_per_page):
    return math.floor(i / panels_per_page)


# [1-18] ->  [1,4,7,10,13,16,2,5,8,11,14,17,3,6,9,12,15,18]
def panelize(input, panels_per_page):
    output = []
    page_count = get_page_count(len(input), panels_per_page)

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


def get_html(
    directory,
    rows,
    columns,
    orientation,
    page_width,
    page_height,
    page_padding,
    panel_padding,
):
    panels = get_panels(directory, rows * columns)

    pages = []
    for i in range(get_page_count(len(panels), rows * columns)):
        pages.append(
            {"panels": list(filter(lambda panel: panel.get("page") == i, panels))}
        )

    return chevron.render(
        template,
        # TODO: tidy
        # TODO: decouple handle position from is_portrait
        {
            "pages": pages,
            "rows": rows,
            "columns": columns,
            "is_portrait": orientation == "portrait",
            "page_width": page_width,
            "page_height": page_height,
            "page_padding": page_padding,
            "panel_padding": panel_padding,
        },
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--directory",
        type=str,
        required=True,
        help="path to images' folder",
    )

    # TODO: DRY against make.sh
    parser.add_argument("--rows", type=int, default=3, help="Panel rows per page")
    parser.add_argument("--columns", type=int, default=3, help="Panel columns per page")

    parser.add_argument(
        "--orientation",
        type=str,
        default="landscape",
        help="Print orientation: 'landscape' (default) or 'portrait'",
    )

    parser.add_argument("--page_padding", type=str, default=".25in")
    parser.add_argument("--panel_padding", type=str, default=".0625in")

    # TODO: parameterize handle/image size, panel order, image filter

    arguments = parser.parse_args()

    dir_path = os.path.dirname(os.path.realpath(__file__))

    if not os.path.isdir(arguments.directory):
        sys.exit("ERROR: " + arguments.directory + " directory does not exist")

    if arguments.orientation not in ["portrait", "landscape"]:
        sys.exit("ERROR: invalid --orientation " + arguments.orientation)

    with open(dir_path + "/template.mustache", "r") as template:
        output = open(arguments.directory + "/index.html", "w")
        output.write(
            get_html(
                directory=arguments.directory,
                rows=arguments.rows,
                columns=arguments.columns,
                orientation=arguments.orientation,
                page_width="8.5in" if arguments.orientation == "portrait" else "11in",
                page_height="11in" if arguments.orientation == "portrait" else "8.5in",
                page_padding=arguments.page_padding,
                panel_padding=arguments.panel_padding,
            )
        )
        output.close()
