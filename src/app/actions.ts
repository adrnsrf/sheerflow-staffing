"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApolloError, apolloAccountsInList } from "@/connectors/apollo";
import * as core from "@/core";
import type { CallOutcome, CandidateStage, ConnectionStatus, SignalStatus } from "@/db/schema";

// Server actions: what the buttons call. Each one is a thin wrapper around src/core.
const num = (f: FormData, k: string) => Number(f.get(k));
const str = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() || undefined;
const done = () => revalidatePath("/", "layout");

export async function signalAction(f: FormData) { await core.setSignalStatus(num(f, "id"), f.get("status") as SignalStatus); done(); }
export async function logCallAction(f: FormData) { await core.logCall({ queueId: num(f, "queueId"), outcome: f.get("outcome") as CallOutcome, notes: str(f, "notes") }); done(); }
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
