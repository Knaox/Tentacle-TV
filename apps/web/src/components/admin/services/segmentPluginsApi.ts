import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SegmentSetupRun, SegmentSetupStartRequest } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { readSegmentRun } from "../../segmentPlugins/segmentRunModel";
import { JELLYFIN_ADMIN_KEYS, JellyfinAdminError } from "../jellyfin/jellyfinAdminApi";

/**
 * « Installer / réparer la détection des passages » : lancer un passage
 * (`POST`, qui rend aussitôt) puis le suivre (`GET`, toutes les 1,5 s tant
 * qu'il tourne). À la fin, les réglages recommandés sont relus : la carte des
 * greffons et le tableau de bord suivent.
 */

export const SEGMENT_RUN_KEY = ["admin", "jellyfin", "segment-plugins"] as const;

async function request(method: "GET" | "POST", body?: SegmentSetupStartRequest): Promise<SegmentSetupRun> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/admin/jellyfin/segment-plugins`, {
      method,
      headers: hdrs(),
      credentials: creds(),
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch {
    throw new JellyfinAdminError(0, "network");
  }
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new JellyfinAdminError(res.status, null);
  const run = readSegmentRun(raw);
  if (!run) throw new JellyfinAdminError(res.status, "unreadable");
  return run;
}

export function useSegmentRun() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: SEGMENT_RUN_KEY,
    queryFn: async () => {
      const before = queryClient.getQueryData<SegmentSetupRun>(SEGMENT_RUN_KEY);
      const run = await request("GET");
      // Il vient de finir : la carte des greffons et le tableau de bord relisent l'état réel.
      if (before?.running && !run.running) void queryClient.invalidateQueries({ queryKey: JELLYFIN_ADMIN_KEYS.setup });
      return run;
    },
    retry: false,
    refetchInterval: (query) => (query.state.data?.running ? 1500 : false),
  });
}

export function useStartSegmentSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SegmentSetupStartRequest) => request("POST", body),
    onSuccess: (run) => queryClient.setQueryData(SEGMENT_RUN_KEY, run),
  });
}
