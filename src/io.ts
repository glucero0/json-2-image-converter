import { readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

export const MAX_INPUT_BYTES = 2 * 1024 * 1024;

const ALLOWED_ENV_KEYS = new Set(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);

export function resolveExistingFile(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  let stats;
  try {
    stats = statSync(resolved);
  } catch {
    throw new Error(`File not found: ${resolved}`);
  }
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${resolved}`);
  }
  if (stats.size > MAX_INPUT_BYTES) {
    throw new Error(`File exceeds the ${MAX_INPUT_BYTES} byte input limit: ${resolved}`);
  }
  if (path.extname(resolved).toLowerCase() !== ".json") {
    throw new Error("Input must be a .json file.");
  }
  return resolved;
}

export function sourceBaseName(filePath: string): string {
  let base = path.basename(filePath, path.extname(filePath));
  if (base.endsWith(".scene")) {
    base = base.slice(0, -".scene".length);
  }
  return base;
}

export function companionPath(filePath: string, suffix: string): string {
  const directory = path.dirname(filePath);
  const base = sourceBaseName(filePath);
  const target = path.resolve(directory, `${base}${suffix}`);
  if (path.dirname(target) !== directory) {
    throw new Error("Refusing to write outside the input file directory.");
  }
  return target;
}

export function imagePath(filePath: string, locationId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(locationId)) {
    throw new Error(`Unsafe location id for filename: ${locationId}`);
  }
  return companionPath(filePath, `.${locationId}.png`);
}

export function scenePath(filePath: string): string {
  return companionPath(filePath, ".scene.json");
}

export function readJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`);
  }
}

export function writeJsonFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeBinaryFile(filePath: string, bytes: Buffer): void {
  writeFileSync(filePath, bytes);
}

/**
 * Load only known API-key names from a local .env, without overriding
 * variables already present in the process environment.
 */
export function loadLocalEnvFile(cwd: string = process.cwd()): void {
  const envPath = path.resolve(cwd, ".env");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^(GEMINI_API_KEY|GOOGLE_API_KEY)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const key = match[1];
    if (!key || !ALLOWED_ENV_KEYS.has(key) || process.env[key]) {
      continue;
    }
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function readApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return key || undefined;
}
