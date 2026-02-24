import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginRequest } from "@tentacle/shared";
import { useJellyfinClient } from "./useJellyfinClient";

export function useAuth() {
  const client = useJellyfinClient();
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
      localStorage.setItem("tentacle_token", response.AccessToken);
      localStorage.setItem("tentacle_user", JSON.stringify(response.User));
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      client.setAccessToken(null);
      localStorage.removeItem("tentacle_token");
      localStorage.removeItem("tentacle_user");
      queryClient.clear();
    },
  });

  return { login, logout };
}
