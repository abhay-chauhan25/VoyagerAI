"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark, Wordmark } from "@/components/brand/mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { SECTION_HUE, hueStyle } from "@/lib/hues";
import { Avatar } from "./avatar";
import { DnaIcon } from "./icons";
import { NAV_ITEMS, isActivePath } from "./nav-items";

type ShellUser = { id: string; displayName: string; email: string };

/**
 * Open-plane shell: a labelled sidebar on the page ground at desktop widths; a slim top bar and a
 * bottom tab bar on phones. The product is always named; navigation recedes behind the content.
 */
export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
  const onAccount = isActivePath(pathname, "/account");
  const onDna = isActivePath(pathname, "/dna");

  return (
    <div className="min-h-svh bg-ground text-ink lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-primary px-3 py-2 text-primary-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh flex-col gap-8 border-r border-rule px-3 py-5 lg:flex">
        <Link
          href="/trips"
          className="mx-2 self-start rounded-control"
          aria-label="Voyager, go to Trips"
        >
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                style={hueStyle(SECTION_HUE[href] ?? "cobalt")}
                className={`flex min-h-9 items-center gap-2.5 rounded-control px-2.5 text-ui transition-colors duration-150 ${
                  active
                    ? "bg-active font-semibold text-ink"
                    : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon className="hue-text" />
                {label}
              </Link>
            );
          })}
        </nav>
        <nav aria-label="You" className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 text-meta text-muted">You</span>
          <Link
            href="/dna"
            aria-current={onDna ? "page" : undefined}
            style={hueStyle(SECTION_HUE["/dna"] ?? "rose")}
            className={`flex min-h-9 items-center gap-2.5 rounded-control px-2.5 text-ui transition-colors duration-150 ${
              onDna
                ? "bg-active font-semibold text-ink"
                : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            <DnaIcon className="hue-text" />
            Travel DNA
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle className="mx-2 self-start" />
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              aria-current={onAccount ? "page" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors duration-150 ${
                onAccount ? "bg-active" : "hover:bg-raised"
              }`}
            >
              <Avatar id={user.id} name={user.displayName} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-ui font-semibold">{user.displayName}</span>
                <span className="truncate text-meta text-muted">{user.email}</span>
              </span>
            </Link>
          </div>
          <form action={signOut} className="mx-2">
            <button
              type="submit"
              className="pressable min-h-8 text-ui text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-rule bg-ground px-4 lg:hidden">
        <Link
          href="/trips"
          className="flex items-center gap-2 rounded-control"
          aria-label="Voyager, go to Trips"
        >
          <Mark size={22} />
          <span className="text-body font-semibold">
            {onAccount ? "Account" : onDna ? "Travel DNA" : (current?.label ?? "Voyager")}
          </span>
        </Link>
        <Link href="/account" aria-label="Account" className="rounded-full">
          <Avatar id={user.id} name={user.displayName} size={30} />
        </Link>
      </header>

      <main id="main" className="min-w-0 pb-24 lg:pb-0">
        {children}
      </main>

      {/* Phone bottom tabs */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-rule bg-ground pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              style={hueStyle(SECTION_HUE[href] ?? "cobalt")}
              className={`pressable flex min-h-14 flex-col items-center justify-center gap-1 text-meta ${
                active ? "font-semibold text-ink" : "text-muted"
              }`}
            >
              <Icon className={active ? "hue-text" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
