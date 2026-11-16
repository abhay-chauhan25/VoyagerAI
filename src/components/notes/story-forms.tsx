"use client";

import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { draftStory, forkStory, publishStory, unpublishStory } from "@/lib/notes/actions";
import {
  MAX_STORY_LENGTH,
  VISIBILITIES,
  VISIBILITY_LABEL,
  type Visibility,
} from "@/lib/notes/schemas";

type Existing = { title: string; body: string; visibility: Visibility };

/**
 * Publishes a trip as a story. Compass can write a first draft, but nothing is saved until the
 * owner has read it and pressed Publish.
 */
export function StoryForm({
  tripId,
  tripTitle,
  existing,
}: {
  tripId: string;
  tripTitle: string;
  existing: Existing | null;
}) {
  const [title, setTitle] = useState(existing?.title ?? tripTitle);
  const [body, setBody] = useState(existing?.body ?? "");
  const [note, setNote] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [pending, start] = useTransition();

  const draft = () =>
    start(async () => {
      const result = await draftStory({ tripId });
      if (!result.ok || !result.draft) {
        setNote({
          text: result.ok ? "That didn't work. Try again." : result.message,
          tone: "error",
        });
        return;
      }
      setTitle(result.draft.title);
      setBody(result.draft.body);
      setNote({
        text:
          result.message ??
          "Compass drafted this from your places. Rewrite it in your own words before publishing.",
        tone: "info",
      });
    });

  const publish = (form: FormData) =>
    start(async () => {
      const result = await publishStory({
        tripId,
        title,
        body,
        visibility: form.get("visibility"),
      });
      if (result && !result.ok) setNote({ text: result.message, tone: "error" });
    });

  return (
    <form action={publish} className="flex max-w-[40rem] flex-col gap-6">
      <label className="flex flex-col gap-1.5 text-ui font-semibold">
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={80}
          className="min-h-11 rounded-control border border-control bg-panel px-3 text-body font-normal"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5 text-ui font-semibold">
          Story
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={10}
            maxLength={MAX_STORY_LENGTH}
            className="rounded-control border border-control bg-panel px-3 py-2.5 text-body font-normal"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={draft}
            disabled={pending}
            className={buttonClasses("secondary")}
          >
            {body ? "Draft again with Compass" : "Draft with Compass"}
          </button>
          <span className="text-meta text-muted">Uses one of today&apos;s Compass requests.</span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-ui font-semibold">
        Who can see this
        <select
          name="visibility"
          defaultValue={existing?.visibility ?? "private"}
          className="min-h-11 rounded-control border border-control bg-panel px-3 text-body font-normal"
        >
          {VISIBILITIES.map((visibility) => (
            <option key={visibility} value={visibility}>
              {VISIBILITY_LABEL[visibility]}
            </option>
          ))}
        </select>
      </label>
      <p className="-mt-3 text-meta text-muted">
        A story shares this trip&apos;s places and days. It never shares who you travelled with,
        votes, prices you entered or your notes. People who can see it can copy it into their own
        trips.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClasses("primary")}>
          {existing ? "Publish changes" : "Publish"}
        </button>
        <p
          aria-live="polite"
          className={`text-ui ${note?.tone === "error" ? "font-semibold text-negative" : "text-muted"}`}
        >
          {note?.text}
        </p>
      </div>
    </form>
  );
}

/** Copies a story into the reader's own trips, starting on the date they choose. */
export function ForkForm({ storyId, defaultDate }: { storyId: string; defaultDate: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(form) =>
        start(async () => {
          const result = await forkStory({ storyId, startDate: form.get("startDate") });
          if (result && !result.ok) setError(result.message);
        })
      }
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col gap-1.5 text-ui font-semibold">
        Your start date
        <input
          type="date"
          name="startDate"
          required
          defaultValue={defaultDate}
          className="min-h-11 rounded-control border border-control bg-panel px-3 text-body font-normal"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClasses("primary")}>
        {pending ? "Copying…" : "Fork this trip"}
      </button>
      {error ? (
        <p role="alert" className="basis-full text-ui font-semibold text-negative">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Takes the owner's story down. */
export function UnpublishButton({ storyId }: { storyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await unpublishStory({ storyId });
            if (result && !result.ok) setError(result.message);
          })
        }
        className="pressable min-h-8 text-ui text-muted underline underline-offset-4 hover:text-ink disabled:opacity-60"
      >
        Unpublish
      </button>
      {error ? (
        <span role="alert" className="text-meta font-semibold text-negative">
          {error}
        </span>
      ) : null}
    </span>
  );
}
