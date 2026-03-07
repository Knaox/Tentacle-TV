import { backendUrl, isTauriApp } from "../main";

export const BACKEND = backendUrl;

export const hdrs = (): Record<string, string> => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("tentacle_token");
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/** credentials option: use cookies on web, nothing on desktop (token is in header) */
export const creds = (): RequestCredentials | undefined =>
  isTauriApp ? undefined : "include";

export const cls = {
  card: "mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-6",
  sub: "rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3",
  inp: "w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-purple-500",
  lbl: "mb-1 block text-xs text-white/40",
  bp: "rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40 transition",
  bs: "rounded-lg bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 disabled:opacity-40 transition",
  bd: "rounded-lg bg-red-600/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-40 transition",
};
