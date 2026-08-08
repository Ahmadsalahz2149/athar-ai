"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const TABS = [
  { key: "img", label: "showImg", body: "showImgB", icon: <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 15l4-4 3 3 4-5 5 6" /> },
  { key: "vid", label: "showVid", body: "showVidB", icon: <path d="M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 10l4-2v8l-4-2" /> },
  { key: "voice", label: "showVoice", body: "showVoiceB", icon: <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /> },
];

export function Showcase() {
  const t = useTranslations("Landing");
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div className="lp-show">
      <div className="lp-center">
        <h2 className="lp-h2">{t("showTitle")}</h2>
        <p className="lp-lead" style={{ marginBlockStart: 12 }}>{t("showSub")}</p>
      </div>
      <div className="lp-tabs">
        {TABS.map((tb, i) => (
          <button key={tb.key} className={`lp-tab${i === active ? " on" : ""}`} onClick={() => setActive(i)}>{t(tb.label)}</button>
        ))}
      </div>
      <div className="lp-show-panel">
        <div className="lp-show-visual">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e6f2f0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
            {tab.icon}
          </svg>
        </div>
        <div className="lp-show-copy">
          <h3>{t(tab.label)}</h3>
          <p>{t(tab.body)}</p>
        </div>
      </div>
    </div>
  );
}
