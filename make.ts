import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import {
  DEFAULT_HTML_SETTINGS,
  getHtml,
  getSettings,
  HtmlSettings,
} from "./build_html.ts";
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

/*
PUPPETEER_PRODUCT=chrome deno run -A --unstable https://deno.land/x/puppeteer@16.2.0/install.ts
deno run \
    --allow-run --allow-read --allow-write --allow-env --allow-net --unstable \
    make.ts --input local/say_dada.mov
*/

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
