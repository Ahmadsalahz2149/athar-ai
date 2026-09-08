/**
 * Information architecture: the 19 flat app screens regrouped into 5 "worlds"
 * organised by the user's job-to-be-done, not by feature. The Sidebar renders
 * these as an accordion (active world expanded) and WorldTabs renders the
 * current world's screens as a tab strip. No screen/route is removed — every
 * feature lives inside a world, so nothing is lost.
 *
 * `icon` is an SVG path `d` (stroke, 24x24) reused by both the sidebar and tabs.
 */
export type NavLeaf = { href: string; key: string; icon: string };
export type NavWorld = { key: string; labelKey: string; icon: string; items: NavLeaf[] };

const I = {
  home: "M3 11l9-8 9 8M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9",
  vault: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  ingest: "M12 15V3M8 7l4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  dna: "M7 4c6 3 4 8 10 11M17 4c-6 3-4 8-10 11M8 6h8M8 18h8",
  brand: "M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4zM9.5 12l1.8 1.8L15 10",
  ideas: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10z",
  studio: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  media: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM10 9l5 3-5 3z",
  scenes: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM5.5 18a6.5 6.5 0 0 1 13 0",
  approvals: "M9 12l2 2 4-4M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7z",
  calendar: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v4M16 3v4",
  plan: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 13h4M8 16h8",
  distribute: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 3.9M15.4 6.6l-6.8 3.9",
  analytics: "M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM8 15l3-4 3 3 3-5",
  mylink: "M9 15l6-6M10 6l1-1a3.5 3.5 0 0 1 5 5l-1 1M14 18l-1 1a3.5 3.5 0 0 1-5-5l1-1",
  readiness: "M9 11l3 3L20 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  activity: "M3 12h4l2 6 4-14 2 8h6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-1.5 2.9z",
  billing: "M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 15h4",
  help: "M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.3-1.6 2.4M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  // world glyphs
  wBrain: "M12 3l9 4-9 4-9-4 9-4zM3 12l9 4 9-4M3 17l9 4 9-4",
  wCreate: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z",
  wPublish: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  wGrow: "M3 17l6-6 4 4 8-8M21 7v6h-6",
};

export const DASHBOARD: NavLeaf = { href: "/dashboard", key: "home", icon: I.home };

export const WORLDS: NavWorld[] = [
  {
    key: "brain",
    labelKey: "world_brain",
    icon: I.wBrain,
    items: [
      { href: "/vault", key: "vault", icon: I.vault },
      { href: "/ingest", key: "ingest", icon: I.ingest },
      { href: "/dna", key: "dna", icon: I.dna },
      { href: "/brand", key: "brand", icon: I.brand },
    ],
  },
  {
    key: "create",
    labelKey: "world_create",
    icon: I.wCreate,
    items: [
      { href: "/ideas", key: "ideas", icon: I.ideas },
      { href: "/studio", key: "studio", icon: I.studio },
      { href: "/media", key: "media", icon: I.media },
      { href: "/scenes", key: "scenes", icon: I.scenes },
    ],
  },
  {
    key: "publish",
    labelKey: "world_publish",
    icon: I.wPublish,
    items: [
      { href: "/approvals", key: "approvals", icon: I.approvals },
      { href: "/calendar", key: "calendar", icon: I.calendar },
      { href: "/plan", key: "plan", icon: I.plan },
      { href: "/distribute", key: "distribute", icon: I.distribute },
    ],
  },
  {
    key: "grow",
    labelKey: "world_grow",
    icon: I.wGrow,
    items: [
      { href: "/analytics", key: "analytics", icon: I.analytics },
      { href: "/mylink", key: "mylink", icon: I.mylink },
      { href: "/readiness", key: "readiness", icon: I.readiness },
      { href: "/activity", key: "activity", icon: I.activity },
    ],
  },
];

/** Account/system screens — live at the sidebar bottom, not in a world. */
export const ACCOUNT: NavLeaf[] = [
  { href: "/settings", key: "settings", icon: I.settings },
  { href: "/billing", key: "billing", icon: I.billing },
  { href: "/help", key: "help", icon: I.help },
];

/** Every leaf across worlds + dashboard + account (used for the collapsed rail). */
export const ALL_LEAVES: NavLeaf[] = [DASHBOARD, ...WORLDS.flatMap((w) => w.items), ...ACCOUNT];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** The world that owns the current route, or null (dashboard/account/unknown). */
export const findWorld = (pathname: string): NavWorld | null =>
  WORLDS.find((w) => w.items.some((i) => isActive(pathname, i.href))) ?? null;
