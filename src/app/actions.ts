"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApolloError, apolloAccountsInList } from "@/connectors/apollo";
import fs from "node:fs";
import path from "node:path";
import * as core from "@/core";
import * as imports from "@/core/imports";
import * as context from "@/core/context";
import * as signals from "@/core/signals";
import * as staffing from "@/core/staffing";
import { IMPORTS_DIR } from "@/db/client";
import type { CallOutcome, CandidateStage, ConnectionStatus, ContextKind, JobPostingStatus, SignalStatus, StaffingStatus } from "@/db/schema";

// Server actions: what the buttons call. Each one is a thin wrapper around src/core.
const num = (f: FormData, k: string) => Number(f.get(k));
const str = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() || undefined;
const done = () => revalidatePath("/", "layout");

export async function signalAction(f: FormData) { await core.setSignalStatus(num(f, "id"), f.get("status") as SignalStatus); done(); }
export async function logCallAction(f: FormData) { await core.logCall({ queueId: num(f, "queueId"), outcome: f.get("outcome") as CallOutcome, phoneNumberId: num(f, "phoneNumberId") || undefined, notes: str(f, "notes") }); done(); }
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
    query = new URLSearchParams({ done: kind, result: Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", ") }).toString();
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
export async function signalTypeAction(f: FormData) { await signals.updateSignalType(str(f, "type") ?? "", num(f, "weight"), num(f, "halfLifeDays")); done(); }
