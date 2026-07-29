import { build, context } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");

const builds = [
  {
    entryPoints: [resolve(root, "src/extension.ts")],
    outfile: resolve(root, "dist/extension.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["vscode"],
    sourcemap: true
  },
  {
    entryPoints: [resolve(root, "webview/main.ts")],
    outfile: resolve(root, "media/main.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "chrome120",
    sourcemap: true
  }
];

await mkdir(resolve(root, "dist"), { recursive: true });
await mkdir(resolve(root, "media"), { recursive: true });

const workletSource = resolve(
  root,
  "node_modules/spessasynth_lib/dist/spessasynth_processor.min.js"
);
const workletTarget = resolve(root, "media/spessasynth_processor.min.js");
const styleSource = resolve(root, "webview/main.css");
const styleTarget = resolve(root, "media/main.css");
const soundFontSource = resolve(
  root,
  "assets/soundfonts/GeneralUser-GS.sf2"
);
const soundFontTarget = resolve(root, "media/GeneralUser-GS.sf2");
const soundFontLicenseSource = resolve(
  root,
  "assets/soundfonts/GeneralUser-GS-LICENSE.txt"
);
const soundFontLicenseTarget = resolve(
  root,
  "media/GeneralUser-GS-LICENSE.txt"
);
const instrumentSpriteSource = resolve(
  root,
  "assets/instruments/gm-families.png"
);
const instrumentSpriteTarget = resolve(
  root,
  "media/gm-instrument-families.png"
);
const extensionIconSource = resolve(
  root,
  "assets/instruments/extension-icon.png"
);
const extensionIconTarget = resolve(root, "media/icon.png");

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((item) => item.watch()));
  await Promise.all([
    cp(workletSource, workletTarget),
    cp(styleSource, styleTarget),
    cp(soundFontSource, soundFontTarget),
    cp(soundFontLicenseSource, soundFontLicenseTarget),
    cp(instrumentSpriteSource, instrumentSpriteTarget),
    cp(extensionIconSource, extensionIconTarget)
  ]);
  console.log("Watching extension and webview sources.");
} else {
  await Promise.all(builds.map((options) => build(options)));
  await Promise.all([
    cp(workletSource, workletTarget),
    cp(styleSource, styleTarget),
    cp(soundFontSource, soundFontTarget),
    cp(soundFontLicenseSource, soundFontLicenseTarget),
    cp(instrumentSpriteSource, instrumentSpriteTarget),
    cp(extensionIconSource, extensionIconTarget)
  ]);
  console.log("Built extension and webview.");
}
