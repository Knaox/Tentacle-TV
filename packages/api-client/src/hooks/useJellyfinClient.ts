import { createContext, useContext } from "react";
import { JellyfinClient } from "../jellyfin";

export const JellyfinClientContext = createContext<JellyfinClient | null>(null);

export function useJellyfinClient(): JellyfinClient {
  const client = useContext(JellyfinClientContext);
  if (!client) {
    throw new Error(
      "useJellyfinClient must be used within a JellyfinClientProvider"
    );
  }
  return client;
}
