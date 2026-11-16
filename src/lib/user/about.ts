import { z } from "zod";

export const AUDIENCES = ["hidden", "friends", "followers", "travellers"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  hidden: "Nobody",
  friends: "Friends only",
  followers: "Followers and friends",
  travellers: "Any signed-in traveller",
};

export const MAX_BIO = 280;

const optional = (schema: z.ZodType<string, string>) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(schema.nullable());

/**
 * The optional parts of a profile. Each is either blank (stored as nothing) or valid. A web
 * address must be https, so a profile can't carry a `javascript:` link or an insecure one.
 */
export const aboutSchema = z.object({
  bio: optional(z.string().max(MAX_BIO, `Keep it under ${MAX_BIO} characters.`)),
  website: optional(
    z
      .string()
      .max(200, "That address is too long.")
      .regex(/^https:\/\/[^\s<>"]{3,}$/, "Use a full address starting with https://"),
  ),
  contactEmail: optional(z.email("That doesn't look like an email address.").max(254)),
  phone: optional(
    z
      .string()
      .regex(
        /^\+?[0-9][0-9 ()-]{5,22}$/,
        "Use digits, spaces, brackets or dashes, with an optional + at the start.",
      ),
  ),
  emailAudience: z.enum(AUDIENCES),
  phoneAudience: z.enum(AUDIENCES),
});

export type About = z.infer<typeof aboutSchema>;
