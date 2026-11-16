import { z } from "zod";

export const VISIBILITIES = ["private", "followers", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Only me",
  followers: "My followers",
  public: "Everyone on Voyager",
};

export const MAX_NOTE_LENGTH = 2000;
export const MAX_STORY_LENGTH = 4000;
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const noteInput = z.object({
  tripId: z.uuid(),
  sourceKey: z.string().min(1).max(200),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
  visibility: z.enum(VISIBILITIES),
});

export const storyInput = z.object({
  tripId: z.uuid(),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(MAX_STORY_LENGTH),
  visibility: z.enum(VISIBILITIES),
});

export const forkInput = z.object({
  storyId: z.uuid(),
  startDate: z.iso.date(),
});

export type PhotoKind = "jpg" | "png" | "webp";
export const PHOTO_MIME: Record<PhotoKind, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * Says what kind of image a file really is, from its first bytes. The name and the type a browser
 * reports are the uploader's claim; this is the check. Anything else (including SVG, which can
 * carry scripts) is refused.
 */
export function sniffPhoto(bytes: Uint8Array): PhotoKind | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return "webp";
  return null;
}
