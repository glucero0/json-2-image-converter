import { GoogleGenAI } from "@google/genai";
import { DEFAULT_IMAGE_MODEL } from "./types.js";

export interface GeneratedImage {
  bytes: Buffer;
  mimeType: string;
}

export async function generateImage(options: {
  prompt: string;
  apiKey: string;
  model?: string;
}): Promise<GeneratedImage> {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const model = options.model ?? DEFAULT_IMAGE_MODEL;

  const response = await ai.models.generateContent({
    model,
    contents: options.prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        bytes: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  const text = parts
    .map((part) => part.text)
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .trim();

  throw new Error(
    text
      ? `Gemini returned text instead of an image: ${text.slice(0, 400)}`
      : "Gemini did not return image data.",
  );
}
