import { hueFor, initialsFor } from "@/lib/user/initials";

export function Avatar({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  const hue = hueFor(id);
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full text-meta font-semibold"
      style={{
        width: size,
        height: size,
        background: `oklch(0.88 0.05 ${hue})`,
        color: `oklch(0.32 0.06 ${hue})`,
      }}
    >
      {initialsFor(name)}
    </span>
  );
}
