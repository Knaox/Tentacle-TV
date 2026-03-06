import { createContext, useContext } from "react";

export interface ServerUrlContextValue {
  serverUrl: string | null;
  setServerUrl: (url: string) => void;
}

export const ServerUrlContext = createContext<ServerUrlContextValue>({
  serverUrl: null,
  setServerUrl: () => {},
});

export function useServerUrl() {
  return useContext(ServerUrlContext);
}
