import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import {
  exportPdf,
  extractFrames,
  getDir,
  getOutputPdfPath,
  getOutputSlug,
  makeFolder,
  report,
  saveOptions,
} from "./bsns/interface.ts";

await new Command()
  .name("./deno run -A --unstable flippp.ts")
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
      default: ".0625in",
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
  .option("--imageRotate <imageRotate:string>", "Optional image rotation", {
    default: "0deg",
  })
  .option("--imageFilter <imageFilter:string>", "Optional CSS filter", {
    default: "none",
  })
  .help({ colors: false })
  .action(
    async (options) => {
      const startTime = Date.now();

      let { input, fps, dir, ...settings } = options;
      const outputSlug = await getOutputSlug(input);
      dir = dir || await getDir(outputSlug);
      const outputPdfPath = getOutputPdfPath(dir, outputSlug);

      await makeFolder(dir);
      await extractFrames(input, fps, dir);
      await saveOptions(dir, options);
      await exportPdf(dir, outputPdfPath, outputSlug, settings);

      report(Date.now() - startTime, input, outputPdfPath);
    },
  )
  .parse();
