export const SCENE_KIND = "json-to-image-scene" as const;
export const SCENE_VERSION = 1;
export const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

export type Cardinal = "north" | "south" | "east" | "west" | "center";
export type Environment = "interior" | "exterior";

export interface VisualObject {
  id: string;
  name: string;
  kind: "prop" | "exit" | "npc";
  position: Cardinal;
  appearance: string;
  state: Record<string, string | number | boolean | null>;
}

export interface SceneCamera {
  stand: Cardinal;
  look: Cardinal;
  heightMeters: number;
  fovDegrees: number;
  notes: string;
}

export interface SceneLight {
  id: string;
  type: "sun" | "ambient";
  from?: Cardinal;
  notes: string;
}

export interface SceneRoom {
  environment: Environment;
  name: string;
  description: string;
  widthMeters: number;
  depthMeters: number;
  heightMeters: number;
  floor: string;
  walls: string;
  impliedWindow: {
    present: boolean;
    wall: Cardinal | null;
    notes: string;
  };
}

export interface StyleGuide {
  medium: string;
  camera: string;
  materials: string;
  lighting: string;
  palette: string;
  avoid: string[];
}

export interface LocationScene {
  id: string;
  name: string;
  room: SceneRoom;
  camera: SceneCamera;
  lights: SceneLight[];
  objects: VisualObject[];
  prompt: string;
}

export interface SceneDocument {
  comment: string;
  kind: typeof SCENE_KIND;
  version: typeof SCENE_VERSION;
  source: {
    file: string;
    compiledAt: string;
  };
  style: StyleGuide;
  initialLocationId?: string;
  scenes: LocationScene[];
}

export interface CompileOptions {
  sourceFileName: string;
  locationIds?: string[];
}

export const DEFAULT_STYLE: StyleGuide = {
  medium:
    "Stylized 3D still, smooth shading, simple rounded silhouettes. Not photorealistic, not painterly, not pixel art.",
  camera:
    "Eye-level first-person view, slight wide angle, standing at the south side of the space looking inward.",
  materials:
    "Pale oak hardwood or packed earth underfoot, cream plaster or timber walls, matte wood furniture.",
  lighting:
    "Soft global illumination and warm daylight. No hard cinematic rim lights, no neon.",
  palette: "Warm neutrals: cream, pale oak, charcoal accents, muted greens outdoors.",
  avoid: [
    "staircases unless the location mentions stairs",
    "modern sofas, file cabinets, or extra furniture not listed",
    "UI chrome, captions, watermarks, or readable text overlays",
    "people unless an NPC is listed",
  ],
};
