"use client";

import Image, { type StaticImageData } from "next/image";
import type { Reaction } from "@/lib/dna/score";
import { SwipeDeck } from "@/components/deck/swipe-deck";

export type DeckScene = { id: string; title: string; photo: StaticImageData; alt: string };

type Props = {
  scenes: readonly DeckScene[];
  answers: Readonly<Record<string, Reaction>>;
  onAnswer: (sceneId: string, reaction: Reaction) => void;
  onUndo: () => void;
};

/** The Travel DNA deck: the shared swipe deck over the onboarding scenes. */
export function SceneDeck({ scenes, answers, onAnswer, onUndo }: Props) {
  const remaining = scenes.filter((scene) => !answers[scene.id]);
  const answered = scenes.length - remaining.length;

  return (
    <SwipeDeck
      items={remaining}
      keyOf={(scene) => scene.id}
      describe={(scene) => `Scene ${answered + 1} of ${scenes.length}: ${scene.title}`}
      progress={`${answered + 1} of ${scenes.length}`}
      onUndo={onUndo}
      canUndo={answered > 0}
      onAnswer={(scene, reaction) => onAnswer(scene.id, reaction)}
      renderPeek={(scene) => (
        <Image
          src={scene.photo}
          alt=""
          fill
          sizes="24rem"
          className="object-cover"
          placeholder="blur"
        />
      )}
      renderCard={(scene) => (
        <>
          <div className="relative flex-1">
            <Image
              src={scene.photo}
              alt={scene.alt}
              fill
              priority
              draggable={false}
              sizes="(min-width: 640px) 24rem, 92vw"
              className="pointer-events-none object-cover"
              placeholder="blur"
            />
          </div>
          <p className="px-5 py-4 text-lead font-semibold">{scene.title}</p>
        </>
      )}
    />
  );
}
