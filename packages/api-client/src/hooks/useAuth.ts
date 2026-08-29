import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginRequest } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { notifyUserChange } from "./useUserId";
import { useTentacleConfig } from "../context";

export function useAuth() {
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: async (credentials: LoginRequest): Promise<AuthResponse> => {
      client.setLoggingIn(true);
      try {
        if (client.useCredentials) {
          // Web: login via backend route — token is set as httpOnly cookie
          const baseUrl = client.getBaseUrl().replace(/\/api\/jellyfin$/, "");
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // deviceId : le backend en fait l'identité d'appareil présentée à
            // Jellyfin. Sans lui, toutes les sessions d'un même compte
            // partagent un seul appareil côté Jellyfin — et se déconnectent
            // les unes les autres au moindre logout.
            // client/device : l'identité que ce lecteur annoncera ensuite dans
            // son en-tête `MediaBrowser`. Jellyfin indexe ses sessions par
            // (DeviceId, Client, compte), et sans ces deux champs le backend
            // émettait le token sous une identité maison — le tableau de bord
            // montrait alors DEUX appareils lisant le même épisode.
            //
            // Le `DeviceId` compte tout autant, et il ne suffit PAS que
            // l'en-tête et l'URL de stream portent la même valeur : le token,
            // lui, est accroché à l'identifiant dérivé par le backend. Mesuré —
            // avec le seul `Client` aligné, il restait deux cartes au libellé
            // identique, même compte, même épisode, même position. D'où
            // l'adoption ci-dessous.
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
              deviceId: client.getLoginDeviceId(),
              client: client.getClientName(),
              device: client.getDeviceName(),
            }),
            credentials: "include",
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: "Login failed" }));
            throw new Error(err.message || "Login failed");
          }
          const data = await res.json();
          // L'autre moitié de l'alignement. Le backend a haché la graine avant
          // de la présenter à Jellyfin — on ne peut donc pas la deviner : il la
          // renvoie, le client l'adopte. Absente d'un backend antérieur : on
          // garde la graine brute, soit le comportement d'avant.
          if (data.DeviceId) client.adoptJellyfinDeviceId(data.DeviceId);
          // Token is in httpOnly cookie — also set accessToken for Jellyfin auth header
          client.setAccessToken(data.AccessToken);
          storage.setItem("tentacle_token", data.AccessToken);
          storage.setItem("tentacle_user", JSON.stringify(data.User));
          // Réactivité auth explicite : le monkey-patch de localStorage.setItem
          // est ignoré par WebKit/WKWebView (desktop macOS) → notifier ici.
          notifyUserChange();
          return data as AuthResponse;
        }

        // Mobile/desktop: login via Jellyfin proxy — token in response body
        const response = await client.fetch<AuthResponse>(
          "/Users/AuthenticateByName",
          {
            method: "POST",
            body: JSON.stringify({
              Username: credentials.username,
              Pw: credentials.password,
            }),
          }
        );
        client.setAccessToken(response.AccessToken);
        storage.setItem("tentacle_token", response.AccessToken);
        storage.setItem("tentacle_user", JSON.stringify(response.User));
        notifyUserChange();
        return response;
      } finally {
        // Release after a short delay to let post-login queries settle
        setTimeout(() => client.setLoggingIn(false), 2000);
      }
    },
    onSuccess: () => {
      // Force all existing query observers to refetch with the new auth state.
      // Without this, queries created during the render transition (where useUserId
      // may have returned null) stay disabled and never fire — causing a blank page.
      queryClient.invalidateQueries();
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      if (client.useCredentials) {
        // Web: call backend logout to clear httpOnly cookie.
        // Timeout court : backend off, ce fetch ne doit jamais bloquer la
        // purge locale (sans lui, la déconnexion semble « ne rien faire »).
        const baseUrl = client.getBaseUrl().replace(/\/api\/jellyfin$/, "");
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          signal: AbortSignal.timeout(3000),
        }).catch(() => {});
      }
      client.setAccessToken(null);
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      notifyUserChange();
      queryClient.clear();
    },
  });

  // Full reset that also wipes the server URL — required when the backend is
  // unreachable or moved, so the client can be redirected to server-setup.
  // Does not await the backend logout (server may be dead by design).
  const changeServer = useMutation({
    mutationFn: async () => {
      if (client.useCredentials) {
        const baseUrl = client.getBaseUrl().replace(/\/api\/jellyfin$/, "");
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          signal: AbortSignal.timeout(3000),
        }).catch(() => {});
      }
      client.setAccessToken(null);
      // L'identité adoptée est dérivée d'un secret PROPRE au serveur qu'on
      // quitte : la garder n'aurait aucun sens sur le suivant. La graine locale
      // reste — c'est l'appareil, il ne change pas de serveur.
      client.adoptJellyfinDeviceId(null);
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      storage.removeItem("tentacle_server_url");
      storage.removeItem("tentacle_jellyfin_token");
      storage.removeItem("tentacle_jellyfin_url");
      storage.removeItem("tentacle_credentials");
      notifyUserChange();
      queryClient.clear();
    },
  });

  return { login, logout, changeServer };
}
