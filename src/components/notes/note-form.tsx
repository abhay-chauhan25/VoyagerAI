"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { addNotePhoto, createNote } from "@/lib/notes/actions";
import type { NotablePlace } from "@/lib/notes/queries";
import {
  MAX_NOTE_LENGTH,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  VISIBILITIES,
  VISIBILITY_LABEL,
} from "@/lib/notes/schemas";

const LONGEST_SIDE = 2000;
const JPEG_QUALITY = 0.86;
const RATING_WORDS = ["Avoid", "Fine", "Good", "Great", "Unmissable"];

/**
 * Redraws a photo onto a canvas before it leaves the device. The copy carries no hidden details
 * from the original file (where and when it was taken, the camera), and is no larger than needed.
 */
async function cleanPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("no image"))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
}

type Picked = { file: File; alt: string };

/** Writes a note about a place on one of the traveller's trips, with up to four photos. */
export function NoteForm({ places }: { places: NotablePlace[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const trips = useMemo(() => {
    const groups = new Map<string, { title: string; places: NotablePlace[] }>();
    for (const place of places) {
      const group = groups.get(place.tripId) ?? { title: place.tripTitle, places: [] };
      if (!group.places.some((p) => p.sourceKey === place.sourceKey)) group.places.push(place);
      groups.set(place.tripId, group);
    }
    return [...groups.entries()];
  }, [places]);

  const pick = (files: FileList | null) => {
    const chosen = [...(files ?? [])];
    if (chosen.some((file) => file.size > MAX_PHOTO_BYTES * 4)) {
      setMessage("One of those photos is too large to use.");
      return;
    }
    setMessage(chosen.length > MAX_PHOTOS ? `Only the first ${MAX_PHOTOS} photos are used.` : null);
    setPhotos(chosen.slice(0, MAX_PHOTOS).map((file) => ({ file, alt: "" })));
  };

  const submit = (form: FormData) =>
    start(async () => {
      setMessage(null);
      const [tripId, sourceKey] = String(form.get("place") ?? "").split("|");
      const saved = await createNote({
        tripId,
        sourceKey,
        rating: form.get("rating"),
        body: form.get("body"),
        visibility: form.get("visibility"),
      });
      if (!saved.ok || !saved.noteId) {
        setMessage(saved.ok ? "That didn't work. Try again." : saved.message);
        return;
      }
      let failed = 0;
      for (const [position, photo] of photos.entries()) {
        try {
          const upload = new FormData();
          upload.set("noteId", saved.noteId);
          upload.set("position", String(position));
          upload.set("alt", photo.alt);
          upload.set("photo", new File([await cleanPhoto(photo.file)], "photo.jpg"));
          if (!(await addNotePhoto(upload)).ok) failed += 1;
        } catch {
          failed += 1; // a file the browser can't read as an image
        }
      }
      // The note is saved either way; say so if any photo was left behind.
      router.push(failed ? `/notes?view=mine&photos=${failed}` : "/notes?view=mine");
    });

  return (
    <form action={submit} className="flex max-w-[40rem] flex-col gap-6">
      <label className="flex flex-col gap-1.5 text-ui font-semibold">
        Place
        <select
          name="place"
          required
          defaultValue=""
          className="min-h-11 rounded-control border border-control bg-panel px-3 text-body font-normal"
        >
          <option value="" disabled>
            Choose a place from your trips
          </option>
          {trips.map(([tripId, trip]) => (
            <optgroup key={tripId} label={trip.title}>
              {trip.places.map((place) => (
                <option key={place.sourceKey} value={`${tripId}|${place.sourceKey}`}>
                  {place.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-ui font-semibold">Rating</legend>
        <div className="flex flex-wrap gap-2">
          {RATING_WORDS.map((word, i) => (
            <label
              key={word}
              className="pressable flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-control bg-panel px-3 text-ui has-checked:border-primary has-checked:bg-active has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="rating"
                value={i + 1}
                required
                className="sr-only"
                aria-label={`${i + 1} out of 5: ${word}`}
              />
              <span className="font-mono text-meta">{i + 1}</span>
              {word}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-ui font-semibold">
        What would you tell a friend?
        <textarea
          name="body"
          required
          rows={5}
          maxLength={MAX_NOTE_LENGTH}
          className="rounded-control border border-control bg-panel px-3 py-2.5 text-body font-normal"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5 text-ui font-semibold">
          Photos (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => pick(event.target.files)}
            className="text-ui font-normal file:mr-3 file:min-h-10 file:rounded-control file:border file:border-control file:bg-panel file:px-3 file:font-semibold"
          />
        </label>
        <p className="text-meta text-muted">
          Up to {MAX_PHOTOS}, 5 MB each. Location and camera details are removed before upload.
        </p>
        {photos.map((photo, i) => (
          <label key={`${photo.file.name}-${i}`} className="flex flex-col gap-1 text-meta">
            <span>
              Describe photo {i + 1} <span className="text-muted">({photo.file.name})</span>
            </span>
            <input
              value={photo.alt}
              maxLength={200}
              onChange={(event) =>
                setPhotos((list) =>
                  list.map((p, j) => (j === i ? { ...p, alt: event.target.value } : p)),
                )
              }
              className="min-h-10 rounded-control border border-control bg-panel px-3 text-ui"
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-ui font-semibold">
        Who can see this
        <select
          name="visibility"
          defaultValue="private"
          className="min-h-11 rounded-control border border-control bg-panel px-3 text-body font-normal"
        >
          {VISIBILITIES.map((visibility) => (
            <option key={visibility} value={visibility}>
              {VISIBILITY_LABEL[visibility]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClasses("primary")}>
          {pending ? "Saving…" : "Save note"}
        </button>
        <p aria-live="polite" className="text-ui font-semibold text-negative">
          {message}
        </p>
      </div>
    </form>
  );
}
