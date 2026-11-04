import tram from "../../../public/images/landing/tram-bw.jpg";
import tiles from "../../../public/images/landing/azulejo-museum.jpg";
import lift from "../../../public/images/landing/santa-justa.jpg";
import santaLuzia from "../../../public/images/landing/santa-luzia.jpg";
import portEngraving from "../../../public/images/landing/port-engraving.jpg";
import baixaMap from "../../../public/images/landing/baixa-map-1756.jpg";
import rooftops from "../../../public/images/landing/alfama-rooftops.jpg";

/** The hero's fixed stage: three places in Lisbon, each with its real coordinates. */
export const STAGE_PHOTOS = [
  {
    src: tram,
    alt: "A yellow Lisbon tram climbing a cobbled street below Graça",
    place: "Tram 28, Graça",
    coords: "38.716° N, 9.130° W",
  },
  {
    src: tiles,
    alt: "Blue and green geometric azulejo tiles",
    place: "Museu Nacional do Azulejo",
    coords: "38.725° N, 9.114° W",
  },
  {
    src: lift,
    alt: "The iron tower of the Santa Justa Lift between Baixa buildings",
    place: "Elevador de Santa Justa",
    coords: "38.712° N, 9.139° W",
  },
] as const;

export const PHOTOS = { santaLuzia, portEngraving, baixaMap, rooftops } as const;
