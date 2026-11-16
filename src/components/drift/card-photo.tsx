"use client";

import Image from "next/image";
import { useState } from "react";

/** How long to wait before asking for a failed photo once more. */
const RETRY_AFTER_MS = 1200;

type Props = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** What to show if the photo can't be loaded at all. */
  fallback: React.ReactNode;
};

/**
 * A place's photo from Wikimedia Commons. Their image servers sometimes refuse a request when
 * several arrive at once; the photo is then asked for once more, and if it still doesn't come the
 * card shows its no-photo face instead of a broken picture.
 */
export function CardPhoto({ src, alt, sizes, priority, fallback }: Props) {
  const [attempt, setAttempt] = useState(0);
  if (attempt > 1) return <>{fallback}</>;
  return (
    <Image
      // A new key makes the browser ask again rather than reuse the failed request.
      key={attempt}
      src={src}
      unoptimized
      alt={alt}
      fill
      priority={priority}
      draggable={false}
      sizes={sizes}
      onError={() => {
        if (attempt === 0) window.setTimeout(() => setAttempt(1), RETRY_AFTER_MS);
        else setAttempt(2);
      }}
      className="pointer-events-none object-cover"
    />
  );
}
