import { fileExtension } from "https://deno.land/x/file_extension@v2.1.0/mod.ts";
import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";
import { range } from "https://deno.land/x/lodash@4.17.15-es/lodash.js";
import { renderFile } from "https://deno.land/x/mustache@v0.3.0/mod.ts";

interface Panel {
  filename: string | undefined;
  page: number;
}

interface Page {
  panels: Panel[];
}

const getPageCount = (panelCount: number, panelsPerPage: number) =>
  Math.ceil(panelCount / panelsPerPage);

const getPageIndex = (i: number, panelsPerPage: number) =>
  Math.floor(i / panelsPerPage);

const panelize = (
  input: string[],
  panelsPerPage: number,
): (string | undefined)[] => {
  const output: (string | undefined)[] = [];
  const pageCount = getPageCount(input.length, panelsPerPage);

  range(0, pageCount * panelsPerPage).forEach((i: number) => {
    const pageIndex = getPageIndex(i, panelsPerPage);
    const panelIndex = i % panelsPerPage;
    const inputIndex = panelIndex * pageCount + pageIndex;

    output.push(
      inputIndex <= input.length ? input[inputIndex] : undefined,
    );
  });

  return output;
};

const getPanels = async (
  directory: string,
  panelsPerPage: number,
  // TODO: flyleaves
): Promise<Panel[]> => {
  const filenames: string[] = [];
  for await (const dirEntry of Deno.readDir(directory)) {
    if (fileExtension(dirEntry.name) == "png") {
      filenames.push(dirEntry.name);
    }
  }

  // TODO: parameterize order
  return panelize(filenames.sort(), panelsPerPage).map((
    filename: string | undefined,
    i: number,
  ) => ({
    filename,
    page: getPageIndex(i, panelsPerPage),
  }));
};

const getHtml = async (
  directory: string,
  options: {
    rows: number;
    columns: number;
    pageWidth: string;
    pageHeight: string;
    pagePadding: string;
    panelPadding: string; // TODO: ditch, allow for custom image content size instead
    crop: true;
    imageFilter: string;
  },
) => {
  const panels = await getPanels(directory, options.rows * options.columns);

  const pages: Page[] = [];
  range(0, getPageCount(panels.length, options.rows * options.columns)).forEach(
    (i: number) => {
      pages.push({ panels: panels.filter((panel: Panel) => panel.page == i) });
    },
  );

  return await renderFile("template.mustache", {
    pages,
    "rows": options.rows,
    "columns": options.columns,
    "page_width": options.pageWidth,
    "page_height": options.pageHeight,
    "page_padding": options.pagePadding,
    "panel_padding": options.panelPadding,
    "crop": options.crop,
    "image_filter": options.imageFilter,
  });
};

const flags = parse(Deno.args);
await Deno.writeTextFile(
  // TODO: parameterize?
  flags.directory + "/index.html",
  await getHtml(flags.directory, {
    rows: 5,
    columns: 2,
    pageWidth: "8.5in",
    pageHeight: "11in",
    pagePadding: ".5in .75in",
    panelPadding: ".0625in",
    crop: true,
    imageFilter: "none",

    ...flags,
  }),
);
