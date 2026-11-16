"use client";

import { useState, useTransition } from "react";
import { deleteNote, setFollow } from "@/lib/notes/actions";

/** Follow or unfollow a traveller; the button says what pressing it will do. */
export function FollowButton({
  userId,
  name,
  following,
}: {
  userId: string;
  name: string;
  following: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
        onClick={() =>
          start(async () => {
            const result = await setFollow({ userId, follow: !following });
            setError(result.ok ? null : result.message);
          })
        }
        className={`pressable min-h-8 rounded-control border px-3 text-meta font-semibold disabled:opacity-60 ${
          following
            ? "border-control text-muted hover:bg-raised"
            : "border-primary bg-primary text-primary-ink hover:bg-primary-hover"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
      {error ? (
        <span role="alert" className="text-meta font-semibold text-negative">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** Deletes the traveller's own note, after a second press to confirm. */
export function DeleteNote({ noteId }: { noteId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="pressable min-h-8 text-meta text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-3 text-meta">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await deleteNote({ noteId });
            if (!result.ok) setError(result.message);
          })
        }
        className="pressable min-h-8 font-semibold text-negative underline-offset-4 hover:underline disabled:opacity-60"
      >
        Delete this note
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="pressable min-h-8 text-muted underline-offset-4 hover:underline"
      >
        Keep it
      </button>
      {error ? (
        <span role="alert" className="font-semibold text-negative">
          {error}
        </span>
      ) : null}
    </span>
  );
}
