// TODO: organize

import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
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
  pageSide: string;

  handlePadding: string;

  imageWidth: string;
  imageHeight: string;
  imageMargin: string;
  imagePosition: string;

  crop: boolean;
  imageFilter: string;

  flyleavesCount: number;
}

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

await new Command()
  .name("flippp")
  .description("Make flipbook from video")
  .option("-i --input <input:string>", "Input movie path", { required: true })
  .option("--title <title:string>", "PDF title", { default: "output" })
  .option("--rows <rows:number>", "Panel rows per page", { default: 5 })
  .option("--columns <columns:number>", "Panel columns per page", {
    default: 2,
  })
  .option("--pageWidth <pageWidth:string>", "Page width", { default: "8.5in" })
  .option("--pageHeight <pageHeight:string>", "Page height", {
    default: "11in",
  })
  .option("--pagePadding <pagePadding:string>", "Page padding", {
    default: ".5in .75in",
  })
  .option("--pageSide <pageSide:string>", "Front or back", { default: "front" }) // "front" | "back"
  .option(
    "--handlePadding <handlePadding:string>",
    "Padding on handle, under binding",
    {
      default: ".125in",
    },
  )
  .option("--imageWidth <imageWidth:string>", "Image width", { default: "2in" })
  .option("--imageHeight <imageHeight:string>", "Image height", {
    default: "1.875in",
  })
  .option(
    "--imageMargin <imageMargin:string>",
    "Margin between image and panel",
    { default: ".0625in" },
  )
  .option(
    "--imagePosition <imagePosition:string>",
    "CSS background-position for image",
    {
      default: "center center",
    },
  )
  .option("--crop <crop:boolean>", "Crop image or show all of it", {
    default: true,
  })
  .option("--imageFilter <imageFilter:string>", "Optional CSS filter", {
    default: "none",
  })
  .option(
    "--flyleavesCount <flyleavesCount:number>",
    "Blank panels at front/back",
    { default: 2 },
  )
  .help({ colors: false })
  .action(
    async ({ input, ...settings }) => {
      const startTime = Date.now();

      const outputSlug = await runGet("basename", [input]);
      const dir = await getDir(outputSlug);

      await makeFolder(dir);
      await extractFrames(input, 4, dir);
      await saveSettings(dir, settings);
      await exportPdf(dir, outputSlug, settings);

      report(Date.now() - startTime, input, dir);
    },
  )
  .parse();
