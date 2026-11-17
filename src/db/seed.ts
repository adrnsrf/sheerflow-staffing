import type { Db } from "./client";
import * as s from "./schema";

/**
 * Sample data only. Every company, person, phone number and post here is made up,
 * shaped like the DFC call sheet and the LinkedIn hiring posts sheet.
 */

const DAY = 86_400_000;
const ago = (days: number, hour = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, (days * 17) % 60, 0, 0);
  return d;
};
const ahead = (days: number) => ago(-days, 9);
const an = (role: string) => `${/^[AEIOU]/.test(role) ? "an" : "a"} ${role}`;
const phone = (block: number, i: number) => `(555) 01${block}-${String(1000 + ((i * 137 + block * 911) % 9000))}`;
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
// A LinkedIn-style post id: the top bits encode the post time, as in the real sheet.
const postId = (d: Date, n: number) => ((BigInt(d.getTime()) << BigInt(22)) + BigInt(n * 7919)).toString();

const COMPANIES: [string, string, string, number, number, number, "A" | "B" | "C", number][] = [
  // name, industry, location, employees, data team, recruiting team, tier, score
  ["Northwind Freight", "Logistics", "Columbus, OH", 420, 9, 2, "A", 91],
  ["Brightpath Health", "Healthcare tech", "Nashville, TN", 310, 12, 1, "A", 89],
  ["Cedar & Stone Insurance", "Insurance", "Des Moines, IA", 480, 7, 2, "A", 86],
  ["Lumen Grocers", "Retail", "Minneapolis, MN", 260, 5, 1, "A", 84],
  ["Tidewater Credit Union", "Financial services", "Norfolk, VA", 350, 6, 1, "A", 83],
  ["Parkline Energy", "Energy", "Tulsa, OK", 190, 4, 0, "A", 81],
  ["Harbor Robotics", "Manufacturing", "Pittsburgh, PA", 150, 6, 1, "B", 77],
  ["Maple Ridge Foods", "Food production", "Madison, WI", 440, 3, 2, "B", 75],
  ["Quillon Software", "B2B SaaS", "Austin, TX", 120, 8, 1, "B", 74],
  ["Sagebrush Outfitters", "E-commerce", "Boise, ID", 95, 3, 0, "B", 72],
  ["Ironbark Logistics", "Logistics", "Memphis, TN", 500, 5, 3, "B", 71],
  ["Clearwell Pharma Services", "Life sciences", "Raleigh, NC", 280, 10, 2, "B", 70],
  ["Juniper Lending", "Fintech", "Salt Lake City, UT", 210, 7, 1, "B", 69],
  ["Copperfield Hotels", "Hospitality", "Phoenix, AZ", 390, 2, 2, "B", 66],
  ["Alder Mutual", "Insurance", "Hartford, CT", 460, 11, 3, "B", 65],
  ["Fernhill Media", "Media", "Denver, CO", 85, 2, 0, "C", 58],
  ["Stonegate Supply", "Distribution", "Kansas City, MO", 330, 2, 1, "C", 55],
  ["Riverbend Schools Network", "Education", "Sacramento, CA", 240, 1, 1, "C", 49],
];

const DM: [string, string][] = [
  ["Priya Raman", "VP of Data"], ["Marcus Bell", "Director of Data Engineering"], ["Elena Sokolova", "Head of Analytics"],
  ["David Okafor", "Chief Data Officer"], ["Hannah Whitfield", "Director of Business Intelligence"], ["Luis Navarro", "VP of Engineering"],
  ["Grace Lindqvist", "Head of Data"], ["Omar Haddad", "Senior Manager, Data Platform"], ["Tessa Monroe", "Director of Analytics"],
  ["Wei Zhang", "VP of Data & Analytics"], ["Samuel Greer", "Director of Data Engineering"], ["Ifeoma Nwosu", "Head of Data Science"],
  ["Caleb Turner", "CTO"], ["Rosa Delgado", "Director of BI"], ["Arjun Mehta", "VP of Data"],
  ["Nora Fitzgerald", "Head of Analytics Engineering"], ["Peter Lang", "IT Director"], ["Jasmine Cole", "Director of Data"],
];
const ALTS: [string, string][] = [
  ["Ben Castillo", "Talent Acquisition Manager"], ["Mina Park", "Analytics Engineering Manager"], ["Theo Abrams", "Data Engineering Manager"],
  ["Lauren Voss", "Head of People"], ["Kofi Asante", "Senior Recruiter"], ["Ivy Marchetti", "Manager, BI"],
];

const CANDIDATES: [string, string, string, string, string][] = [
  // name, title, employer, location, skills
  ["Anika Shah", "Senior Data Engineer", "a regional bank", "Chicago, IL", "Python, Spark, Airflow, Snowflake, dbt"],
  ["Jordan Reyes", "Analytics Engineer", "a retail chain", "Dallas, TX", "dbt, SQL, Looker, BigQuery"],
  ["Mei Tanaka", "Data Engineer", "a logistics startup", "Columbus, OH", "Python, Kafka, Databricks, AWS"],
  ["Tomás Herrera", "BI Developer", "a health system", "Nashville, TN", "Power BI, SQL Server, DAX, SSIS"],
  ["Rachel Kim", "Staff Data Engineer", "a fintech", "Remote (US)", "Scala, Spark, Kafka, GCP, Terraform"],
  ["Devon Clarke", "Data Analyst", "an insurer", "Hartford, CT", "SQL, Tableau, Python, Excel"],
  ["Sofia Petrov", "Senior Analytics Engineer", "a SaaS company", "Austin, TX", "dbt, Snowflake, Fivetran, Sigma"],
  ["Malik Johnson", "Data Platform Engineer", "a manufacturer", "Pittsburgh, PA", "Azure, Databricks, Python, Delta Lake"],
  ["Hye-jin Lee", "Lead Data Engineer", "a grocery chain", "Minneapolis, MN", "Airflow, Snowflake, Python, dbt"],
  ["Chris Novak", "BI Engineer", "a credit union", "Norfolk, VA", "Power BI, SQL, Azure Synapse"],
  ["Fatima Aziz", "Data Engineer", "an energy company", "Houston, TX", "Python, AWS Glue, Redshift, Airflow"],
  ["Owen Gallagher", "Senior Data Analyst", "a hotel group", "Phoenix, AZ", "SQL, Tableau, dbt, Python"],
  ["Lucia Romano", "Analytics Manager", "a pharma services firm", "Raleigh, NC", "SQL, Looker, people management"],
  ["Ethan Brooks", "Data Engineer", "a media company", "Denver, CO", "Python, BigQuery, Dataflow, dbt"],
  ["Zara Ahmed", "Senior BI Developer", "a distributor", "Kansas City, MO", "Tableau, SQL, Snowflake, Alteryx"],
  ["Noah Stein", "Data Engineering Manager", "a lender", "Salt Lake City, UT", "Snowflake, Airflow, Python, hiring"],
];

export async function seed(db: Db) {
  const [adrian, maya, dfc] = await db.insert(s.users).values([
    { name: "Adrian", role: "owner" },
    { name: "Maya (rep)", role: "rep" },
    { name: "D Foster Consulting", role: "vendor" },
  ]).returning();
  const callers = [dfc, maya, dfc, adrian];

  const companies = await db.insert(s.companies).values(COMPANIES.map(([name, industry, location, employees, dataTeam, recruiting, tier, score], i) => {
    const domain = `${slug(name)}.example`;
    return {
      name, industry, location, employees, domain, website: `https://www.${domain}`,
      dataTeamSize: dataTeam, recruitingTeamSize: recruiting, icpTier: tier, icpScore: score,
      hqPhone: phone(0, i),
      altPhones: i % 3 === 0 ? `${location.split(",")[0]} office: ${phone(1, i)}` : null,
      apolloId: `sample-org-${1000 + i}`,
      status: (i === 1 || i === 4 ? "client" : i === 16 ? "do_not_contact" : "prospect") as s.CompanyStatus,
      brief: `${name} is a ${employees}-person ${industry.toLowerCase()} company in ${location} with a data team of about ${dataTeam}. ` +
        `Recruiting team of ${recruiting}, so data hires likely stretch them. Sample brief: the real one comes from the company-research skill.`,
    };
  })).returning();

  const dms = await db.insert(s.people).values(companies.map((c, i) => {
    const [name, title] = DM[i];
    return {
      type: "decision_maker" as const, name, title, companyId: c.id, location: c.location,
      linkedinUrl: `https://www.linkedin.com/in/sample-${slug(name)}`, apolloId: `sample-person-${2000 + i}`,
      email: i < 10 ? `${slug(name).replace("-", ".")}@${c.domain}` : null,
      phone: i < 5 ? phone(2, i) : null,
      contactRevealed: i < 10,
      connectionStatus: (["connected", "sent", "note_ready", "queued", "none", "none"] as const)[i % 6],
      connectionNote: i % 6 < 3 ? `Hi ${name.split(" ")[0]}, saw your team is growing its data group at ${c.name}. I place data engineers and analytics folks and would be glad to connect.` : null,
    };
  })).returning();
  await db.insert(s.people).values(ALTS.map(([name, title], i) => ({
    type: "decision_maker" as const, name, title, companyId: companies[i].id, location: companies[i].location,
    linkedinUrl: `https://www.linkedin.com/in/sample-${slug(name)}`, apolloId: `sample-person-${2100 + i}`,
  })));

  // Signals: hiring posts from the daily routine, plus job postings, leadership changes and alerts.
  const cats = ["Hiring - own team", "Hiring - company", "New data leader", "Team growth signal"];
  const roles = ["Senior Data Engineer", "Analytics Engineer", "BI Developer", "Data Engineer (2)", "Data Analyst", "Data Platform Engineer"];
  const signalRows: (typeof s.signals.$inferInsert)[] = [];
  companies.slice(0, 16).forEach((c, i) => {
    const d = ago(i * 0.9 + 0.2, 8 + (i % 9));
    const dm = dms[i];
    const cat = cats[i % 4];
    const id = postId(d, i + 1);
    signalRows.push({
      type: cat === "New data leader" ? "new_leader" : "hiring_post", category: cat,
      title: cat === "New data leader" ? `${dm.name} just joined ${c.name} as ${dm.title}` : `${dm.name}: "We're hiring ${an(roles[i % 6])}"`,
      summary: cat === "New data leader"
        ? "New leader posts usually mean a rebuild of the team within 90 days."
        : `Posted about growing the data team at ${c.name}. Role is ${i % 3 === 0 ? "hybrid" : "remote-friendly"}, US only.`,
      roles: cat === "New data leader" ? null : roles[i % 6], companyId: c.id, personId: dm.id,
      source: "LinkedIn hiring posts (daily routine)", sourceUrl: `https://www.linkedin.com/posts/sample-activity-${id}`,
      externalId: id, careerVerified: (["Yes", "Partial", "No"] as const)[i % 3], signalDate: d,
      status: (i < 7 ? "new" : i < 10 ? "kept" : i < 13 ? "promoted" : "dismissed") as s.SignalStatus,
    });
  });
  [0, 2, 3, 5, 8, 11].forEach((ci, i) => {
    const c = companies[ci];
    signalRows.push({
      type: i % 2 ? "job_alert" : "job_posting", category: "Job posting", title: `${c.name} posted ${roles[(i + 2) % 6]}`,
      summary: `Open ${12 + i * 9} days. ${i % 2 ? "Came in through a LinkedIn job alert email." : "Found on the company careers page."}`,
      roles: roles[(i + 2) % 6], companyId: c.id, source: i % 2 ? "Gmail job alerts" : "Apollo job postings",
      sourceUrl: `${c.website}/careers`, externalId: `job-${c.id}-${i}`, signalDate: ago(i * 1.4 + 0.5), status: i < 4 ? "new" : "kept",
    });
  });
  signalRows.push({
    type: "funding", category: "Funding", title: "Quillon Software raised a $28M Series B",
    summary: "Announcement mentions doubling the data platform team.", companyId: companies[8].id,
    source: "News", sourceUrl: "https://news.example/quillon-series-b", externalId: "funding-quillon-b", signalDate: ago(2), status: "new",
  });
  await db.insert(s.signals).values(signalRows);

  // Call list (the DFC sheet), with its working columns.
  const queueStatuses: s.CallQueueStatus[] = ["new", "attempting", "attempting", "connected", "meeting_booked", "attempting", "new", "dead"];
  const queue = await db.insert(s.callQueue).values(companies.slice(0, 14).map((c, i) => {
    const status = queueStatuses[i % 8];
    return {
      companyId: c.id, personId: dms[i].id, ownerId: i % 3 === 1 ? maya.id : dfc.id, status,
      topSignal: signalRows.find((r) => r.companyId === c.id)?.title ?? null,
      lastContactAt: status === "new" ? null : ago(1 + (i % 5)),
      nextStep: status === "new" ? "First call" : status === "meeting_booked" ? "Send intro deck before meeting" : status === "dead" ? null : "Call back",
      nextStepDate: status === "dead" ? null : ahead((i % 4) - 1),
      notes: status === "attempting" ? "HQ line goes to a phone tree. Try the local office number." : null,
      addedBy: "DFC weekly refresh",
    };
  })).returning();

  // Three weeks of call activity so the KPI and vendor pages have something to show.
  const outcomes: s.CallOutcome[] = ["voicemail", "gatekeeper", "no_answer", "voicemail", "connected", "no_answer", "gatekeeper", "voicemail", "dead_number", "connected", "meeting_booked"];
  const acts: (typeof s.activities.$inferInsert)[] = [];
  for (let n = 0; n < 150; n++) {
    const q = queue[n % queue.length];
    acts.push({
      type: "call", outcome: outcomes[(n * 7 + (n % 5)) % outcomes.length], companyId: q.companyId, personId: q.personId,
      userId: callers[n % callers.length].id, occurredAt: ago((n * 0.14) % 21, 9 + (n % 8)),
      notes: n % 9 === 4 ? "Good talk. Open to a call about the data engineer role next week." : null,
    });
  }
  for (let n = 0; n < 12; n++) {
    acts.push({ type: n % 3 === 0 ? "linkedin" : "email", outcome: n % 4 === 0 ? "replied" : "sent", companyId: companies[n].id, personId: dms[n].id, userId: adrian.id, occurredAt: ago(n * 1.6 + 0.3) });
  }
  [0, 3, 4, 8, 12].forEach((ci, i) => acts.push({ type: "meeting", outcome: "held", companyId: companies[ci].id, personId: dms[ci].id, userId: adrian.id, occurredAt: ago(i * 4 + 1, 14), notes: "Intro meeting on open data roles." }));
  await db.insert(s.activities).values(acts);

  await db.insert(s.tasks).values([
    { title: "Send terms to Northwind Freight", ownerId: adrian.id, companyId: companies[0].id, dueDate: ahead(1) },
    { title: "Swap HQ number for local office line at Ironbark", ownerId: dfc.id, companyId: companies[10].id, dueDate: ahead(0) },
    { title: "Follow up with Priya Raman after intro call", ownerId: adrian.id, companyId: companies[0].id, dueDate: ahead(2) },
    { title: "Screen Anika Shah for the Brightpath role", ownerId: adrian.id, companyId: companies[1].id, dueDate: ahead(1) },
    { title: "Review this week's DFC scorecard", ownerId: adrian.id, dueDate: ahead(3) },
    { title: "Call back Harbor Robotics (asked for Thursday)", ownerId: maya.id, companyId: companies[6].id, dueDate: ahead(2) },
  ]);

  await db.insert(s.deals).values([
    { companyId: companies[0].id, roleTitle: "Senior Data Engineer", stage: "terms", estSalary: 165000, feePct: 20, ownerId: adrian.id, expectedClose: ahead(21) },
    { companyId: companies[3].id, roleTitle: "Analytics Engineer", stage: "first_meeting", estSalary: 140000, feePct: 20, ownerId: adrian.id, expectedClose: ahead(45) },
    { companyId: companies[8].id, roleTitle: "Data Platform Engineer", stage: "first_meeting", estSalary: 175000, feePct: 22, ownerId: maya.id, expectedClose: ahead(50) },
    { companyId: companies[12].id, roleTitle: "BI Developer", stage: "first_meeting", estSalary: 120000, feePct: 20, ownerId: adrian.id, expectedClose: ahead(60) },
    { companyId: companies[1].id, roleTitle: "Senior Data Engineer", stage: "agreement_signed", estSalary: 170000, feePct: 20, ownerId: adrian.id, expectedClose: ahead(30) },
    { companyId: companies[4].id, roleTitle: "BI Developer", stage: "placement", estSalary: 118000, feePct: 18, ownerId: adrian.id, expectedClose: ago(20) },
  ]);

  await db.insert(s.drafts).values([
    { kind: "cold_email", personId: dms[2].id, companyId: companies[2].id, subject: "Your open data engineer role", body: `Hi ${dms[2].name.split(" ")[0]},\n\nI saw Cedar & Stone has had a data engineer role open for a few weeks. I run a small firm that places only data engineers and analytics people, so I usually have two or three ready to talk.\n\nWorth a 15 minute call this week?\n\nAdrian` },
    { kind: "follow_up", personId: dms[0].id, companyId: companies[0].id, subject: "Following up on Tuesday's call", body: `Hi ${dms[0].name.split(" ")[0]},\n\nThanks for the time on Tuesday. As promised, the terms are attached. Happy to walk through the guarantee on a quick call.\n\nAdrian`, status: "approved" },
    { kind: "cold_email", personId: dms[5].id, companyId: companies[5].id, subject: "Data hires at Parkline", body: `Hi ${dms[5].name.split(" ")[0]},\n\nCongrats on the new platform work at Parkline. If the team needs data engineers faster than your recruiters can find them, I can help.\n\nAdrian` },
  ]);

  // Candidate sourcing.
  const cands = await db.insert(s.people).values(CANDIDATES.map(([name, title, employer, location, skills], i) => ({
    type: "candidate" as const, name, title, currentEmployer: employer, location, skills,
    linkedinUrl: `https://www.linkedin.com/in/sample-${slug(name)}`, apolloId: `sample-person-${3000 + i}`,
    email: i % 2 === 0 ? `${slug(name).replace("-", ".")}@mail.example` : null, contactRevealed: i % 2 === 0,
  }))).returning();
  const srch = await db.insert(s.searches).values([
    { companyId: companies[1].id, title: "Senior Data Engineer", mustHaves: "5+ years, Python, Spark, healthcare data a plus", stack: "Python, Spark, Airflow, Snowflake, AWS", compRange: "$155k to $180k + bonus", process: "Recruiter screen, hiring manager, technical panel, offer. About 3 weeks.", sellingPoints: "New VP of Data, greenfield platform, hybrid in Nashville or remote.", openedAt: ago(12) },
    { companyId: companies[4].id, title: "BI Developer", mustHaves: "Power BI, SQL, stakeholder-facing", stack: "Power BI, Azure Synapse, SQL Server", compRange: "$105k to $125k", process: "Two interviews and a take-home dashboard.", sellingPoints: "Stable employer, 4-day in-office week, strong benefits.", openedAt: ago(30), status: "filled" },
    { companyId: companies[0].id, title: "Analytics Engineer", mustHaves: "dbt, SQL, modeling for operations data", stack: "dbt, Snowflake, Fivetran, Looker", compRange: "$130k to $150k", process: "Pending signed terms.", sellingPoints: "Small team, direct line to the VP of Data.", openedAt: ago(3), status: "on_hold" },
  ]).returning();
  const stages: s.CandidateStage[] = ["sourced", "sourced", "contacted", "contacted", "screened", "submitted", "interview", "rejected"];
  await db.insert(s.searchCandidates).values([
    ...[0, 2, 4, 7, 8, 10, 13, 15].map((ci, i) => ({ searchId: srch[0].id, personId: cands[ci].id, stage: stages[i], fitScore: 92 - i * 6, fitNotes: i < 4 ? "Strong stack match. Check healthcare data experience." : "Meets must-haves. Comp at the top of range.", source: i % 2 ? "LinkedIn (manual)" : "Apollo people search" })),
    ...[3, 9, 14].map((ci, i) => ({ searchId: srch[1].id, personId: cands[ci].id, stage: (["rejected", "placed", "interview"] as const)[i], fitScore: 80 + i * 5, fitNotes: "Power BI depth confirmed in screen.", source: "Referral" })),
    ...[1, 6].map((ci) => ({ searchId: srch[2].id, personId: cands[ci].id, stage: "sourced" as const, fitScore: 88, fitNotes: "dbt and Snowflake match.", source: "Talent pool" })),
  ]);

  // Business management.
  await db.insert(s.agreements).values([
    { companyId: companies[1].id, kind: "Direct-hire (contingency)", feePct: 20, guaranteeDays: 90, status: "signed", provider: "PandaDoc", signedAt: ago(14) },
    { companyId: companies[4].id, kind: "Direct-hire (contingency)", feePct: 18, guaranteeDays: 90, status: "signed", provider: "Docusign", signedAt: ago(48) },
    { companyId: companies[0].id, kind: "Direct-hire (contingency)", feePct: 20, guaranteeDays: 90, status: "sent", provider: "PandaDoc" },
    { companyId: companies[3].id, kind: "Direct-hire (contingency)", feePct: 20, guaranteeDays: 60, status: "draft", provider: "PandaDoc" },
  ]);
  await db.insert(s.placements).values([
    { companyId: companies[4].id, personId: cands[9].id, roleTitle: "BI Developer", salary: 118000, feePct: 18, startDate: ago(20), invoiceStatus: "invoiced", dueDate: ahead(10) },
    { companyId: companies[4].id, roleTitle: "Data Analyst", salary: 95000, feePct: 18, startDate: ago(75), invoiceStatus: "paid", dueDate: ago(45) },
    { companyId: companies[1].id, roleTitle: "Analytics Engineer", salary: 142000, feePct: 20, startDate: ago(50), invoiceStatus: "overdue", dueDate: ago(6) },
  ]);

  await db.insert(s.jobs).values([
    { kind: "draft_connection_notes", title: "Write connection notes for 1 queued person", payload: { personIds: [dms[3].id] } },
    { kind: "company_brief", title: "Refresh the brief for Lumen Grocers", payload: { companyId: companies[3].id } },
    { kind: "find_new_signals", title: "Daily LinkedIn hiring posts run", status: "done", result: "Added 7 new posts, skipped 3 duplicates and 2 staffing firms.", completedAt: ago(0.3) },
  ]);

  let balance = 2400;
  const ledger: [number, string, number][] = [
    [-45, "DFC weekly refresh: 15 emails, 5 phones revealed", 16], [-12, "Enrich 12 hiring-post companies", 11],
    [-30, "DFC weekly refresh: 14 emails, 4 phones revealed", 9], [-8, "Candidate email reveals (Brightpath search)", 5], [-25, "DFC weekly refresh: 13 emails, 3 phones revealed", 2],
  ];
  await db.insert(s.creditLedger).values(ledger.map(([delta, reason, days]) => ({ delta, reason, balanceAfter: (balance += delta), createdAt: ago(days) })));

  await db.insert(s.settings).values([
    { key: "apollo_budget", value: { cycleCredits: 2400, reservePct: 20, cycleResets: "1st of the month" } },
    { key: "claude_usage", value: { resets: "Wednesday 2:59 AM" } },
    { key: "kpi_targets", value: { dials: 60, connects: 12, meetings: 4, agreements: 1, placements: 1, costPerMeeting: 400, vendorWeeklyCost: 1200 } },
  ]);
}
