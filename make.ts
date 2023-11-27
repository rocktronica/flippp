// TODO: organize, help()

import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { printf } from "https://deno.land/std@0.208.0/fmt/printf.ts";
import { fileExtension } from "https://deno.land/x/file_extension@v2.1.0/mod.ts";
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

export interface HtmlSettings {
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

export const DEFAULT_HTML_SETTINGS: HtmlSettings = {
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
export const getSettings = (flags: any): HtmlSettings => ({
  ...DEFAULT_HTML_SETTINGS,
  ...flags,
});

export const getHtml = async (
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

const run = async (
  command: string,
  args: Deno.CommandOptions["args"],
) => await new Deno.Command(command, { args }).output();

const runGet = async (
  command: string,
  args: Deno.CommandOptions["args"],
) =>
  (new TextDecoder())
    .decode((await run(command, args)).stdout)
    .trim();

const getDir = async (outputSlug: string): Promise<string> => {
  const commitHash = await runGet("git", ["log", "-n1", "--format=%h"]);
  const timestamp = await runGet("date", ["+%s"]);

  return `output/${commitHash}/${timestamp}-${outputSlug}`;
};

const makeFolder = async (dir: string) => {
  console.log(`Creating output directory ${dir}`);
  await run("mkdir", ["-pv", dir]);
  console.log();
};

const extractFrames = async (input: string, fps: number, dir: string) => {
  console.log("Extracting frames");

  await run("ffmpeg", [
    "-i",
    input,
    "-vf",
    `fps=${fps}`,
    "-hide_banner",
    "-loglevel",
    "error",
    `${dir}/%04d.png`,
  ]);

  // TODO: report count
  console.log("  - Frames extracted");
  console.log();
};

const saveSettings = async (dir: string, settings: HtmlSettings) => {
  console.log("Saving settings JSON");

  const path = `${dir}/settings.json`;

  await Deno.writeTextFile(path, JSON.stringify(settings, null, 2));

  console.log(`  - Saved to ${path}`);
  console.log();
};

const exportPdf = async (
  dir: string,
  outputSlug: string,
  settings: HtmlSettings,
  port = 8080,
) => {
  const path = `${dir}/${outputSlug}.pdf`;
  const html: BodyInit = await getHtml(dir, settings);

  console.log("Export PDF");

  console.log("  - Starting server");
  printf("  - "); // Format "Listening..."
  const server = Deno.serve(
    { port },
    async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const isPng = !!url.pathname.match(/\/\d+.png/);

      let body: BodyInit = html;
      if (isPng) {
        body = (await Deno.open(`${dir}${url.pathname}`)).readable;
      }

      return new Response(body, {
        headers: {
          "content-type": isPng ? "image/x-png" : "text/html",
        },
      });
    },
  );

  console.log(`  - Starting browser`);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle2" });
  await page.pdf({
    path,
    format: "letter",
    preferCSSPageSize: true,
    printBackground: true,
  });
  console.log(`  - PDF at ${path}`);

  await browser.close();
  console.log(`  - Browser stopped`);

  // Fixes "Property does not exist on" lint error...
  // deno-lint-ignore no-explicit-any
  await (<any> server).shutdown();
  console.log(`  - Server stopped`);

  console.log();
};

const report = (runtimeInMilliseconds: number, input: string, dir: string) => {
  console.log("Done!");
  console.log(`  - Finished in ${runtimeInMilliseconds / 1000} seconds`);
  console.log(`  - ${input} -> ${dir}/`);
};

(async () => {
  const startTime = Date.now();

  const flags = parse(Deno.args, {
    default: { input: "", ...DEFAULT_HTML_SETTINGS },
  });

  try {
    await Deno.open(flags.input);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Input file ${flags.input} not found`);
      Deno.exit();
    }
  }

  const outputSlug = await runGet("basename", [flags.input]);
  const dir = await getDir(outputSlug);
  const settings = getSettings(flags);

  await makeFolder(dir);
  await extractFrames(flags.input, 4, dir);
  await saveSettings(dir, settings);
  await exportPdf(dir, outputSlug, settings);

  report(Date.now() - startTime, flags.input, dir);
})();
