import { z } from "zod";

export const MIN_VISIT_YEAR = 1900;

export const citySearchSchema = z.object({
  q: z.string().trim().min(2).max(80),
});

/** Add a city (its country comes from the city) or a whole country without a city. */
export const addVisitSchema = z
  .object({
    cityId: z.coerce.number().int().positive().optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/, "Choose a country.")
      .optional(),
    year: z
      .union([
        z.literal(""),
        z.coerce.number().int().min(MIN_VISIT_YEAR).max(new Date().getFullYear()),
      ])
      .optional()
      .transform((value) => (value === "" || value === undefined ? null : value)),
  })
  .refine((v) => v.cityId !== undefined || v.countryCode !== undefined, {
    message: "Choose a city or a country.",
    path: ["cityId"],
  });

export const removeVisitSchema = z.object({ id: z.uuid() });
