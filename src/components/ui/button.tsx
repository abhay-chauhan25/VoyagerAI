import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "accent" | "secondary" | "quiet";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Near-black: the app's one filled action per screen.
  primary: "bg-primary text-primary-ink hover:bg-primary-hover",
  // Blueprint blue: reserved for the public pages' single call to action.
  accent: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "bg-panel text-ink border border-control hover:bg-raised",
  quiet: "text-ink underline decoration-1 underline-offset-4 hover:decoration-2",
};

const SIZES: Record<Size, string> = {
  md: "min-h-10 px-4 text-ui",
  lg: "min-h-12 px-6 text-body",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra = "") {
  const base =
    variant === "quiet"
      ? "pressable inline-flex items-center gap-2"
      : "pressable inline-flex items-center justify-center gap-2 rounded-control font-semibold disabled:cursor-not-allowed disabled:opacity-60";
  return `${base} ${VARIANTS[variant]} ${variant === "quiet" ? "" : SIZES[size]} ${extra}`.trim();
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
