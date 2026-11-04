"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./form-state";
import { ONBOARDING_PATH, safeNextPath } from "./routes";
import {
  magicLinkSchema,
  profileSchema,
  readFields,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from "./schemas";

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", publicEnv().NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

function checkEmailPath(kind: "confirm" | "magic-link", email: string): string {
  const params = new URLSearchParams({ kind, email });
  return `/check-email?${params.toString()}`;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, ["displayName", "email", "password", "tripIdea"] as const);
  const parsed = signUpSchema.safeParse(raw);
  const values = {
    displayName: raw.displayName ?? "",
    email: raw.email ?? "",
    tripIdea: raw.tripIdea ?? "",
  };
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const { displayName, email, password, tripIdea } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // New travellers start with the Travel DNA deck; they can skip it from there.
      emailRedirectTo: callbackUrl(ONBOARDING_PATH),
      data: { display_name: displayName, ...(tripIdea ? { trip_idea: tripIdea } : {}) },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "Choose a stronger password." }, values };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return {
        status: "error",
        message: "Too many attempts. Wait a minute and try again.",
        values,
      };
    }
    console.error("Sign-up failed", { code: error.code, status: error.status });
    return { status: "error", message: "We couldn't create your account. Try again.", values };
  }

  // Supabase answers the same way for new and existing emails, so this page never reveals which.
  redirect(checkEmailPath("confirm", email));
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, ["email", "password", "next"] as const);
  const parsed = signInSchema.safeParse(raw);
  const values = { email: raw.email ?? "" };
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Confirm your email first. The link is in your inbox.",
        values,
      };
    }
    if (error.code === "invalid_credentials") {
      return { status: "error", message: "That email and password don't match.", values };
    }
    if (error.status === 429) {
      return {
        status: "error",
        message: "Too many attempts. Wait a minute and try again.",
        values,
      };
    }
    console.error("Sign-in failed", { code: error.code, status: error.status });
    return { status: "error", message: "We couldn't sign you in. Try again.", values };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(raw.next));
}

export async function sendMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, ["email", "next"] as const);
  const parsed = magicLinkSchema.safeParse(raw);
  const values = { email: raw.email ?? "" };
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // Links sign in existing accounts only; new travellers go through sign-up so they set a name.
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(safeNextPath(raw.next)) },
  });

  if (error && error.status === 429) {
    return {
      status: "error",
      message: "Too many links requested. Wait a minute and try again.",
      values,
    };
  }
  if (error && error.code !== "otp_disabled" && error.code !== "user_not_found") {
    console.error("Magic link failed", { code: error.code, status: error.status });
  }
  // Same response whether or not the account exists, so the form cannot be used to probe emails.
  redirect(checkEmailPath("magic-link", parsed.data.email));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign-out failed", { code: error.code, status: error.status });
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, ["displayName", "homeCity", "handle", "isPublic"] as const);
  const values = {
    displayName: raw.displayName ?? "",
    homeCity: raw.homeCity ?? "",
    handle: raw.handle ?? "",
    isPublic: raw.isPublic === "on" ? "on" : "",
  };
  const parsed = profileSchema.safeParse({
    displayName: raw.displayName,
    homeCity: raw.homeCity ?? "",
    handle: raw.handle ?? "",
    isPublic: raw.isPublic === "on",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/sign-in?next=/account");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      home_city: parsed.data.homeCity,
      handle: parsed.data.handle,
      is_public: parsed.data.isPublic,
    })
    .eq("id", userId);

  if (error?.code === "23505") {
    return {
      status: "error",
      fieldErrors: { handle: "That handle is taken. Try another." },
      values,
    };
  }
  if (error) {
    console.error("Profile update failed", { code: error.code });
    return { status: "error", message: "We couldn't save your profile. Try again.", values };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Saved", values };
}
