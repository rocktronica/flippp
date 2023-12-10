import { getHtml, HtmlSettings } from "./html.ts";
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

export const getDir = async (outputSlug: string): Promise<string> => {
  const timestamp = await runGet("date", ["+%s"]);
  return `output/${timestamp}-${outputSlug}`;
};

const getBasename = async (input: string): Promise<string> => {
  return await runGet("basename", [input]);
};

export const getOutputSlug = async (input: string): Promise<string> => {
  const basename = await getBasename(input);
  return basename.slice(0, basename.lastIndexOf("."));
};

export const getOutputPdfPath = (dir: string, outputSlug: string) =>
  `${dir}/${outputSlug}.pdf`;

export const makeFolder = async (dir: string) => {
  console.log(`Creating output directory ${dir}/`);
  await run("mkdir", ["-pv", dir]);
  console.log();
};

export const copyCover = async (
  cover: string,
  dir: string,
  newFilename = "cover.png",
) => {
  const newCover = `${dir}/${newFilename}`;

  console.log(`Copying cover image`);
  await run("cp", [cover, newCover]);
  console.log(`  - ${newCover}`);
  console.log();

  return newFilename;
};

export const FRAME_PREFIX = "frame-";
export const extractFrames = async (
  input: string,
  fps: number,
  dir: string,
  prefix = FRAME_PREFIX,
) => {
  console.log("Extracting frames");

  await run("ffmpeg", [
    "-i",
    input,
    "-vf",
    `fps=${fps}`,
    "-hide_banner",
    "-loglevel",
    "error",
    `${dir}/${prefix}-%04d.png`,
  ]);

  const count = (await runGet("ls", [dir])).split(/\r?\n|\r|\n/g).length;
  console.log(`  - ${count} frames extracted from ${input} to ${dir}`);
  console.log();
};

// deno-lint-ignore no-explicit-any
export const saveOptions = async (dir: string, options: any) => {
  console.log("Saving options JSON");

  const path = `${dir}/options.json`;

  await Deno.writeTextFile(path, JSON.stringify(options, null, 2));

  console.log(`  - Saved to ${path}`);
  console.log();
};

export const exportPdf = async (
  dir: string,
  path: string,
  outputSlug: string,
  cover: string | undefined,
  settings: HtmlSettings,
  port = 8080,
) => {
  const html: BodyInit = await getHtml(outputSlug, dir, cover, settings);

  console.log("Export PDF");

  console.log("  - Starting server");
  printf("  - "); // Format "Listening..."
  const server = Deno.serve(
    { port },
    async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const isPng = !!url.pathname.match(/.*.png/);

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

export const report = (
  runtimeInMilliseconds: number,
  input: string,
  outputPdfPath: string,
) => {
  console.log("Done!");
  console.log(`  - Finished in ${runtimeInMilliseconds / 1000} seconds`);
  console.log(`  - ${input} -> ${outputPdfPath}`);
};
