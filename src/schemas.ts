import { z } from "zod";
import { SCENE_KIND, SCENE_VERSION } from "./types.js";

const MAX_ID = 64;
const MAX_TEXT = 4000;
const MAX_LOCATIONS = 50;
const MAX_OBJECTS = 40;

const IdSchema = z
  .string()
  .min(1)
  .max(MAX_ID)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "IDs may only use letters, digits, _ and -");

export const CardinalSchema = z.enum(["north", "south", "east", "west", "center"]);

const LoosePositionSchema = z
  .string()
  .max(32)
  .transform((value) => {
    const normalized = value.toLowerCase().trim();
    if (
      normalized === "north" ||
      normalized === "south" ||
      normalized === "east" ||
      normalized === "west" ||
      normalized === "center"
    ) {
      return normalized;
    }
    return "center" as const;
  });

const VisualStateSchema = z
  .record(z.string().max(64), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
  .optional()
  .default({});

const AdventureObjectSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).max(200),
    position: LoosePositionSchema.optional().default("center"),
    lookDescription: z.string().max(MAX_TEXT).optional().default(""),
    state: VisualStateSchema,
  })
  .passthrough();

const AdventureNpcSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).max(200),
    title: z.string().max(200).optional(),
    position: LoosePositionSchema.optional().default("center"),
    personality: z.string().max(MAX_TEXT).optional().default(""),
  })
  .passthrough();

const AdventureExitSchema = z
  .object({
    targetLocationId: z.string().max(MAX_ID).optional(),
    description: z.string().max(MAX_TEXT).optional(),
  })
  .passthrough();

const AdventureLocationSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(MAX_TEXT),
    exits: z.record(z.string().max(32), AdventureExitSchema).optional().default({}),
    objects: z.array(AdventureObjectSchema).max(MAX_OBJECTS).optional().default([]),
    npcs: z.array(AdventureNpcSchema).max(MAX_OBJECTS).optional().default([]),
  })
  .passthrough();

export const AdventureDocumentSchema = z
  .object({
    initialLocationId: z.string().max(MAX_ID).optional(),
    locations: z.array(AdventureLocationSchema).min(1).max(MAX_LOCATIONS),
  })
  .passthrough();

const VisualObjectSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(200),
  kind: z.enum(["prop", "exit", "npc"]),
  position: CardinalSchema,
  appearance: z.string().max(MAX_TEXT),
  state: z.record(
    z.string().max(64),
    z.union([z.string().max(200), z.number(), z.boolean(), z.null()]),
  ),
});

const LocationSceneSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(200),
  room: z.object({
    environment: z.enum(["interior", "exterior"]),
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(MAX_TEXT),
    widthMeters: z.number().positive().max(200),
    depthMeters: z.number().positive().max(200),
    heightMeters: z.number().positive().max(50),
    floor: z.string().max(400),
    walls: z.string().max(400),
    impliedWindow: z.object({
      present: z.boolean(),
      wall: CardinalSchema.nullable(),
      notes: z.string().max(MAX_TEXT),
    }),
  }),
  camera: z.object({
    stand: CardinalSchema,
    look: CardinalSchema,
    heightMeters: z.number().positive().max(20),
    fovDegrees: z.number().positive().max(170),
    notes: z.string().max(MAX_TEXT),
  }),
  lights: z.array(
    z.object({
      id: z.string().min(1).max(MAX_ID),
      type: z.enum(["sun", "ambient"]),
      from: CardinalSchema.optional(),
      notes: z.string().max(MAX_TEXT),
    }),
  ),
  objects: z.array(VisualObjectSchema).max(MAX_OBJECTS * 2),
  prompt: z.string().max(20_000).optional().default(""),
});

export const SceneDocumentSchema = z.object({
  comment: z.string().max(2000).optional(),
  kind: z.literal(SCENE_KIND),
  version: z.literal(SCENE_VERSION),
  source: z.object({
    file: z.string().max(500),
    compiledAt: z.string().max(80),
  }),
  style: z.object({
    medium: z.string().max(MAX_TEXT),
    camera: z.string().max(MAX_TEXT),
    materials: z.string().max(MAX_TEXT),
    lighting: z.string().max(MAX_TEXT),
    palette: z.string().max(MAX_TEXT),
    avoid: z.array(z.string().max(400)).max(20),
  }),
  initialLocationId: z.string().max(MAX_ID).optional(),
  scenes: z.array(LocationSceneSchema).min(1).max(MAX_LOCATIONS),
});

export type AdventureDocument = z.infer<typeof AdventureDocumentSchema>;
export type AdventureLocation = z.infer<typeof AdventureLocationSchema>;
export type ParsedSceneDocument = z.infer<typeof SceneDocumentSchema>;
