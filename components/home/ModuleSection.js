"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const numberItem = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

// Deep module sections cascade in piece by piece (number, then label, then
// headline, then the who/what body, then the CTA) rather than arriving as
// one flat block — a different rhythm than the quick-strip cards above.
export default function ModuleSection({ m }) {
  return (
    <motion.div
      className="mx-auto max-w-6xl px-6 py-14"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -10% 0px" }}
      variants={container}
    >
      <Link href={m.href} className="group block">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[auto_1fr]">
          <motion.div
            variants={numberItem}
            className="flex items-center gap-4 lg:flex-col lg:items-start"
          >
            <span className="font-serif text-6xl italic text-navy-500 lg:text-7xl">
              {m.n}
            </span>
            <span className={`h-2 w-2 rounded-full ${m.dot}`} />
          </motion.div>

          <div
            className={`rounded-lg border border-transparent p-2 transition-colors duration-300 ${m.ring}`}
          >
            <motion.p
              variants={item}
              className={`text-xs font-semibold uppercase tracking-[0.28em] ${m.text}`}
            >
              {m.name}
            </motion.p>
            <motion.h3
              variants={item}
              className="mt-4 max-w-3xl font-serif text-2xl leading-snug text-white sm:text-3xl"
            >
              {m.headline}
            </motion.h3>

            <motion.div
              variants={item}
              className="mt-6 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-[0.8fr_1.2fr]"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Who it&rsquo;s for
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {m.who}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  What it does
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {m.what}
                </p>
              </div>
            </motion.div>

            <motion.span
              variants={item}
              className={`mt-7 inline-flex items-center gap-2 text-sm font-medium ${m.text}`}
            >
              {m.cta}
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                &rarr;
              </span>
            </motion.span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
