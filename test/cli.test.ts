import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { run } from "../src/cli.js";
import { SCENE_KIND } from "../src/types.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("cli", () => {
  it("writes a companion scene file without calling Gemini", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "json-to-image-cli-"));
    const input = path.join(directory, "example_file.json");
    cpSync(path.join(repoRoot, "example_file.json"), input);

    const previous = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    try {
      const code = await run([input, "--no-image", "--location", "small_house"]);
      assert.equal(code, 0);
      const sceneFile = path.join(directory, "example_file.scene.json");
      assert.equal(existsSync(sceneFile), true);
      const scene = JSON.parse(readFileSync(sceneFile, "utf8")) as {
        kind: string;
        scenes: Array<{ id: string }>;
      };
      assert.equal(scene.kind, SCENE_KIND);
      assert.deepEqual(
        scene.scenes.map((item) => item.id),
        ["small_house"],
      );
      assert.equal(existsSync(path.join(directory, "example_file.small_house.png")), false);
    } finally {
      if (previous === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = previous;
      }
    }
  });
});
