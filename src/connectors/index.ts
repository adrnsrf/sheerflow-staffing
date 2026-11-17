/**
 * Connector registry. Each outside tool the platform will plug into is one entry here.
 * In v0 every connector runs in "sample" mode: `test()` returns canned data so the screens
 * and the flow can be tried end to end. To make one live, set its env vars and replace
 * `test()` (and add real methods) with calls to the provider's API.
 */

import { apolloConfigured, apolloLists } from "./apollo";
import { retellConfigured } from "./retell";

export type ConnectorMode = "live" | "sample" | "manual" | "via_claude" | "later";

export interface Connector {
  id: string;
  name: string;
  how: string;
  usedFor: string;
  mode: ConnectorMode;
  /** Env vars that will switch this connector to live once it is built. */
  envVars: string[];
  /** A page with more to do for this connector. */
  href?: string;
  /** A cheap read that proves the connector answers. Sample data in v0. */
  test?: () => Promise<string>;
}

// A function, so each request sees the current env (a key added to .env.local shows up after a restart).
export const getConnectors = (): Connector[] => [
  {
    id: "apollo", name: "Apollo", how: "API", usedFor: "IDs free, reveals on approval, sequences, lists", mode: apolloConfigured() ? "live" : "sample", envVars: ["APOLLO_API_KEY"], href: "/system/connectors/apollo",
    test: async () => {
      if (!apolloConfigured()) return "Sample: no API key set, so nothing was called. Add APOLLO_API_KEY to .env.local to go live.";
      try {
        const lists = await apolloLists();
        return `Live: key accepted. ${lists.length} saved lists found, largest is "${lists[0]?.name}" (${lists[0]?.count.toLocaleString()} records). 0 credits spent.`;
      } catch (e) { return `Live, but the call failed: ${e instanceof Error ? e.message : e}`; }
    },
  },
  {
    id: "gmail", name: "Gmail", how: "Google API", usedFor: "Job alerts in, drafts out, reply tracking", mode: "sample", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    test: async () => "Sample: 4 job-alert emails since yesterday (2 LinkedIn, 2 Indeed). 0 drafts waiting.",
  },
  {
    id: "calendar", name: "Google Calendar", how: "Google API", usedFor: "Meetings booked, call blocks", mode: "sample", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    test: async () => "Sample: 2 client meetings this week, 3 call blocks.",
  },
  {
    id: "sheets", name: "Google Sheets", how: "API, during the move", usedFor: "Two-way sync with the call sheet until the team switches", mode: "sample", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "CALL_SHEET_ID"],
    test: async () => "Sample: call sheet has 14 rows, all matched to the call list by domain. Nothing to import.",
  },
  { id: "linkedin", name: "LinkedIn", how: "Manual only", usedFor: "Profile links, connection queue; no scraping or auto-sending", mode: "manual", envVars: [] },
  { id: "google-search", name: "Google search", how: "Through Claude runs", usedFor: "Finding hiring posts", mode: "via_claude", envVars: [] },
  {
    id: "retell", name: "Retell AI", how: "API", usedFor: "AI screen calls to candidates who agreed to one; transcript comes back into the profile", mode: retellConfigured() ? "live" : "sample", envVars: ["RETELL_API_KEY", "RETELL_AGENT_ID", "RETELL_FROM_NUMBER"],
    test: async () => (retellConfigured() ? "Live: keys are set. No call is placed by this test." : "Sample: no keys set. The AI screen call button records the request and shows what the screener would be told, but places no call."),
  },
  { id: "dialer", name: "Dialer for the sales team (Twilio or Aircall)", how: "API, later", usedFor: "Click-to-call, recordings, outcomes", mode: "later", envVars: ["DIALER_API_KEY"] },
  {
    id: "esign", name: "PandaDoc or Docusign", how: "Connector", usedFor: "Agreements", mode: "sample", envVars: ["PANDADOC_API_KEY"],
    test: async () => "Sample: 2 signed agreements, 1 sent and waiting, 1 draft.",
  },
  {
    id: "quickbooks", name: "QuickBooks", how: "Connector", usedFor: "Invoices and payments", mode: "sample", envVars: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET"],
    test: async () => "Sample: 1 invoice open, 1 overdue, 1 paid.",
  },
  { id: "slack", name: "Slack", how: "Connector, optional", usedFor: "Team alerts", mode: "later", envVars: ["SLACK_BOT_TOKEN"] },
];

export const getConnector = (id: string) => getConnectors().find((c) => c.id === id);
