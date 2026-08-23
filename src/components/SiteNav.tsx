import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteNav({ ctaActive = false }: { ctaActive?: boolean } = {}) {
  return (
    <>
    <FloatingBuyCta active={ctaActive} />
    <header className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 pt-3 pb-6 md:px-10">
      <Link to="/" className="inline-flex w-fit min-w-0 justify-self-start transition-opacity hover:opacity-60">
        <img src={logo.url} alt="Your Message Here" className="h-12 w-auto md:h-16 auto-invert" />
      </Link>
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <ThemeToggle />
        <SiteMenu />
      </div>
    </header>
    </>
  );
}

const menuLinks = [
  { to: "/archive", label: "Archive" },
  { to: "/faq", label: "FAQ" },
  { to: "/about", label: "About" },
  { to: "/alerts", label: "Email alerts" },
] as const;

function SiteMenu() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-background py-2 shadow-lg">
            {menuLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <a
              href="mailto:alex@tryrocket.ai"
              className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Contact
            </a>
          </nav>
        </>
      ) : null}
    </div>
  );
}

export function FloatingBuyCta({ active = false }: { active?: boolean } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/buy")) return null;
  return (
    <Link
      to="/buy"
      className="btn-cta fixed right-4 bottom-4 z-50 shadow-lg md:right-8 md:bottom-8"
    >
      <span className="sm:hidden">{active ? "Buy" : "Buy"}</span>
      <span className="hidden sm:inline">
        {active ? "Buy next week" : "Buy the billboard"}
      </span>{" "}
      <span className="btn-arrow" aria-hidden="true">→</span>
    </Link>
  );
}


export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-6 pb-10 text-center text-xs leading-relaxed text-muted-foreground">
      Built with 🫶🏻 by{" "}
      <a
        href="https://x.com/alexmacgregor__"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground underline-offset-4 hover:underline"
      >
        Alex
      </a>
      .
    </footer>
  );
}
