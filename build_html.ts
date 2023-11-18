import { fileExtension } from "https://deno.land/x/file_extension@v2.1.0/mod.ts";
import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";
import { range } from "https://deno.land/x/lodash@4.17.15-es/lodash.js";
import { renderFile } from "https://deno.land/x/mustache@v0.3.0/mod.ts";

// TODO: fix no-explicit-any

const getPageCount = (panelCount: number, panelsPerPage: number) =>
  Math.ceil(panelCount / panelsPerPage);

const getPageIndex = (i: number, panelsPerPage: number) =>
  Math.floor(i / panelsPerPage);

// [1-18] ->  [1,4,7,10,13,16,2,5,8,11,14,17,3,6,9,12,15,18]
const panelize = (
  // deno-lint-ignore no-explicit-any
  input: any[any],
  panelsPerPage: number,
) => {
  // deno-lint-ignore no-explicit-any
  const output: any[any] = [];
  const pageCount = getPageCount(input.length, panelsPerPage);

  for (const i in range(0, pageCount * panelsPerPage - 1)) {
    const pageIndex = getPageIndex(i, panelsPerPage);
    const panelIndex = i % panelsPerPage;
    const inputIndex = panelIndex * pageCount + pageIndex;

    output.push(
      inputIndex <= input.length ? input[inputIndex] : undefined,
    );
  }

  return output;
};

// deno-lint-ignore no-explicit-any
const getPanels: any[any] = async (
  directory: string,
  panelsPerPage: number,
) => {
  const filenames: string[] = [];
  for await (const dirEntry of Deno.readDir(directory)) {
    if (fileExtension(dirEntry.name) == "png") {
      filenames.push(dirEntry.name);
    }
  }

  return panelize(filenames.sort(), panelsPerPage).map((
    filename: string,
    i: number,
  ) => ({
    filename,
    page: getPageIndex(i, panelsPerPage),
  }));
};

const flags = parse(Deno.args);

const getHtml = async (
  directory: string,
  rows = flags.rows || 5,
  columns = flags.columns || 2,
  orientation: "landscape" | "portrait" = flags.orientation || "portrait",
  pageWidth = flags.pageWidth || "8.5in",
  pageHeight = flags.pageHeight || "11in",
  pagePadding = flags.pagePadding || ".5in .75in",
  panelPadding = flags.panelPadding || ".0625in",
  crop = flags.crop || true,
  imageFilter = flags.imageFilter || "",
) => {
  const panels = await getPanels(directory, rows * columns);

  // deno-lint-ignore no-explicit-any
  const pages: any[any] = [];
  for (const i in range(0, getPageCount(panels.length, rows * columns))) {
    // deno-lint-ignore no-explicit-any
    pages.push({ panels: panels.filter((panel: any) => panel.page == i) });
  }

  return await renderFile("template.mustache", {
    pages,
    rows,
    columns,
    "handle_on_top": orientation == "landscape",
    "page_width": pageWidth,
    "page_height": pageHeight,
    "page_padding": pagePadding,
    "panel_padding": panelPadding,
    crop,
    "image_filter": imageFilter,
  });
};

await Deno.writeTextFile(
  flags.directory + "/index-ts.html",
  await getHtml(flags.directory),
);
