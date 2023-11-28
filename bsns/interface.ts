import { getHtml, HtmlSettings } from "./html.ts";
import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { printf } from "https://deno.land/std@0.208.0/fmt/printf.ts";

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
  const timestamp = await runGet("date", ["+%s"]);
  return `output/${timestamp}-${outputSlug}`;
};

const getOutputSlug = async (input: string): Promise<string> => {
  const basename = await runGet("basename", [input]);
  return basename.slice(0, basename.lastIndexOf("."));
};

const getOutputPdfPath = (dir: string, outputSlug: string) =>
  `${dir}/${outputSlug}.pdf`;

const makeFolder = async (dir: string) => {
  console.log(`Creating output directory ${dir}/`);
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

  const count = (await runGet("ls", [dir])).split(/\r?\n|\r|\n/g).length;
  console.log(`  - ${count} frames extracted from ${input} to ${dir}`);
  console.log();
};

// TODO: save all flags, not just HtmlSettings
const saveSettings = async (dir: string, settings: HtmlSettings) => {
  console.log("Saving settings JSON");

  const path = `${dir}/settings.json`;

  await Deno.writeTextFile(path, JSON.stringify(settings, null, 2));

  console.log(`  - Saved to ${path}`);
  console.log();
};

const exportPdf = async (
  dir: string,
  path: string,
  outputSlug: string,
  settings: HtmlSettings,
  port = 8080,
) => {
  const html: BodyInit = await getHtml(outputSlug, dir, settings);

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

const report = (
  runtimeInMilliseconds: number,
  input: string,
  outputPdfPath: string,
) => {
  console.log("Done!");
  console.log(`  - Finished in ${runtimeInMilliseconds / 1000} seconds`);
  console.log(`  - ${input} -> ${outputPdfPath}`);
};

await new Command()
  .name("./make.sh")
  .description("Make flipbook from video")
  .option("-i --input <input:string>", "Input movie file path", {
    required: true,
  })
  .option("--fps <fps:number>", "Frames Per Second", { default: 4 })
  .option("--dir <dir:string>", "Output directory path")
  .group("Layout options")
  .option("--rows <rows:number>", "Panel rows per page", { default: 5 })
  .option("--columns <columns:number>", "Panel columns per page", {
    default: 2,
  })
  .group("Page options")
  .option("--pageWidth <pageWidth:string>", "Page width", { default: "8.5in" })
  .option("--pageHeight <pageHeight:string>", "Page height", {
    default: "11in",
  })
  .option("--pagePadding <pagePadding:string>", "Page padding", {
    default: ".5in .75in",
  })
  .option("--pageSide <pageSide:string>", 'Page side: "front" or "back"', {
    default: "front",
  })
  .option(
    "--handlePadding <handlePadding:string>",
    "Padding on handle, under binding",
    {
      default: ".125in",
    },
  )
  .option(
    "--flyleavesCount <flyleavesCount:number>",
    "Blank panels at front/back",
    { default: 0 },
  )
  .group("Image options")
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
  .help({ colors: false })
  .action(
    async ({ input, fps, dir, ...settings }) => {
      const startTime = Date.now();
      const outputSlug = await getOutputSlug(input);
      dir = dir || await getDir(outputSlug);
      const outputPdfPath = getOutputPdfPath(dir, outputSlug);

      await makeFolder(dir);
      await extractFrames(input, fps, dir);
      await saveSettings(dir, settings);
      await exportPdf(dir, outputPdfPath, outputSlug, settings);

      report(Date.now() - startTime, input, outputPdfPath);
    },
  )
  .parse();
