"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApolloError, apolloAccountsInList } from "@/connectors/apollo";
import fs from "node:fs";
import path from "node:path";
import * as core from "@/core";
import * as imports from "@/core/imports";
import * as candidates from "@/core/candidates";
import { startClaudeRun } from "@/core/claude-runner";
import * as context from "@/core/context";
import * as outreach from "@/core/outreach";
import { DIMENSIONS, type Source } from "@/core/candidate-schema";
import { getRole, saveRole } from "@/core/matching";
import * as signals from "@/core/signals";
import * as staffing from "@/core/staffing";
import { IMPORTS_DIR } from "@/db/client";
import type { CallOutcome, CandidateSourceKind, CandidateStage, ConnectionStatus, ContextKind, DealStage, InvoiceStatus, JobPostingStatus, SignalStatus, StaffingStatus } from "@/db/schema";

// Server actions: what the buttons call. Each one is a thin wrapper around src/core.
const num = (f: FormData, k: string) => Number(f.get(k));
const str = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() || undefined;
const done = () => revalidatePath("/", "layout");

export async function signalAction(f: FormData) { await core.setSignalStatus(num(f, "id"), f.get("status") as SignalStatus); done(); }
export async function logCallAction(f: FormData) { await core.logCall({ queueId: num(f, "queueId"), outcome: f.get("outcome") as CallOutcome, phoneNumberId: num(f, "phoneNumberId") || undefined, notes: str(f, "notes"), userId: num(f, "userId") || undefined }); done(); }
export async function addToCallListAction(f: FormData) { await core.addToCallList(num(f, "companyId"), { addedBy: "Account page" }); done(); }
export async function queueConnectionAction(f: FormData) { await core.queueConnection(num(f, "personId")); done(); }
export async function saveNoteAction(f: FormData) { await core.saveConnectionNote(num(f, "personId"), str(f, "note") ?? ""); done(); }
export async function connectionStatusAction(f: FormData) { await core.setConnectionStatus(num(f, "personId"), f.get("status") as ConnectionStatus); done(); }
export async function draftStatusAction(f: FormData) { await core.setDraftStatus(num(f, "id"), f.get("status") as "draft" | "approved" | "sent"); done(); }
export async function taskDoneAction(f: FormData) { await core.setTaskDone(num(f, "id"), f.get("done") === "true"); done(); }
export async function addTaskAction(f: FormData) { const title = str(f, "title"); if (title) await core.addTask({ title, ownerId: num(f, "ownerId") || undefined }); done(); }
export async function candidateStageAction(f: FormData) { await core.setCandidateStage(num(f, "id"), f.get("stage") as CandidateStage); done(); }
export async function queueJobAction(f: FormData) {
  await core.queueJob({ kind: str(f, "kind") ?? "custom", title: str(f, "title") ?? "Job", payload: JSON.parse(str(f, "payload") ?? "{}") });
  done();
}

/** Pull one page of saved accounts from an Apollo list into Accounts. Costs no credits. */
export async function importApolloListAction(f: FormData) {
  const listId = str(f, "listId") ?? "", page = num(f, "page") || 1;
  let query: string;
  try {
    const { accounts, totalPages } = await apolloAccountsInList(listId, page, 25);
    const r = await core.importCompanies(accounts);
    query = new URLSearchParams({ list: listId, page: String(page), pages: String(totalPages), added: String(r.added), skipped: String(r.skipped), noDomain: String(r.noDomain) }).toString();
  } catch (e) {
    if (!(e instanceof ApolloError)) throw e;
    query = new URLSearchParams({ error: e.message }).toString();
  }
  done();
  redirect(`/system/connectors/apollo?${query}`);
}

export async function draftMessageAction(f: FormData) { await core.queueMessageDraft(num(f, "personId")); done(); }
export async function jobPostingAction(f: FormData) {
  if (f.get("status") === "promote") await imports.promoteJobPosting(num(f, "id")); else await imports.setJobPostingStatus(num(f, "id"), f.get("status") as JobPostingStatus);
  done();
}
export async function queueRoutineAction(f: FormData) { await context.queueRoutineRun(str(f, "id") ?? ""); done(); }

// AI context store
export async function saveContextAction(f: FormData) {
  let target: string;
  try {
    const slug = await context.saveContext({ slug: str(f, "slug"), kind: (str(f, "kind") ?? "skill") as ContextKind, title: str(f, "title") ?? "", summary: str(f, "summary"), schedule: str(f, "schedule"), body: str(f, "body") ?? "" });
    target = `/system/context/${slug}?saved=1`;
  } catch (e) { target = `/system/context?error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`; }
  done();
  redirect(target);
}
export async function resetContextAction(f: FormData) { await context.resetContext(str(f, "slug") ?? ""); done(); redirect(`/system/context/${str(f, "slug")}?saved=reset`); }
export async function deleteContextAction(f: FormData) { await context.deleteContext(str(f, "slug") ?? ""); done(); redirect("/system/context"); }

// Staffing archive
export async function staffingStatusAction(f: FormData) {
  await staffing.setStaffingStatus(num(f, "id"), f.get("status") as StaffingStatus);
  if (f.get("status") !== "not_staffing") await imports.purgeStaffing();
  done();
}
export async function addStaffingAction(f: FormData) {
  const name = str(f, "name");
  if (name) { await staffing.addStaffingFirm({ name, status: "confirmed", source: "Added by hand", note: str(f, "note") }); await imports.purgeStaffing(); }
  done();
}

/** An import result in plain words, leaving out anything that was zero. */
function importSentence(r: Record<string, number>) {
  const say: [string, (n: number) => string][] = [
    ["added", (n) => `${n} new`], ["updated", (n) => `${n} updated from the sheet`], ["unchanged", (n) => `${n} already here and unchanged`], ["alreadyThere", (n) => `${n} already here`],
    ["companiesAdded", (n) => `${n} new compan${n === 1 ? "y" : "ies"}`], ["peopleAdded", (n) => `${n} new ${n === 1 ? "person" : "people"}`], ["callsLogged", (n) => `${n} past call${n === 1 ? "" : "s"} read from the notes`],
    ["matchedToAccounts", (n) => `${n} matched to companies you already have`], ["staffingDropped", (n) => `${n} from staffing firms left out`], ["dismissedNonUs", (n) => `${n} outside the US set aside`], ["skipped", (n) => `${n} skipped for missing details`],
  ];
  const parts = say.filter(([k]) => r[k] > 0).map(([k, f]) => f(r[k]));
  return `Read ${r.rows} row${r.rows === 1 ? "" : "s"}: ${parts.join(", ") || "nothing new"}.`;
}

const IMPORTERS = { "call-list": imports.importCallSheet, "hiring-posts": imports.importHiringPosts, "job-alerts": imports.importJobAlerts } as const;
export type ImportKind = keyof typeof IMPORTERS;

/** Import a file from the imports/ folder, or an uploaded CSV saved from the sheet. */
export async function importAction(f: FormData) {
  const kind = str(f, "kind") as ImportKind;
  let query: string;
  try {
    const upload = f.get("file");
    let rows: Record<string, string>[];
    if (upload instanceof File && upload.size > 0) rows = imports.csvToRows(await upload.text(), kind === "call-list" ? "Company" : kind === "hiring-posts" ? "Post ID" : "jobId");
    else rows = JSON.parse(fs.readFileSync(path.join(IMPORTS_DIR, `${kind}.json`), "utf8"));
    const r = await IMPORTERS[kind](rows);
    query = new URLSearchParams({ done: kind, result: importSentence(r as unknown as Record<string, number>) }).toString();
  } catch (e) {
    query = new URLSearchParams({ error: e instanceof Error ? e.message : String(e) }).toString();
  }
  done();
  redirect(`/system/import?${query}`);
}

/** Check who accepted, from LinkedIn's own Connections export. */
export async function connectionsUploadAction(f: FormData) {
  let query: string;
  try {
    const upload = f.get("file");
    if (!(upload instanceof File) || upload.size === 0) throw new Error("Choose the Connections.csv file first.");
    const r = await imports.importLinkedInConnections(await upload.text());
    query = new URLSearchParams({ checked: `${r.connectionsInFile} connections in the file. Newly marked connected: ${r.newlyConnected}${r.names.length ? ` (${r.names.join(", ")})` : ""}. Already marked: ${r.alreadyConnected}.` }).toString();
  } catch (e) {
    query = new URLSearchParams({ error: e instanceof Error ? e.message : String(e) }).toString();
  }
  done();
  redirect(`/bd/connections?${query}`);
}

/** Change how much a kind of signal counts, and how fast it fades. */
export async function signalTypeAction(f: FormData) { await signals.updateSignalType(str(f, "type") ?? "", num(f, "weight"), num(f, "halfLifeDays")); done(); redirect(`/system/scoring?saved=${encodeURIComponent(str(f, "label") ?? "Saved")}`); }

// Candidates and roles
const back = (path: string, e: unknown) => `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`;

/** Add a candidate, with a first piece of raw material if one was pasted. */
export async function createCandidateAction(f: FormData) {
  let target: string;
  try {
    const id = await candidates.createCandidate({ name: str(f, "name") ?? "", linkedinUrl: str(f, "linkedinUrl"), email: str(f, "email") });
    if (str(f, "content")) await candidates.addCandidateSource({ personId: id, kind: (str(f, "kind") ?? "linkedin") as CandidateSourceKind, title: str(f, "title"), content: str(f, "content")! });
    target = `/sourcing/candidates/${id}`;
  } catch (e) { target = back("/sourcing/candidates/new", e); }
  done();
  redirect(target);
}
export async function addSourceAction(f: FormData) {
  const id = num(f, "personId");
  let target = `/sourcing/candidates/${id}?saved=source`;
  try { await candidates.addCandidateSource({ personId: id, kind: (str(f, "kind") ?? "recruiter_note") as CandidateSourceKind, title: str(f, "title"), content: str(f, "content") ?? "" }); }
  catch (e) { target = back(`/sourcing/candidates/${id}`, e); }
  done();
  redirect(target);
}
export async function compileCandidateAction(f: FormData) { await candidates.queueCompile(num(f, "personId")); done(); }
/** Save the profile JSON edited by hand. */
export async function saveProfileAction(f: FormData) {
  const id = num(f, "personId");
  let target = `/sourcing/candidates/${id}?saved=profile`;
  try { await candidates.saveCandidateProfile(id, JSON.parse(str(f, "json") ?? "{}")); }
  catch (e) { target = back(`/sourcing/candidates/${id}`, e); }
  done();
  redirect(target);
}
/** Save the personality form: one optional value and note per scale, plus interests. */
export async function savePersonalityAction(f: FormData) {
  const id = num(f, "personId");
  let target = `/sourcing/candidates/${id}?saved=personality#personality`;
  try {
    const dimensions = Object.fromEntries(DIMENSIONS.map((d) => {
      const value = num(f, `v_${d.key}`);
      return [d.key, value >= 1 && value <= 5 ? { value, evidence: str(f, `e_${d.key}`), source: (str(f, `s_${d.key}`) ?? "recruiter_note") as Source, confidence: (str(f, `c_${d.key}`) ?? "stated") as "stated" | "inferred" } : null];
    }));
    await candidates.updatePersonality(id, { dimensions, interests: (str(f, "interests") ?? "").split(",").map((x) => x.trim()).filter(Boolean), notes: str(f, "notes") ?? "" });
  } catch (e) { target = back(`/sourcing/candidates/${id}`, e); }
  done();
  redirect(target);
}
/** Save the team style a role wants: a value per scale, or blank for no preference. */
export async function saveRoleStyleAction(f: FormData) {
  const id = num(f, "id");
  const role = await getRole(id);
  if (role) {
    const style = Object.fromEntries(DIMENSIONS.map((d) => [d.key, num(f, `v_${d.key}`)]).filter(([, v]) => (v as number) >= 1 && (v as number) <= 5));
    await saveRole({ id, title: role.title, clientName: role.clientName ?? undefined, companyId: role.companyId ?? undefined, description: role.description ?? "", requirements: { ...(role.requirements ?? { tools: [] }), style: Object.keys(style).length ? style : undefined } });
  }
  done();
  redirect(`/sourcing/searches/${id}`);
}
export async function addToSearchAction(f: FormData) { await candidates.addToSearch(num(f, "searchId"), num(f, "personId"), num(f, "fitScore") || undefined, str(f, "fitNotes")); done(); }
export async function clearSamplesAction() { await candidates.clearSampleCandidates(); done(); }
export async function saveRoleAction(f: FormData) {
  let target: string;
  try {
    const reqJson = str(f, "requirements");
    const id = await saveRole({ id: num(f, "id") || undefined, title: str(f, "title") ?? "", clientName: str(f, "clientName"), description: str(f, "description") ?? "", requirements: reqJson ? JSON.parse(reqJson) : undefined });
    target = `/sourcing/searches/${id}`;
  } catch (e) { target = back("/sourcing/searches", e); }
  done();
  redirect(target);
}

// Candidate outreach
export async function outreachAction(f: FormData) { await outreach.logOutreach(num(f, "personId"), num(f, "searchId"), f.get("channel") as outreach.Channel); done(); }
export async function consentAction(f: FormData) { await outreach.setConsent(num(f, "personId"), f.get("agreed") === "on", str(f, "note")); done(); redirect(`/sourcing/candidates/${num(f, "personId")}?saved=consent#consent`); }
/** Returns a result instead of redirecting, so the button can say what happened in place. */
export async function screenCallAction(f: FormData): Promise<{ message?: string; error?: string }> {
  try {
    const call = await outreach.requestScreenCall(num(f, "personId"), num(f, "searchId"));
    done();
    return call.status === "failed" ? { error: call.detail ?? "The call could not be placed" } : { message: call.status === "requested" ? "Call placed" : "Request recorded (Retell not connected, no call placed)" };
  } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}
export async function refreshScreenCallAction(f: FormData) { await outreach.refreshScreenCall(num(f, "id")); done(); }

// Claude runs
/** Start Claude Code on this computer to work the queue. */
export async function runClaudeAction() {
  let target = "/system/claude?run=started";
  try {
    const h = await headers();
    await startClaudeRun(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`);
  } catch (e) { target = `/system/claude?error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`; }
  done();
  redirect(target);
}
export async function cancelJobAction(f: FormData) { await core.cancelJob(num(f, "id")); done(); }

// Business side: add and move things by hand
const tryTo = async (path: string, fn: () => Promise<unknown>) => { let target = path; try { await fn(); } catch (e) { target = back(path, e); } done(); redirect(target); };
export async function addDealAction(f: FormData) { await tryTo("/bd/pipeline", () => core.addDeal({ companyName: str(f, "company") ?? "", roleTitle: str(f, "role") ?? "", estSalary: num(f, "salary"), feePct: num(f, "fee"), stage: (str(f, "stage") ?? "first_meeting") as DealStage })); }
export async function dealStageAction(f: FormData) { await core.setDealStage(num(f, "id"), f.get("stage") as DealStage); done(); }
export async function addAgreementAction(f: FormData) { await tryTo("/manage/clients", () => core.addAgreement({ companyName: str(f, "company") ?? "", feePct: num(f, "fee"), guaranteeDays: num(f, "guarantee"), status: (str(f, "status") ?? "draft") as "draft" | "sent" | "signed" })); }
export async function agreementStatusAction(f: FormData) { await core.setAgreementStatus(num(f, "id"), f.get("status") as "draft" | "sent" | "signed"); done(); }
export async function addPlacementAction(f: FormData) { await tryTo("/manage/money", () => core.addPlacement({ companyName: str(f, "company") ?? "", roleTitle: str(f, "role") ?? "", salary: num(f, "salary"), feePct: num(f, "fee"), startDate: str(f, "start") })); }
export async function invoiceStatusAction(f: FormData) { await core.setInvoiceStatus(num(f, "id"), f.get("status") as InvoiceStatus); done(); }

/** Save a role's requirements from the row-by-row form (no JSON). The team style is kept as it is. */
export async function saveRequirementsAction(f: FormData) {
  const id = num(f, "id");
  const role = await getRole(id);
  if (role) {
    const count = num(f, "count");
    const tools = Array.from({ length: count }, (_, i) => i).filter((i) => !f.get(`x_${i}`)).map((i) => ({ name: str(f, `n_${i}`) ?? "", minYears: Math.max(0, num(f, `y_${i}`) || 0), must: f.get(`m_${i}`) === "must" })).filter((x) => x.name);
    if (str(f, "new_name")) tools.push({ name: str(f, "new_name")!, minYears: Math.max(0, num(f, "new_years") || 1), must: f.get("new_must") === "must" });
    const size = str(f, "companySize"), wp = str(f, "workplace");
    await saveRole({ id, title: role.title, clientName: role.clientName ?? undefined, companyId: role.companyId ?? undefined, description: str(f, "description") ?? role.description ?? "", requirements: {
      tools, minTotalYears: num(f, "minTotalYears") || undefined, companySize: (size || undefined) as never, workplace: (wp || undefined) as never, city: str(f, "city"), state: str(f, "state"), maxBase: num(f, "maxBase") ? num(f, "maxBase") * 1000 : undefined, style: role.requirements?.style,
    } });
  }
  done();
  redirect(`/sourcing/searches/${id}`);
}
