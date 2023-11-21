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

interface HtmlSettings {
  title: string;

  rows: number;
  columns: number;

  pageWidth: string;
  pageHeight: string;
  pagePadding: string;

  handlePadding: string;

  imageWidth: string;
  imageHeight: string;
  imageMargin: string;
  imagePosition: string;

  crop: true;
  imageFilter: string;

  order: "panel" | "alphanumeric";
}

const DEFAULT_SETTINGS: HtmlSettings = {
  title: "output",

  rows: 5,
  columns: 2,

  pageWidth: "8.5in",
  pageHeight: "11in",
  pagePadding: ".5in .75in",

  handlePadding: ".0625in",

  imageWidth: "1.875in",
  imageHeight: "1.875in",
  imageMargin: ".0625in",
  imagePosition: "center center",

  crop: true,
  imageFilter: "none",

  order: "panel",
};

const getPageCount = (panelCount: number, panelsPerPage: number) =>
  Math.ceil(panelCount / panelsPerPage);

const getPageIndex = (i: number, panelsPerPage: number) =>
  Math.floor(i / panelsPerPage);

const panelize = (
  input: (string | undefined)[],
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
  order: HtmlSettings["order"],
  // TODO: flyleaves
): Promise<Panel[]> => {
  let filenames: (string | undefined)[] = [];
  for await (const dirEntry of Deno.readDir(directory)) {
    if (fileExtension(dirEntry.name) == "png") {
      filenames.push(dirEntry.name);
    }
  }

  filenames = filenames.sort();
  if (order == "panel") {
    filenames = panelize(filenames, panelsPerPage);
  }

  return filenames.map((
    filename: string | undefined,
    i: number,
  ) => ({
    filename,
    page: getPageIndex(i, panelsPerPage),
  }));
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
  const panels = await getPanels(
    directory,
    settings.rows * settings.columns,
    settings.order,
  );

  const pages: Page[] = [];
  range(0, getPageCount(panels.length, settings.rows * settings.columns))
    .forEach(
      (i: number) => {
        pages.push({
          panels: panels.filter((panel: Panel) => panel.page == i),
        });
      },
    );

  return await renderFile("template.mustache", {
    pages,
    ...settings,
  });
};

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
