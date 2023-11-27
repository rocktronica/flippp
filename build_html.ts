import { fileExtension } from "https://deno.land/x/file_extension@v2.1.0/mod.ts";
import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";
import { range } from "https://deno.land/x/lodash@4.17.15-es/lodash.js";
import { renderFile } from "https://deno.land/x/mustache@v0.3.0/mod.ts";

interface Panel {
  id: number;
  filename: string | undefined;
  page: number;
}

interface Page {
  panels: Panel[];
}

interface HtmlSettings {
  title: string;

  rows: number;
  columns: number;

  pageWidth: string;
  pageHeight: string;
  pagePadding: string;
  pageSide: "front" | "back";

  handlePadding: string;

  imageWidth: string;
  imageHeight: string;
  imageMargin: string;
  imagePosition: string;

  crop: true;
  imageFilter: string;

  flyleavesCount: number;
}

const DEFAULT_SETTINGS: HtmlSettings = {
  title: "output",

  rows: 5,
  columns: 2,

  pageWidth: "8.5in",
  pageHeight: "11in",
  pagePadding: ".5in .75in",
  pageSide: "front",

  handlePadding: ".125in",

  imageWidth: "2in",
  imageHeight: "1.875in",
  imageMargin: ".0625in",
  imagePosition: "center center",

  crop: true,
  imageFilter: "none",

  flyleavesCount: 2,
};

const getPageCount = (panelCount: number, panelsPerPage: number) =>
  Math.ceil(panelCount / panelsPerPage);

const getPageIndex = (i: number, panelsPerPage: number) =>
  Math.floor(i / panelsPerPage);

const getPanels = async (
  directory: string,
  panelsPerPage: number,
  flyleavesCount: HtmlSettings["flyleavesCount"],
): Promise<Panel[]> => {
  let filenames: (string | undefined)[] = [];
  for await (const dirEntry of Deno.readDir(directory)) {
    if (fileExtension(dirEntry.name) == "png") {
      filenames.push(dirEntry.name);
    }
  }

  // NOTE: this assumes numbers are zero-padded!
  filenames = filenames.sort();

  filenames = [
    ...Array(flyleavesCount).fill(undefined),
    ...filenames,
    ...Array(flyleavesCount).fill(undefined),
  ];

  return filenames.map((
    filename: string | undefined,
    i: number,
  ) => ({
    id: i,
    filename,
    page: getPageIndex(i, panelsPerPage),
  }));
};

const getPages = (
  panels: Panel[],
  rows: HtmlSettings["rows"],
  columns: HtmlSettings["columns"],
  pageSide: HtmlSettings["pageSide"],
) => {
  const pages: Page[] = [];

  range(0, getPageCount(panels.length, rows * columns))
    .forEach(
      (i: number) => {
        pages.push({
          panels: panels.filter((panel: Panel) => panel.page == i),
        });
      },
    );

  if (pageSide == "back") {
    pages.reverse();
  }

  return pages;
};

// deno-lint-ignore no-explicit-any
const getSettings = (flags: any): HtmlSettings => ({
  ...DEFAULT_SETTINGS,
  ...flags,
});

const getHtml = async (
  directory: string,
  settings: HtmlSettings,
) => {
  return await renderFile("template.mustache", {
    pages: getPages(
      await getPanels(
        directory,
        settings.rows * settings.columns,
        settings.flyleavesCount,
      ),
      settings.rows,
      settings.columns,
      settings.pageSide,
    ),
    pageDirection: settings.pageSide == "front" ? "ltr" : "rtl",
    ...settings,
  });
};

(async () => {
  const flags = parse(Deno.args);
  const settings = getSettings(flags);

  await Deno.writeTextFile(
    flags.directory + "/index.html",
    await getHtml(flags.directory, settings),
  );
  await Deno.writeTextFile(
    flags.directory + "/settings.json",
    JSON.stringify(settings, null, 2),
  );
})();
