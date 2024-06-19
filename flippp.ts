import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import {
  copyCover,
  exportPdf,
  extractFrames,
  getDir,
  getOutputPdfPath,
  getOutputSlug,
  makeFolder,
  report,
  saveOptions,
  serve,
} from "./bsns/interface.ts";

await new Command()
  .name("./deno run -A --unstable flippp.ts")
  .description("Make flipbook from video")
  .option("-i --input <input:string>", "Input movie file path", {
    required: true,
  })
  .option("--cover <cover:string>", "Optional PNG cover image path")
  .option("--fps <fps:number>", "Frames Per Second", { default: 4 })
  .option("--dir <dir:string>", "Output directory path")
  .option("--footer <footer:string>", "Text at bottom of handle", {
    default: "made with flippp",
  })
  .option(
    "--devMode <devMode:boolean>",
    "Just build, serve, and wait to stop. No PDFs.",
    { default: false },
  )
  .group("Layout options")
  .option("--rows <rows:number>", "Panel rows per page", { default: 5 })
  .option("--columns <columns:number>", "Panel columns per page", {
    default: 2,
  })
  .option(
    "--printCutLines <printCutLines:boolean>",
    "Print lines for where to cut",
    {
      default: false,
    },
  )
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

      let { input, cover, devMode, fps, dir, ...settings } = options;
      const outputSlug = await getOutputSlug(input);
      dir = dir || await getDir(outputSlug);
      const outputPdfPath = getOutputPdfPath(dir, outputSlug);

      await makeFolder(dir);
      let newCover = undefined;
      if (cover) {
        newCover = await copyCover(cover, dir);
      }

      await extractFrames(input, fps, dir);
      await saveOptions(dir, options);

      if (devMode) {
        console.log("Dev mode!");
        console.log("  - Press CTRL+C to quit");
        await serve(dir, outputPdfPath, newCover, settings);
      } else {
        await exportPdf(dir, outputPdfPath, outputSlug, newCover, settings);
        report(Date.now() - startTime, input, outputPdfPath);
      }
    },
  )
  .parse();
