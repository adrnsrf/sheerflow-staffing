import type { Metadata } from "next";
import { Sidebar } from "@/components/client";
import { getOverview } from "@/core";
import "./globals.css";

export const metadata: Metadata = { title: "SheerFlow", description: "One app for business development, candidate sourcing and running the business." };
// Every screen reads the local database, so nothing is prerendered.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const o = await getOverview();
  const counts = { "/bd/signals": o.newSignals, "/bd/calls": o.callsDue, "/bd/connections": o.readyToSend, "/bd/drafts": o.draftsToReview, "/system/claude": o.jobsQueued };
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full">
        <Sidebar counts={counts} />
        <main className="min-w-0 flex-1 px-8 py-7">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </body>
    </html>
  );
}
