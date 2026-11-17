import { exportBackup } from "@/core/backup";

// Download the whole app as one file.
export async function GET() {
  const backup = await exportBackup();
  const day = backup.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(backup), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="sheerflow-backup-${day}.json"` } });
}
