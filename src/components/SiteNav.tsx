import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png.asset.json";

export function SiteNav() {
  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
      <Link to="/" className="transition-opacity hover:opacity-60">
        <img src={logo.url} alt="Your Message Here" className="h-9 w-auto md:h-12" />
      </Link>
      <nav className="flex items-center gap-8 text-sm text-muted-foreground">
        <Link to="/archive" className="transition-colors hover:text-foreground">
          Archive
        </Link>
        <Link to="/about" className="transition-colors hover:text-foreground">
          About
        </Link>
        <Link
          to="/buy"
          className="bg-foreground px-5 py-2 text-sm font-medium tracking-tight text-background transition-opacity hover:opacity-80"
        >
          Buy
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
