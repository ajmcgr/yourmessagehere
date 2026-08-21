import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png.asset.json";

export function SiteNav() {
  return (
    <header className="flex w-full flex-wrap items-center justify-between gap-4 px-6 pt-3 pb-6 md:px-10">
      <Link to="/" className="transition-opacity hover:opacity-60">
        <img src={logo.url} alt="Your Message Here" className="h-12 w-auto md:h-16" />
      </Link>
      <nav className="flex items-center gap-8 text-sm text-muted-foreground">
        <Link to="/archive" className="transition-colors hover:text-foreground">
          Archive
        </Link>
        <Link to="/faq" className="transition-colors hover:text-foreground">
          FAQ
        </Link>
        <Link to="/about" className="transition-colors hover:text-foreground">
          About
        </Link>

        <Link
          to="/buy"
          className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium tracking-tight text-background transition-opacity hover:opacity-80"
        >
          Buy this billboard →

        </Link>
      </nav>
    </header>
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
