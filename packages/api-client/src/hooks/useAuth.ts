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
      client.setAccessToken(null);
      storage.removeItem("tentacle_token");
      storage.removeItem("tentacle_user");
      queryClient.clear();
    },
  });

  return { login, logout };
}
