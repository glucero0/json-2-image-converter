import type { LocationScene, SceneDocument, VisualObject } from "./types.js";

const WALL_ORDER = ["north", "east", "south", "west", "center"] as const;

function objectsOn(objects: VisualObject[], position: string): VisualObject[] {
  return objects.filter((object) => object.position === position);
}

function describeObject(object: VisualObject): string {
  const stateEntries = Object.entries(object.state).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  const stateText =
    stateEntries.length > 0
      ? ` Current state: ${stateEntries.map(([key, value]) => `${key}=${String(value)}`).join(", ")}.`
      : "";
  return `- ${object.name} (${object.kind}, ${object.position}): ${object.appearance}${stateText}`;
}

export function buildPrompt(document: SceneDocument, scene: LocationScene): string {
  const existing = scene.prompt.trim();
  if (existing) {
    return existing;
  }
  return composePrompt(document, scene);
}

export function composePrompt(document: SceneDocument, scene: LocationScene): string {
  const { style } = document;
  const { room, camera, lights, objects } = scene;
  const setting =
    room.environment === "interior"
      ? "a single modest interior room"
      : "an outdoor location";

  const wallBlocks = WALL_ORDER.map((wall) => {
    const here = objectsOn(objects, wall);
    if (here.length === 0) {
      return null;
    }
    const heading =
      wall === "center"
        ? "CENTER / OPEN SPACE"
        : `${wall.toUpperCase()} (${wallLabel(wall, camera)})`;
    return `${heading}\n${here.map(describeObject).join("\n")}`;
  }).filter((block): block is string => Boolean(block));

  const windowLine = room.impliedWindow.present
    ? `A window is implied on the ${room.impliedWindow.wall ?? "unspecified"} wall. ${room.impliedWindow.notes}`
    : "No window is implied unless an object describes one.";

  return [
    `Create one still image of ${setting} named "${room.name}".`,
    "",
    "STYLE",
    style.medium,
    style.camera,
    style.materials,
    style.lighting,
    `Palette: ${style.palette}`,
    `Avoid: ${style.avoid.join("; ")}.`,
    "",
    "CAMERA",
    `Stand at the ${camera.stand} side, look toward ${camera.look}. Eye height ${camera.heightMeters} m, FOV about ${camera.fovDegrees} degrees.`,
    camera.notes,
    "",
    "SPACE",
    room.description,
    `Approximate size: ${room.widthMeters} m wide, ${room.depthMeters} m deep, ${room.heightMeters} m high.`,
    `Floor: ${room.floor}`,
    `Walls or edges: ${room.walls}`,
    windowLine,
    "",
    "LIGHTS",
    ...lights.map((light) => `- ${light.id} (${light.type}${light.from ? `, from ${light.from}` : ""}): ${light.notes}`),
    "",
    "PLACE THESE SUBJECTS AND NO OTHERS",
    ...wallBlocks,
    "",
    "Output a single 16:9 frame. No collage, no split screen, no caption.",
  ].join("\n");
}

function wallLabel(wall: string, camera: LocationScene["camera"]): string {
  if (wall === camera.look) {
    return "back wall from camera";
  }
  if (wall === camera.stand) {
    return "foreground / behind or beside camera";
  }
  if (camera.look === "north") {
    if (wall === "west") return "left";
    if (wall === "east") return "right";
  }
  return wall;
}
