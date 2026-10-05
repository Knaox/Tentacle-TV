import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RemoteAccessSettingsPatch, RemoteAccessState, RemoteCheckReport } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../../pages/adminUtils";

/**
 * L'accès à distance côté client : `/api/admin/remote-access` (réservé à un
 * administrateur en session personnelle). Contrat :
 * `packages/shared/src/remoteAccess/remoteAccessContract.ts`.
 */
export const REMOTE_ACCESS_KEY = ["admin", "remote-access"] as const;

export class RemoteAccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(code ?? `HTTP ${status}`);
  }
}

async function call<T>(path: string, method = "GET", body?: object): Promise<T> {
  const headers = hdrs();
  // Un POST sans corps mais typé JSON, Fastify le refuse : pas de corps, pas d'en-tête.
  if (body === undefined) delete headers["Content-Type"];
  const res = await fetch(`${BACKEND}/api/admin${path}`, {
    method,
    headers,
    credentials: creds(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code = raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string" ? raw.error : null;
    throw new RemoteAccessError(res.status, code);
  }
  return raw as T;
}

export const remoteAccessApi = {
  state: () => call<RemoteAccessState>("/remote-access"),
  save: (patch: RemoteAccessSettingsPatch) => call<RemoteAccessState>("/remote-access", "PUT", patch),
  check: () => call<RemoteCheckReport>("/remote-access/check", "POST"),
};

export const useRemoteAccess = () => useQuery({ queryKey: REMOTE_ACCESS_KEY, queryFn: remoteAccessApi.state, staleTime: 0 });

/** Enregistre un réglage, montré tout de suite ; revient en arrière si le serveur refuse. */
export function useSaveRemoteAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: remoteAccessApi.save,
    onMutate: async (patch: RemoteAccessSettingsPatch) => {
      await queryClient.cancelQueries({ queryKey: REMOTE_ACCESS_KEY });
      const previous = queryClient.getQueryData<RemoteAccessState>(REMOTE_ACCESS_KEY);
      if (previous) queryClient.setQueryData<RemoteAccessState>(REMOTE_ACCESS_KEY, { ...previous, settings: { ...previous.settings, ...patch } });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(REMOTE_ACCESS_KEY, context.previous);
    },
    onSuccess: (state) => queryClient.setQueryData(REMOTE_ACCESS_KEY, state),
  });
}

export function useRunRemoteCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: remoteAccessApi.check,
    onSuccess: (report) =>
      queryClient.setQueryData<RemoteAccessState>(REMOTE_ACCESS_KEY, (prev) => (prev ? { ...prev, lastCheck: report } : prev)),
  });
}
