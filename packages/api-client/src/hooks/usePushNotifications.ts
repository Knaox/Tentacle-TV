import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Client des endpoints /api/push. Même pattern que usePreferences : base URL et
// token surchargeables au niveau module (React Native n'a pas de localStorage).

let _backendBase = "/api/push";
let _tokenOverride: string | null = null;

export function setPushBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/push`;
}

/** Définit le token d'auth pour les plateformes sans localStorage (React Native). */
export function setPushToken(token: string | null) {
  _tokenOverride = token;
}

function getAuthHeader(): Record<string, string> {
  const token =
    _tokenOverride ??
    (typeof localStorage !== "undefined" ? localStorage.getItem("tentacle_token") : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function hasToken(): boolean {
  return !!(
    _tokenOverride ||
    (typeof localStorage !== "undefined" && localStorage.getItem("tentacle_token"))
  );
}

async function pushFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers,
    credentials: hasToken() ? undefined : "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

// ---------- Types ----------

export interface PushPreferences {
  libraryAdded: boolean;
  seerAvailable: boolean;
}

export interface TestPushResult {
  sent: number;
  reason?: "no_device";
}

// ---------- Hooks ----------

/** Enregistre / rafraîchit le token Expo de l'appareil auprès du backend. */
export function useRegisterPushDevice() {
  return useMutation({
    mutationFn: (data: { token: string; platform: "ios" | "android" }) =>
      pushFetch<{ success: boolean }>("/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

/** Préférences de notification push de l'utilisateur. */
export function usePushPreferences() {
  return useQuery({
    queryKey: ["push-preferences"],
    queryFn: () => pushFetch<PushPreferences>("/preferences"),
    enabled: hasToken(),
    staleTime: 60_000,
  });
}

/** Met à jour (partiellement) les préférences push. */
export function useSetPushPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PushPreferences>) =>
      pushFetch<PushPreferences>("/preferences", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["push-preferences"], data);
    },
  });
}

/** Envoie une notification de test aux appareils de l'utilisateur courant. */
export function useSendTestPush() {
  return useMutation({
    mutationFn: () => pushFetch<TestPushResult>("/test", { method: "POST" }),
  });
}
