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
  it("turns an empty home city into null", () => {
    expect(profileSchema.parse({ displayName: "Kai", homeCity: "  " })).toEqual({
      displayName: "Kai",
      homeCity: null,
    });
  });

  it("rejects a too-long home city", () => {
    expect(profileSchema.safeParse({ displayName: "Kai", homeCity: "x".repeat(81) }).success).toBe(
      false,
    );
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
