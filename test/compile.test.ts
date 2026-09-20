import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compileAdventure } from "../src/compile.js";
import { AdventureDocumentSchema } from "../src/schemas.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadExample() {
  const raw = readFileSync(path.join(repoRoot, "example_file.json"), "utf8");
  return AdventureDocumentSchema.parse(JSON.parse(raw));
}

describe("compileAdventure", () => {
  it("builds an editable scene for small_house from the example file", () => {
    const document = compileAdventure(loadExample(), {
      sourceFileName: "example_file.json",
      locationIds: ["small_house"],
    });

    assert.equal(document.kind, "json-to-image-scene");
    assert.equal(document.scenes.length, 1);
    const house = document.scenes[0];
    assert.ok(house);
    assert.equal(house.id, "small_house");
    assert.equal(house.room.environment, "interior");
    assert.equal(house.room.impliedWindow.present, true);
    assert.equal(house.camera.stand, "south");
    assert.equal(house.camera.look, "north");

    const ids = house.objects.map((object) => object.id);
    assert.deepEqual(
      new Set(ids),
      new Set(["fathers_chest", "bed", "pots_and_pans", "coat_rack", "north_door"]),
    );

    const chest = house.objects.find((object) => object.id === "fathers_chest");
    assert.equal(chest?.state.isLocked, true);
    assert.equal(chest?.position, "south");
  });

  it("treats the clearing as an exterior and keeps the NPC without dialogue", () => {
    const document = compileAdventure(loadExample(), {
      sourceFileName: "example_file.json",
      locationIds: ["clearing"],
    });
    const clearing = document.scenes[0];
    assert.ok(clearing);
    assert.equal(clearing.room.environment, "exterior");

    const jonathon = clearing.objects.find((object) => object.id === "jonathon");
    assert.ok(jonathon);
    assert.equal(jonathon.kind, "npc");
    assert.doesNotMatch(JSON.stringify(document), /Ribald/);
    assert.doesNotMatch(clearing.prompt, /dialogueLines/);
  });

  it("rejects unknown location ids", () => {
    assert.throws(
      () =>
        compileAdventure(loadExample(), {
          sourceFileName: "example_file.json",
          locationIds: ["nope"],
        }),
      /not found/,
    );
  });
});
