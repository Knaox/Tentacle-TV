import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginRequest } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useTentacleConfig } from "../context";

export function useAuth() {
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: async (credentials: LoginRequest): Promise<AuthResponse> => {
      if (client.useCredentials) {
        // Web: login via backend route — token is set as httpOnly cookie
        const baseUrl = client.getBaseUrl().replace(/\/api\/jellyfin$/, "");
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: credentials.username, password: credentials.password }),
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Login failed" }));
          throw new Error(err.message || "Login failed");
        }
        const data = await res.json();
        // Token is in httpOnly cookie — also set accessToken for Jellyfin auth header
        client.setAccessToken(data.AccessToken);
        storage.setItem("tentacle_user", JSON.stringify(data.User));
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
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      if (client.useCredentials) {
        // Web: call backend logout to clear httpOnly cookie
        const baseUrl = client.getBaseUrl().replace(/\/api\/jellyfin$/, "");
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      }
      client.setAccessToken(null);
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      queryClient.clear();
    },
  });

  return { login, logout };
}
