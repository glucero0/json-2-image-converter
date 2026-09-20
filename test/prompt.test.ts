import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compileAdventure } from "../src/compile.js";
import { buildPrompt, composePrompt } from "../src/prompt.js";
import { AdventureDocumentSchema } from "../src/schemas.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("prompts", () => {
  it("describes the small_house layout and style lock", () => {
    const adventure = AdventureDocumentSchema.parse(
      JSON.parse(readFileSync(path.join(repoRoot, "example_file.json"), "utf8")),
    );
    const document = compileAdventure(adventure, {
      sourceFileName: "example_file.json",
      locationIds: ["small_house"],
    });
    const scene = document.scenes[0];
    assert.ok(scene);
    const prompt = composePrompt(document, { ...scene, prompt: "" });

    assert.match(prompt, /stylized 3D/i);
    assert.match(prompt, /north_door|North-facing door|heavy wooden/i);
    assert.match(prompt, /coat/);
    assert.match(prompt, /pots and pans/i);
    assert.match(prompt, /chest/);
    assert.match(prompt, /bed/i);
    assert.match(prompt, /SOUTH \(foreground/i);
    assert.doesNotMatch(prompt, /crowbar/);
    assert.doesNotMatch(prompt, /You try to open/);
  });

  it("uses an edited prompt as-is", () => {
    const adventure = AdventureDocumentSchema.parse(
      JSON.parse(readFileSync(path.join(repoRoot, "example_file.json"), "utf8")),
    );
    const document = compileAdventure(adventure, {
      sourceFileName: "example_file.json",
      locationIds: ["small_house"],
    });
    const scene = document.scenes[0];
    assert.ok(scene);
    scene.prompt = "Custom hand-edited prompt.";
    assert.equal(buildPrompt(document, scene), "Custom hand-edited prompt.");
  });
});
