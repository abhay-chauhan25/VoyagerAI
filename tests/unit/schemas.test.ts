import {
  magicLinkSchema,
  profileSchema,
  readFields,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from "@/lib/auth/schemas";

describe("signUpSchema", () => {
  const valid = {
    displayName: " Ana ",
    email: " Ana@Example.COM ",
    password: "lisbon2026",
    tripIdea: "",
  };

  it("accepts and normalises a valid sign-up", () => {
    expect(signUpSchema.parse(valid)).toEqual({
      displayName: "Ana",
      email: "ana@example.com",
      password: "lisbon2026",
      tripIdea: undefined,
    });
  });

  it("keeps a trimmed trip idea", () => {
    expect(signUpSchema.parse({ ...valid, tripIdea: "  Lisbon in May " }).tripIdea).toBe(
      "Lisbon in May",
    );
  });

  it("explains each weak password rule", () => {
    const cases: [string, string][] = [
      ["short1", "Use at least 8 characters."],
      ["onlyletters", "Include at least one number."],
      ["12345678", "Include at least one letter."],
      ["a1".repeat(40), "Use at most 72 characters."],
    ];
    for (const [password, message] of cases) {
      const result = signUpSchema.safeParse({ ...valid, password });
      expect(result.success).toBe(false);
      if (!result.success) expect(toFieldErrors(result.error).password).toBe(message);
    }
  });

  it("rejects blank names, bad emails and missing fields", () => {
    const result = signUpSchema.safeParse({
      displayName: "   ",
      email: "not-an-email",
      password: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.displayName).toBe("Tell us what to call you.");
      expect(errors.email).toBe("Enter a valid email address.");
      expect(errors.password).toBe("Enter a password.");
    }
  });

  it("rejects an over-long trip idea", () => {
    expect(signUpSchema.safeParse({ ...valid, tripIdea: "x".repeat(61) }).success).toBe(false);
  });
});

describe("signInSchema and magicLinkSchema", () => {
  it("accepts any non-empty password at sign-in", () => {
    expect(signInSchema.safeParse({ email: "a@example.com", password: "x" }).success).toBe(true);
  });

  it("rejects empty credentials", () => {
    expect(signInSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(magicLinkSchema.safeParse({ email: "@@" }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  const base = { displayName: "Kai", homeCity: "", handle: "", isPublic: false };

  it("turns empty optional fields into null", () => {
    expect(profileSchema.parse({ ...base, homeCity: "  " })).toEqual({
      displayName: "Kai",
      homeCity: null,
      handle: null,
      isPublic: false,
    });
  });

  it("lower-cases a valid handle", () => {
    expect(profileSchema.parse({ ...base, handle: "Kai_Travels" }).handle).toBe("kai_travels");
  });

  it("rejects malformed handles and too-long cities", () => {
    for (const handle of ["ab", "has space", "dash-es", "x".repeat(31), "émile"]) {
      expect(profileSchema.safeParse({ ...base, handle }).success).toBe(false);
    }
    expect(profileSchema.safeParse({ ...base, homeCity: "x".repeat(81) }).success).toBe(false);
  });

  it("needs a handle before a profile can be public", () => {
    const result = profileSchema.safeParse({ ...base, isPublic: true });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error).handle).toMatch(/Choose a handle/);
    expect(profileSchema.safeParse({ ...base, isPublic: true, handle: "kai" }).success).toBe(true);
  });
});

describe("readFields", () => {
  it("reads strings and treats files or absent keys as missing", () => {
    const form = new FormData();
    form.set("email", "a@example.com");
    form.set("avatar", new Blob(["x"]), "x.png");
    expect(readFields(form, ["email", "avatar", "missing"] as const)).toEqual({
      email: "a@example.com",
      avatar: undefined,
      missing: undefined,
    });
  });
});
