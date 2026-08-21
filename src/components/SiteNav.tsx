import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png.asset.json";

export function SiteNav() {
  return (
    <header className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 pt-3 pb-6 md:px-10">
      <Link to="/" className="min-w-0 transition-opacity hover:opacity-60">
        <img src={logo.url} alt="Your Message Here" className="h-12 w-auto md:h-16 auto-invert" />
      </Link>
      <Link
        to="/buy"
        className="btn-cta shrink-0"
      >
        Buy this billboard <span className="btn-arrow" aria-hidden="true">→</span>
      </Link>
    </header>
  );
}

export function SiteLinks() {
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
      <Link to="/archive" className="transition-colors hover:text-foreground">
        Archive
      </Link>
      <Link to="/faq" className="transition-colors hover:text-foreground">
        FAQ
      </Link>
      <Link to="/about" className="transition-colors hover:text-foreground">
        About
      </Link>
      <a href="mailto:alex@tryrocket.ai" className="transition-colors hover:text-foreground">
        Contact
      </a>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-6 pb-10 text-center text-xs leading-relaxed text-muted-foreground">
      Copyright © 2026 Works App, Inc. Built with 🫶🏻 by{" "}
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
