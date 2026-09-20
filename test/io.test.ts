import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  companionPath,
  imagePath,
  loadLocalEnvFile,
  readApiKey,
  resolveExistingFile,
  scenePath,
  sourceBaseName,
} from "../src/io.js";

describe("io helpers", () => {
  it("derives companion names from the source base filename", () => {
    const input = path.join("C:", "data", "example_file.json");
    assert.equal(sourceBaseName(input), "example_file");
    assert.equal(path.basename(scenePath(input)), "example_file.scene.json");
    assert.equal(path.basename(imagePath(input, "small_house")), "example_file.small_house.png");
  });

  it("strips .scene from a scene filename before naming images", () => {
    const input = path.join("C:", "data", "example_file.scene.json");
    assert.equal(sourceBaseName(input), "example_file");
    assert.equal(path.basename(imagePath(input, "small_house")), "example_file.small_house.png");
  });

  it("rejects unsafe location ids in image names", () => {
    assert.throws(() => imagePath("example_file.json", "../secret"), /Unsafe location id/);
  });

  it("rejects missing files and non-json inputs", () => {
    assert.throws(() => resolveExistingFile("definitely-missing.json"), /not found/i);
  });

  it("loads only known key names from .env without overriding the process", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "json-to-image-"));
    writeFileSync(
      path.join(directory, ".env"),
      ["GEMINI_API_KEY=from-file", "SECRET=ignore-me", "GOOGLE_API_KEY=other-key"].join("\n"),
      "utf8",
    );

    const previousGemini = process.env.GEMINI_API_KEY;
    const previousGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      loadLocalEnvFile(directory);
      assert.equal(process.env.GEMINI_API_KEY, "from-file");
      assert.equal(process.env.GOOGLE_API_KEY, "other-key");
      assert.equal(process.env.SECRET, undefined);
      assert.equal(readApiKey(), "from-file");
      assert.equal(
        companionPath(path.join(directory, "world.json"), ".scene.json"),
        path.join(directory, "world.scene.json"),
      );
    } finally {
      if (previousGemini === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = previousGemini;
      }
      if (previousGoogle === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = previousGoogle;
      }
    }
  });
});
