"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Count-up number (perceived-quality trick #3). Animates from 0 to the target
 * once, when it scrolls into view — makes metrics feel *computed live* rather
 * than static. Honors prefers-reduced-motion (jumps straight to the value).
 */
export function CountUp({
  value,
  duration = 900,
  suffix = "",
  locale,
  className,
  style,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  /** Locale for number formatting. A string (serializable) rather than a
   * formatter function, so this client component can be used from a Server
   * Component without crossing the RSC boundary with a function prop. */
  locale?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  const format = useMemo(() => {
    const nf = new Intl.NumberFormat(locale === "ar" ? "ar" : "en");
    return (n: number) => nf.format(n);
  }, [locale]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (reduce || value === 0 || !el) {
      // No animation — set the final value on the next frame (never sync in-effect).
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }

    const run = () => {
      if (done.current) return;
      done.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setDisplay(Math.round(value * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { run(); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return <span ref={ref} className={className} style={style}>{format(display)}{suffix}</span>;
}
