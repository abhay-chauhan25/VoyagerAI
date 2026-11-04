import { z } from "zod";
import rawCredits from "../../../public/images/landing/credits.json";

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

// Validated at build time: a malformed credits file breaks the build instead of shipping uncredited photos.
const credits = creditSchema.parse(rawCredits);

/** Credits for every photograph and map on the landing page, as their licences require. */
export function PictureCredits() {
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
