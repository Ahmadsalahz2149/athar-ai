"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const ITEMS = ["1", "2", "3", "4", "5"];

export function Faq() {
  const t = useTranslations("Landing");
  const [open, setOpen] = useState<string | null>("1");

  return (
    <div className="lp-faq">
      {ITEMS.map((n) => {
        const isOpen = open === n;
        return (
          <div key={n} className={`lp-faq-item${isOpen ? " open" : ""}`}>
            <button className="lp-faq-q" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : n)}>
              <span>{t(`q${n}`)}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div className="lp-faq-a"><p>{t(`a${n}`)}</p></div>
          </div>
        );
      })}
    </div>
  );
}
