"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumeAiQuota } from "@/lib/ai/quota";
import { createClient } from "@/lib/supabase/server";
import { tripProviders } from "@/lib/trips/providers";
import { loadTrip } from "@/lib/trips/queries";
import { syncRoutes } from "@/lib/trips/service";
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTO_MIME,
  forkInput,
  noteInput,
  sniffPhoto,
  storyInput,
} from "./schemas";
import { templateStory, type StoryDraft, type StoryTrip } from "./story";

export type NotesResult<T = unknown> =
  ({ ok: true; message?: string } & T) | { ok: false; message: string };

const FAILED = { ok: false, message: "That didn't work. Try again." } as const;
const BUCKET = "note-photos";

async function session(next = "/notes") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

/* ---------- Notes ---------- */

/**
 * Saves a note about a stop on one of the traveller's trips. The place and city names are read
 * from the trip, not taken from the form, so a note can't be filed under a made-up place.
 */
export async function createNote(input: unknown): Promise<NotesResult<{ noteId?: string }>> {
  const parsed = noteInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Pick a place, give it a rating and write a few words." };
  const { supabase } = await session("/notes/new");
  const { data: stop, error: stopError } = await supabase
    .from("trip_stops")
    .select("place, trip:trips!inner(city:cities!inner(name))")
    .eq("trip_id", parsed.data.tripId)
    .eq("source_key", parsed.data.sourceKey)
    .limit(1)
    .maybeSingle();
  if (stopError || !stop) return { ok: false, message: "That place isn't on one of your trips." };

  const noteId = randomUUID();
  const { error } = await supabase.from("notes").insert({
    id: noteId,
    trip_id: parsed.data.tripId,
    source_key: parsed.data.sourceKey,
    place_name: String((stop.place as { name?: unknown }).name ?? "").slice(0, 120),
    city_name: stop.trip.city.name,
    rating: parsed.data.rating,
    body: parsed.data.body,
    visibility: parsed.data.visibility,
  });
  if (error) {
    console.error("Saving a note failed", { code: error.code });
    return FAILED;
  }
  revalidatePath("/notes");
  return { ok: true, noteId };
}

const photoFields = z.object({
  noteId: z.uuid(),
  position: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_PHOTOS - 1),
  alt: z.string().trim().max(200),
});

/**
 * Stores one photo for the traveller's own note. The file's real type is read from its bytes; the
 * size limit and the image-only rule are enforced again by the storage bucket itself.
 */
export async function addNotePhoto(form: FormData): Promise<NotesResult> {
  const parsed = photoFields.safeParse({
    noteId: form.get("noteId"),
    position: form.get("position"),
    alt: form.get("alt") ?? "",
  });
  const file = form.get("photo");
  if (!parsed.success || !(file instanceof File)) return FAILED;
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES)
    return { ok: false, message: "Photos can be up to 5 MB each." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffPhoto(bytes);
  if (!kind) return { ok: false, message: "That file isn't a JPEG, PNG or WebP photo." };

  const { supabase, userId } = await session("/notes/new");
  const path = `${userId}/${parsed.data.noteId}/${randomUUID()}.${kind}`;
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: PHOTO_MIME[kind], upsert: false });
  if (upload.error) {
    console.error("Uploading a photo failed", { message: upload.error.message });
    return FAILED;
  }
  const { error } = await supabase.from("note_photos").insert({
    note_id: parsed.data.noteId,
    position: parsed.data.position,
    path,
    alt: parsed.data.alt,
  });
  if (error) {
    // The row was refused (not the author's note, or the slot is taken): don't leave the file behind.
    await supabase.storage.from(BUCKET).remove([path]);
    console.error("Recording a photo failed", { code: error.code });
    return FAILED;
  }
  revalidatePath("/notes");
  return { ok: true };
}

/** Deletes the traveller's own note and its photo files. */
export async function deleteNote(input: unknown): Promise<NotesResult> {
  const parsed = z.object({ noteId: z.uuid() }).safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase, userId } = await session();
  const { data: photos } = await supabase
    .from("note_photos")
    .select("path")
    .eq("note_id", parsed.data.noteId)
    .eq("user_id", userId);
  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", parsed.data.noteId)
    .eq("user_id", userId)
    .select("id");
  if (error || data.length === 0) return FAILED;
  if (photos && photos.length > 0)
    await supabase.storage.from(BUCKET).remove(photos.map((photo) => photo.path));
  revalidatePath("/notes");
  return { ok: true, message: "Note deleted." };
}

/* ---------- Follows ---------- */

const followInput = z.object({ userId: z.uuid(), follow: z.boolean() });

/** Follows or unfollows a traveller. Only public profiles can be followed; the database decides. */
export async function setFollow(input: unknown): Promise<NotesResult> {
  const parsed = followInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase, userId } = await session();
  if (parsed.data.userId === userId) return { ok: false, message: "That's you." };
  const { error } = parsed.data.follow
    ? await supabase
        .from("follows")
        .upsert({ followee_id: parsed.data.userId }, { ignoreDuplicates: true })
    : await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("followee_id", parsed.data.userId);
  if (error) {
    return error.code === "42501"
      ? { ok: false, message: "That traveller's profile isn't public." }
      : FAILED;
  }
  revalidatePath("/notes");
  revalidatePath("/u/[handle]", "page");
  return { ok: true };
}

/* ---------- Stories ---------- */

async function storyTrip(tripId: string) {
  const s = await session(`/notes/publish/${tripId}`);
  const trip = await loadTrip(s.supabase, s.userId, tripId);
  if (!trip || trip.role !== "owner") return null;
  const subject: StoryTrip = {
    title: trip.title,
    cityName: trip.cityName,
    days: trip.days.map((day) => ({
      title: day.title,
      places: trip.stops
        .filter((stop) => stop.day === day.index)
        .sort((a, b) => a.position - b.position)
        .map((stop) => stop.place.name),
    })),
  };
  return { ...s, trip, subject };
}

/**
 * Drafts a story for the owner to edit. Compass writes it when it can (one call against the daily
 * limit); otherwise a plain day-by-day draft is made from the trip. Nothing is saved here.
 */
export async function draftStory(
  input: unknown,
): Promise<NotesResult<{ draft?: StoryDraft; source?: "compass" | "template" }>> {
  const parsed = z.object({ tripId: z.uuid() }).safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await storyTrip(parsed.data.tripId);
  if (!ctx) return { ok: false, message: "Only the trip's owner can publish it." };
  const fallback = { ok: true, draft: templateStory(ctx.subject), source: "template" } as const;
  if (!(await consumeAiQuota(ctx.supabase)))
    return { ...fallback, message: "Compass has reached today's limit, so this is a plain draft." };
  const answer = await tripProviders().storyDraft(ctx.subject);
  if (!answer.ok)
    return { ...fallback, message: "Compass isn't available, so this is a plain draft." };
  return { ok: true, draft: answer.data, source: "compass" };
}

/** Publishes the owner's trip as a story, with a copy of its plan taken by the database. */
export async function publishStory(input: unknown): Promise<NotesResult> {
  const parsed = storyInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "A story needs a title and some words." };
  const { supabase } = await session(`/notes/publish/${parsed.data.tripId}`);
  const { error } = await supabase.rpc("publish_trip_story", {
    p_trip: parsed.data.tripId,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_visibility: parsed.data.visibility,
  });
  if (error) {
    return error.code === "42501"
      ? { ok: false, message: "Only the trip's owner can publish it." }
      : FAILED;
  }
  revalidatePath("/notes");
  redirect(`/notes/stories/${parsed.data.tripId}`);
}

/** Takes the owner's story down. Trips already forked from it are not affected. */
export async function unpublishStory(input: unknown): Promise<NotesResult> {
  const parsed = z.object({ storyId: z.uuid() }).safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("trip_stories")
    .delete()
    .eq("trip_id", parsed.data.storyId)
    .eq("user_id", userId)
    .select("trip_id");
  if (error || data.length === 0) return FAILED;
  revalidatePath("/notes");
  redirect("/notes?view=mine");
}

/** Copies a story the traveller can see into a new trip of their own, then opens it. */
export async function forkStory(input: unknown): Promise<NotesResult> {
  const parsed = forkInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick a start date for your copy." };
  const { supabase, userId } = await session(`/notes/stories/${parsed.data.storyId}`);
  const { data: tripId, error } = await supabase.rpc("fork_trip_story", {
    p_story: parsed.data.storyId,
    p_start: parsed.data.startDate,
  });
  if (error || !tripId) {
    return error?.code === "P0002"
      ? { ok: false, message: "That story is no longer available." }
      : FAILED;
  }
  // Travel times for the copy; a failure here only means estimates until the trip is next opened.
  const trip = await loadTrip(supabase, userId, tripId);
  if (trip) {
    await syncRoutes(supabase, trip).catch((cause: unknown) =>
      console.error("Routing a forked trip failed", { cause: String(cause) }),
    );
  }
  revalidatePath("/trips");
  redirect(`/trips/${tripId}`);
}
