import { range } from "https://deno.land/x/lodash@4.17.15-es/lodash.js";
import { renderFile } from "https://deno.land/x/mustache@v0.3.0/mod.ts";
import { FRAME_PREFIX } from "./interface.ts";

interface Panel {
  id: number;
  filename: string | undefined;
  page: number;
}

interface Page {
  panels: Panel[];
}

export interface HtmlSettings {
  rows: number;
  columns: number;

  pageWidth: string;
  pageHeight: string;
  pagePadding: string;
  pageSide: string;

  handlePadding: string;

  imageWidth: string;
  imageHeight: string;
  imageMargin: string;
  imagePosition: string;

  crop: boolean;
  imageFilter: string;

  flyleavesCount: number;

  footer: string;
}

const getPageCount = (panelCount: number, panelsPerPage: number) =>
  Math.ceil(panelCount / panelsPerPage);

const getPageIndex = (i: number, panelsPerPage: number) =>
  Math.floor(i / panelsPerPage);

const getPanels = async (
  directory: string,
  panelsPerPage: number,
  cover: string | undefined,
  flyleavesCount: HtmlSettings["flyleavesCount"],
  framePrefix = FRAME_PREFIX,
): Promise<Panel[]> => {
  let filenames: (string | undefined)[] = [];
  for await (const dirEntry of Deno.readDir(directory)) {
    if (dirEntry.name.match(new RegExp(`${framePrefix}.*.png`))) {
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

  if (cover) {
    filenames = [cover, ...filenames];
  }

  return filenames.map((
    filename: string | undefined,
    i: number,
  ) => ({
    cover: cover ? i == 0 : false,
    id: i + 1,
    filename,
    page: getPageIndex(i, panelsPerPage) + 1,
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
          panels: panels.filter((panel: Panel) => panel.page == i + 1),
        });
      },
    );

  if (pageSide == "back") {
    pages.reverse();
  }

  return pages;
};

export const getHtml = async (
  title: string,
  directory: string,
  cover: string | undefined,
  settings: HtmlSettings,
) => {
  const panels = await getPanels(
    directory,
    settings.rows * settings.columns,
    cover,
    settings.flyleavesCount,
  );

  const pages = getPages(
    panels,
    settings.rows,
    settings.columns,
    settings.pageSide,
  );

  return await renderFile("./bsns/template.mustache", {
    title,
    pages,
    panelCount: panels.length,
    pageCount: pages.length,
    pageDirection: settings.pageSide == "front" ? "ltr" : "rtl",
    ...settings,
  });
};
