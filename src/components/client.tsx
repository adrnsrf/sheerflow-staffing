"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// The menu: eleven places. Related screens sit together as tabs inside one place.
type Tab = [href: string, label: string];
const SECTIONS: { href: string; label: string; tabs?: Tab[]; counter?: string }[] = [
  { href: "/", label: "Today" },
  { href: "/bd/actions", label: "To do", tabs: [["/bd/actions", "Business development"], ["/sourcing/actions", "Candidates"]] },
  { href: "/bd/signals", label: "New leads", counter: "/bd/signals", tabs: [["/bd/signals", "Signals"], ["/bd/jobs", "Job alerts"], ["/bd/staffing", "Staffing firms"]] },
  { href: "/bd/calls", label: "Calls", counter: "/bd/calls" },
  { href: "/bd/connections", label: "LinkedIn", counter: "/bd/connections", tabs: [["/bd/connections", "Connection queue"], ["/bd/drafts", "Drafts to review"]] },
  { href: "/bd/accounts", label: "Companies", tabs: [["/bd/accounts", "Companies"], ["/bd/people", "People"]] },
  { href: "/sourcing/candidates", label: "Candidates" },
  { href: "/sourcing/searches", label: "Roles", tabs: [["/sourcing/searches", "Open roles"], ["/sourcing/match", "Try a job description"]] },
  { href: "/manage/kpis", label: "Business", tabs: [["/manage/kpis", "Numbers"], ["/bd/pipeline", "Deals"], ["/manage/clients", "Clients"], ["/manage/money", "Money"], ["/manage/vendor", "Vendor"], ["/manage/budgets", "Budgets"]] },
  { href: "/system/claude", label: "Claude", counter: "/system/claude" },
  { href: "/system/context", label: "Settings", tabs: [["/system/context", "Claude's instructions"], ["/system/scoring", "Signal scoring"], ["/system/import", "Import"], ["/system/connectors", "Connections"]] },
];
const owns = (sec: (typeof SECTIONS)[number], path: string) => (sec.href === "/" ? path === "/" : (sec.tabs ?? [[sec.href, ""]]).some(([h]) => path === h || path.startsWith(h + "/")));

export function Sidebar({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col overflow-y-auto bg-ink px-3 py-5 text-stone-300">
      <Link href="/" className="mb-5 flex items-center gap-2 px-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">S</span>
        <span className="font-semibold text-white">SheerFlow</span>
      </Link>
      <nav className="space-y-0.5">
        {SECTIONS.map((sec, i) => {
          const active = owns(sec, path), n = sec.counter ? counts[sec.counter] : 0;
          return (
            <Link key={sec.href} href={sec.href} className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${i === 9 ? "mt-4" : ""} ${active ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white"}`}>
              {sec.label}
              {n > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">{n}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 pt-6 text-[11px] leading-snug text-stone-500">Nothing is sent, connected or spent until you press the button.</div>
    </aside>
  );
}

/** The tabs for whichever place the current screen belongs to. */
export function SectionTabs() {
  const path = usePathname();
  const sec = SECTIONS.find((x) => owns(x, path));
  if (!sec?.tabs) return null;
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-stone-200">
      {sec.tabs.map(([href, name]) => {
        const on = path === href || path.startsWith(href + "/");
        return <Link key={href} href={href} className={`-mb-px border-b-2 px-3 py-2 text-sm ${on ? "border-brand font-medium text-ink" : "border-transparent text-stone-500 hover:text-ink"}`}>{name}</Link>;
      })}
    </div>
  );
}

/** Copies text, and optionally opens a link (used for "copy note and open profile"). */
export function CopyButton({ text, openUrl, children, className = "btn" }: { text: string; openUrl?: string; children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: still open the link */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        if (openUrl) window.open(openUrl, "_blank", "noopener");
      }}
    >
      {copied ? "Copied" : children}
    </button>
  );
}
