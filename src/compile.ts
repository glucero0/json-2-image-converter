import type { AdventureDocument, AdventureLocation } from "./schemas.js";
import { composePrompt } from "./prompt.js";
import {
  DEFAULT_STYLE,
  SCENE_KIND,
  SCENE_VERSION,
  type Cardinal,
  type CompileOptions,
  type Environment,
  type LocationScene,
  type SceneDocument,
  type VisualObject,
} from "./types.js";

const VISUAL_STATE_KEYS = new Set([
  "status",
  "isOpen",
  "isLocked",
  "isClean",
  "isWorn",
  "coatTaken",
  "isRested",
  "hasFished",
]);

const OUTDOOR_HINT = /\b(clearing|forest|woods|path|pond|lake|field|meadow|road|trail|outside|garden)\b/i;

export function compileAdventure(
  adventure: AdventureDocument,
  options: CompileOptions,
): SceneDocument {
  const selectedIds = options.locationIds
    ? new Set(options.locationIds)
    : null;

  if (selectedIds) {
    for (const id of selectedIds) {
      if (!adventure.locations.some((location) => location.id === id)) {
        const known = adventure.locations.map((location) => location.id).join(", ");
        throw new Error(`Location "${id}" was not found. Known locations: ${known}`);
      }
    }
  }

  const locations = adventure.locations.filter(
    (location) => !selectedIds || selectedIds.has(location.id),
  );

  const document: SceneDocument = {
    comment:
      "Human-editable scene file. Tweak room, camera, objects, or the prompt, then rerun the CLI on this .scene.json file. Leave prompt empty to rebuild it from the structured fields.",
    kind: SCENE_KIND,
    version: SCENE_VERSION,
    source: {
      file: options.sourceFileName,
      compiledAt: new Date().toISOString(),
    },
    style: { ...DEFAULT_STYLE, avoid: [...DEFAULT_STYLE.avoid] },
    initialLocationId: adventure.initialLocationId,
    scenes: locations.map((location) => compileLocation(location)),
  };

  for (const scene of document.scenes) {
    scene.prompt = composePrompt(document, { ...scene, prompt: "" });
  }

  return document;
}

export function compileLocation(location: AdventureLocation): LocationScene {
  const environment = inferEnvironment(location);
  const objects = collectObjects(location);
  const windowWall = inferWindow(location, environment);

  return {
    id: location.id,
    name: location.name,
    room: {
      environment,
      name: location.name,
      description: location.description,
      widthMeters: environment === "interior" ? 5.5 : 14,
      depthMeters: environment === "interior" ? 6.5 : 16,
      heightMeters: environment === "interior" ? 2.6 : 8,
      floor:
        environment === "interior"
          ? "Pale oak hardwood boards"
          : "Packed earth, short grass, and a dirt path",
      walls:
        environment === "interior"
          ? "Cream plaster with simple timber trim"
          : "Open tree line and sky; no interior walls",
      impliedWindow: {
        present: environment === "interior" && /\bwindow\b/i.test(location.description),
        wall: windowWall,
        notes:
          environment === "interior" && windowWall
            ? "Sunlight filters through this window onto the floor."
            : "",
      },
    },
    camera: {
      stand: "south",
      look: "north",
      heightMeters: 1.5,
      fovDegrees: 60,
      notes:
        "Eye-level first-person view from the south, looking toward the north side of the location.",
    },
    lights: [
      {
        id: "ambient",
        type: "ambient",
        notes: "Soft fill so shadows stay gentle.",
      },
      {
        id: "sun",
        type: "sun",
        from: windowWall ?? "east",
        notes:
          environment === "interior"
            ? "Warm daylight entering from the implied window."
            : "Open daylight from a clear sky.",
      },
    ],
    objects,
    prompt: "",
  };
}

function inferEnvironment(location: AdventureLocation): Environment {
  const haystack = `${location.id} ${location.name} ${location.description}`;
  return OUTDOOR_HINT.test(haystack) ? "exterior" : "interior";
}

function inferWindow(
  location: AdventureLocation,
  environment: Environment,
): Cardinal | null {
  if (environment !== "interior" || !/\bwindow\b/i.test(location.description)) {
    return null;
  }
  const occupied = new Set(
    location.objects
      .map((object) => object.position)
      .filter((position) => position && position !== "center"),
  );
  if (!occupied.has("west")) {
    return "west";
  }
  if (!occupied.has("east")) {
    return "east";
  }
  return "west";
}

function collectObjects(location: AdventureLocation): VisualObject[] {
  const objects: VisualObject[] = location.objects.map((object) => ({
    id: object.id,
    name: object.name,
    kind: /door|exit|path/i.test(`${object.id} ${object.name}`) ? "exit" : "prop",
    position: object.position,
    appearance: object.lookDescription || object.name,
    state: pickVisualState(object.state),
  }));

  for (const npc of location.npcs) {
    objects.push({
      id: npc.id,
      name: npc.title ? `${npc.name}, ${npc.title}` : npc.name,
      kind: "npc",
      position: npc.position,
      appearance: npc.personality || npc.name,
      state: {},
    });
  }

  return objects;
}

function pickVisualState(
  state: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const picked: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(state)) {
    if (VISUAL_STATE_KEYS.has(key)) {
      picked[key] = value;
    }
  }
  return picked;
}
