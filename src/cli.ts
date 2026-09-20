#!/usr/bin/env node
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileAdventure } from "./compile.js";
import { generateImage } from "./generate.js";
import {
  imagePath,
  loadLocalEnvFile,
  readApiKey,
  readJsonFile,
  resolveExistingFile,
  scenePath,
  writeBinaryFile,
  writeJsonFile,
} from "./io.js";
import { buildPrompt } from "./prompt.js";
import { AdventureDocumentSchema, SceneDocumentSchema } from "./schemas.js";
import { DEFAULT_IMAGE_MODEL, SCENE_KIND, type SceneDocument } from "./types.js";

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_GENERATE = 2;

function printHelp(): void {
  console.log(`Usage: json-to-image <file.json> [options]

Compile an adventure location file into a human-editable scene file saved
alongside it (same base name, .scene.json). Optionally render stills with
Gemini when GEMINI_API_KEY is set.

Scene compilation never needs an API key. Image generation does.

Options:
  -l, --location <id>   Compile or render only this location
      --all-images      Generate a still for every scene (costs one API call each)
      --no-image        Write the scene file only
      --model <name>    Gemini image model (default: ${DEFAULT_IMAGE_MODEL})
  -v, --verbose         Print the prompt sent to Gemini
  -h, --help            Show this help

Examples:
  json-to-image example_file.json
  json-to-image example_file.json --location small_house
  json-to-image example_file.scene.json
  json-to-image example_file.json --no-image
`);
}

function detectKind(value: unknown): "adventure" | "scene" | "unknown" {
  if (!value || typeof value !== "object") {
    return "unknown";
  }
  const record = value as Record<string, unknown>;
  if (record.kind === SCENE_KIND) {
    return "scene";
  }
  if (Array.isArray(record.locations)) {
    return "adventure";
  }
  return "unknown";
}

function selectScenes(document: SceneDocument, locationId?: string): SceneDocument["scenes"] {
  if (!locationId) {
    return document.scenes;
  }
  const match = document.scenes.filter((scene) => scene.id === locationId);
  if (match.length === 0) {
    const known = document.scenes.map((scene) => scene.id).join(", ");
    throw new Error(`Location "${locationId}" was not found. Known locations: ${known}`);
  }
  return match;
}

function scenesToRender(
  document: SceneDocument,
  options: { location?: string; allImages: boolean },
): SceneDocument["scenes"] {
  if (options.location) {
    return selectScenes(document, options.location);
  }
  if (options.allImages) {
    return document.scenes;
  }
  if (document.initialLocationId) {
    const initial = document.scenes.find((scene) => scene.id === document.initialLocationId);
    if (initial) {
      return [initial];
    }
  }
  const first = document.scenes[0];
  return first ? [first] : [];
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        location: { type: "string", short: "l" },
        "all-images": { type: "boolean", default: false },
        "no-image": { type: "boolean", default: false },
        model: { type: "string" },
        verbose: { type: "boolean", short: "v", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return EXIT_USAGE;
  }

  if (values.help) {
    printHelp();
    return EXIT_OK;
  }

  const inputArg = positionals[0];
  if (!inputArg) {
    printHelp();
    return EXIT_USAGE;
  }

  loadLocalEnvFile();

  const inputPath = resolveExistingFile(inputArg);
  const parsed = readJsonFile(inputPath);
  const kind = detectKind(parsed);
  const sourceName = path.basename(inputPath);

  let document: SceneDocument;
  let sceneFile = scenePath(inputPath);

  if (kind === "adventure") {
    const adventure = AdventureDocumentSchema.parse(parsed);
    document = compileAdventure(adventure, {
      sourceFileName: sourceName,
      locationIds: values.location ? [values.location] : undefined,
    });
    writeJsonFile(sceneFile, document);
    console.log(`Wrote scene file: ${sceneFile}`);
  } else if (kind === "scene") {
    document = SceneDocumentSchema.parse(parsed) as SceneDocument;
    sceneFile = inputPath;
    console.log(`Using scene file: ${sceneFile}`);
  } else {
    console.error(
      "Input JSON must be an adventure document (locations[]) or a scene file (kind: json-to-image-scene).",
    );
    return EXIT_USAGE;
  }

  if (values["no-image"]) {
    return EXIT_OK;
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    console.log(
      "No GEMINI_API_KEY set. Scene file is ready. Set the key and rerun on the .scene.json file to render an image.",
    );
    return EXIT_OK;
  }

  const targets = scenesToRender(document, {
    location: values.location,
    allImages: Boolean(values["all-images"]),
  });

  if (targets.length === 0) {
    console.error("No scenes to render.");
    return EXIT_USAGE;
  }

  const model = values.model ?? DEFAULT_IMAGE_MODEL;
  let failed = 0;

  for (const scene of targets) {
    const prompt = buildPrompt(document, scene);
    if (values.verbose) {
      console.log(`\n--- prompt:${scene.id} ---\n${prompt}\n`);
    }

    const output = imagePath(inputPath, scene.id);
    try {
      console.log(`Generating ${scene.id} with ${model}...`);
      const image = await generateImage({ prompt, apiKey, model });
      writeBinaryFile(output, image.bytes);
      console.log(`Wrote image: ${output} (${image.mimeType})`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to generate ${scene.id}: ${sanitizeError(message)}`);
    }
  }

  return failed > 0 ? EXIT_GENERATE : EXIT_OK;
}

function sanitizeError(message: string): string {
  return message.replace(
    /(?:AIza|GOOG)[A-Za-z0-9_-]{10,}/g,
    "[redacted]",
  );
}

const thisFile = fileURLToPath(import.meta.url);
const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1] as string) === path.resolve(thisFile);

if (invokedDirectly) {
  run().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exitCode = EXIT_USAGE;
    },
  );
}
