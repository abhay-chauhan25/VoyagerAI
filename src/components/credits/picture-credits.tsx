import { z } from "zod";
import landingCredits from "../../../public/images/landing/credits.json";
import sceneCredits from "../../../public/images/scenes/credits.json";

const creditSchema = z.array(
  z.object({
    title: z.string(),
    creator: z.string().nullable(),
    license: z.string(),
    licenseUrl: z.url().nullable().optional(),
    page: z.url(),
    via: z.string().nullable().optional(),
  }),
);

type Credit = z.infer<typeof creditSchema>[number];

// Validated at build time: a malformed credits file breaks the build instead of shipping uncredited photos.
const CREDITS: Record<"landing" | "scenes", Credit[]> = {
  landing: creditSchema.parse(landingCredits),
  scenes: creditSchema.parse(sceneCredits),
};

/** Credits for every photograph and map in a set, as their licences require. */
export function PictureCredits({ set = "landing" }: { set?: keyof typeof CREDITS }) {
  const credits = CREDITS[set];
  return (
    <p className="max-w-[75ch] text-meta text-muted">
      Pictures:{" "}
      {credits.map((credit, index) => (
        <span key={credit.page}>
          <a
            href={credit.page}
            className="underline underline-offset-2 hover:text-ink"
            rel="noreferrer"
            target="_blank"
          >
            {credit.title}
          </a>
          {credit.creator ? ` by ${credit.creator}` : ""},{" "}
          {credit.licenseUrl ? (
            <a
              href={credit.licenseUrl}
              className="underline underline-offset-2 hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              {credit.license}
            </a>
          ) : (
            credit.license
          )}
          {credit.via ? `, via ${credit.via}` : ""}
          {index < credits.length - 1 ? "; " : "."}
        </span>
      ))}
    </p>
  );
}
