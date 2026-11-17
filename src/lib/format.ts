const DAY = 86_400_000;

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/** "today", "2d ago", "in 3d" */
export function rel(d: Date | null | undefined) {
  if (!d) return "";
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(d) - start(new Date())) / DAY);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days < 0 ? `${-days}d ago` : `in ${days}d`;
}
export const isDue = (d: Date | null | undefined) => !!d && d.getTime() <= new Date().setHours(23, 59, 59, 999);
export const label = (s: string | null | undefined) => (s ?? "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
