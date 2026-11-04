import type { StaticImageData } from "next/image";
import type { Interest } from "@/lib/interests";
import beachDay from "../../../public/images/scenes/beach-day.jpg";
import cafeMorning from "../../../public/images/scenes/cafe-morning.jpg";
import fleaMarket from "../../../public/images/scenes/flea-market.jpg";
import liveMusic from "../../../public/images/scenes/live-music.jpg";
import nightMarket from "../../../public/images/scenes/night-market.jpg";
import oldTown from "../../../public/images/scenes/old-town.jpg";
import quietGallery from "../../../public/images/scenes/quiet-gallery.jpg";
import rooftopBar from "../../../public/images/scenes/rooftop-bar.jpg";
import streetArt from "../../../public/images/scenes/street-art.jpg";
import summitSunrise from "../../../public/images/scenes/summit-sunrise.jpg";
import vineyard from "../../../public/images/scenes/vineyard.jpg";
import wildlife from "../../../public/images/scenes/wildlife.jpg";

export type Scene = {
  id: string;
  title: string;
  photo: StaticImageData;
  alt: string;
  /** How strongly the scene signals each interest, 0–1. */
  signals: Partial<Record<Interest, number>>;
};

/**
 * The onboarding deck. Each scene is a kind of moment rather than a category, so a reaction says
 * something about taste, not about a destination. Every interest is signalled by at least one scene.
 */
export const SCENES: readonly Scene[] = [
  {
    id: "night-market",
    title: "A night market at midnight, steam and noise everywhere",
    photo: nightMarket,
    alt: "Cooks at a crowded night-market stall grilling seafood",
    signals: { Food: 1, Markets: 0.8, Nightlife: 0.3 },
  },
  {
    id: "summit-sunrise",
    title: "Sunrise from a summit you climbed in the dark",
    photo: summitSunrise,
    alt: "A snow-capped peak lit gold at sunrise above prayer flags",
    signals: { Hiking: 1, Nature: 0.8, Viewpoints: 0.6 },
  },
  {
    id: "quiet-gallery",
    title: "An almost empty gallery on a weekday morning",
    photo: quietGallery,
    alt: "A visitor looking at paintings in a quiet museum gallery",
    signals: { Museums: 1, Art: 0.8, History: 0.4 },
  },
  {
    id: "beach-day",
    title: "A whole day with your feet in the sand",
    photo: beachDay,
    alt: "A sandy beach with waves and a long pier",
    signals: { Beaches: 1, Nature: 0.3 },
  },
  {
    id: "old-town",
    title: "Getting lost in an old town's lanes on purpose",
    photo: oldTown,
    alt: "A narrow cobblestone lane between old stone walls",
    signals: { Architecture: 1, History: 0.8, Viewpoints: 0.2 },
  },
  {
    id: "vineyard",
    title: "Tasting wine where the grapes grow",
    photo: vineyard,
    alt: "Rows of vines running down a hillside vineyard",
    signals: { Wine: 1, Food: 0.4, Nature: 0.3 },
  },
  {
    id: "cafe-morning",
    title: "A long coffee outside, and nowhere to be",
    photo: cafeMorning,
    alt: "A man relaxing on a café terrace chair",
    signals: { Coffee: 1, Food: 0.3 },
  },
  {
    id: "live-music",
    title: "A tiny bar and a band you've never heard of",
    photo: liveMusic,
    alt: "A musician playing double bass on a small stage",
    signals: { Music: 1, Nightlife: 0.7 },
  },
  {
    id: "wildlife",
    title: "Waiting quietly to see an animal in the wild",
    photo: wildlife,
    alt: "A giraffe among trees in a game reserve",
    signals: { Nature: 1, Hiking: 0.4 },
  },
  {
    id: "flea-market",
    title: "Haggling over something you don't need at a flea market",
    photo: fleaMarket,
    alt: "Stalls piled with second-hand goods at a covered flea market",
    signals: { Markets: 1, Shopping: 0.8 },
  },
  {
    id: "rooftop-bar",
    title: "Drinks on a rooftop above the city",
    photo: rooftopBar,
    alt: "A rooftop bar terrace with plants and the city skyline beyond",
    signals: { Nightlife: 1, Viewpoints: 0.7 },
  },
  {
    id: "street-art",
    title: "Walking a neighbourhood just for its murals",
    photo: streetArt,
    alt: "A colourful owl mural painted on an old wall",
    signals: { Art: 1, Architecture: 0.3, Shopping: 0.2 },
  },
];

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((scene) => scene.id === id);
}
