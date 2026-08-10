"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "/patient", label: "Patient", accent: "hover:text-teal" },
  { href: "/clinical", label: "Clinical", accent: "hover:text-clinicalblue" },
  { href: "/diligence", label: "Diligence", accent: "hover:text-gold" },
];

const SCROLL_THRESHOLD = 60;

// Transparent-over-hero on load, solidifies once scrolled past the hero
// moment — the same cheap boolean-toggle scroll pattern used elsewhere in
// this app (no per-frame layout reads).
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled((prev) => {
        const next = window.scrollY > SCROLL_THRESHOLD;
        return prev === next ? prev : next;
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-30 border-b transition-colors duration-300 ${
          scrolled
            ? "border-navy-600/60 bg-navy-900/85 backdrop-blur"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <WordmarkBurst />

          <div className="flex items-center gap-6">
            <nav className="hidden gap-6 sm:flex">
              {NAV_LINKS.map((l) => (
                <NavLink key={l.href} href={l.href} accentClass={l.accent}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <a
              href="https://www.orphanaccessinitiative.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-[11px] font-medium uppercase tracking-widest text-slate-500 transition-colors hover:text-teal sm:inline"
            >
              &larr; Back to OAI
            </a>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-11 w-11 items-center justify-center text-slate-300 sm:hidden"
            >
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

function NavLink({ href, children, accentClass }) {
  return (
    <Link
      href={href}
      className={`group relative text-xs font-medium uppercase tracking-widest text-slate-400 transition-colors ${accentClass}`}
    >
      {children}
      <span className="pointer-events-none absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 shadow-[0_0_6px_currentColor] transition-all duration-300 group-hover:scale-x-100 group-hover:opacity-100" />
    </Link>
  );
}

// Echoes the intro sequence's particle theme on a much smaller scale: a
// soft glow pulse plus a handful of dots bursting outward, on wordmark
// hover only — a detail that rewards noticing, not a persistent animation.
function WordmarkBurst() {
  const [burst, setBurst] = useState(false);
  const particles = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        angle: (i / 6) * Math.PI * 2 + Math.random() * 0.3,
        dist: 16 + Math.random() * 10,
      })),
    []
  );

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setBurst(true)}
      onMouseLeave={() => setBurst(false)}
    >
      <span className="relative z-10 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300">
        Orphan Access Initiative
      </span>
      <AnimatePresence>
        {burst && (
          <motion.span
            className="pointer-events-none absolute -inset-3 rounded-full bg-teal/20 blur-md"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      {burst &&
        particles.map((p, i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-teal"
            initial={{ opacity: 0.9, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              x: Math.cos(p.angle) * p.dist,
              y: Math.sin(p.angle) * p.dist,
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            aria-hidden="true"
          />
        ))}
    </span>
  );
}

function MobileMenu({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex flex-col bg-navy-950 sm:hidden"
        >
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300">
              Orphan Access Initiative
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center text-slate-300"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="flex flex-1 flex-col items-start justify-center gap-6 px-8">
            {NAV_LINKS.map((l, i) => (
              <motion.div
                key={l.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={l.href}
                  onClick={onClose}
                  className="font-serif text-4xl text-white"
                >
                  {l.label}
                </Link>
              </motion.div>
            ))}
            <motion.a
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.1 + NAV_LINKS.length * 0.08,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              href="https://www.orphanaccessinitiative.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-xs font-medium uppercase tracking-widest text-slate-500"
            >
              &larr; Back to OAI
            </motion.a>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
