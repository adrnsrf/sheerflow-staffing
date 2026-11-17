"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV: { heading: string; items: [string, string][] }[] = [
  { heading: "", items: [["/", "Today"]] },
  { heading: "Business development", items: [["/bd/signals", "Signals inbox"], ["/bd/jobs", "Job alerts"], ["/bd/accounts", "Accounts"], ["/bd/people", "People"], ["/bd/calls", "Call list"], ["/bd/connections", "Connection queue"], ["/bd/drafts", "Outreach drafts"], ["/bd/pipeline", "Pipeline"]] },
  { heading: "Candidate sourcing", items: [["/sourcing/searches", "Searches"], ["/sourcing/talent", "Talent pool"]] },
  { heading: "Business management", items: [["/manage/clients", "Clients & agreements"], ["/manage/money", "Money"], ["/manage/kpis", "KPIs & weekly review"], ["/manage/vendor", "Vendor scorecard"], ["/manage/budgets", "Budgets"]] },
  { heading: "System", items: [["/system/claude", "Claude"], ["/system/routines", "Routines"], ["/system/import", "Import"], ["/system/connectors", "Connections"]] },
];

export function Sidebar({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto bg-ink px-3 py-5 text-stone-300">
      <Link href="/" className="mb-5 flex items-center gap-2 px-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">S</span>
        <span className="font-semibold text-white">SheerFlow</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-stone-300">v0</span>
      </Link>
      {NAV.map((group) => (
        <nav key={group.heading} className="mb-4">
          {group.heading && <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">{group.heading}</div>}
          {group.items.map(([href, name]) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${active ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white"}`}>
                {name}
                {counts[href] > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">{counts[href]}</span>}
              </Link>
            );
          })}
        </nav>
      ))}
      <div className="mt-auto px-2 text-[11px] leading-snug text-stone-500">Local build. The app itself never sends, connects or spends.</div>
    </aside>
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
