import { createContext, useContext } from "react";
import type { StorageAdapter, UuidGenerator } from "./storage";

export interface TentacleConfig {
  storage: StorageAdapter;
  uuid: UuidGenerator;
}

export const TentacleConfigContext = createContext<TentacleConfig | null>(null);

export function useTentacleConfig(): TentacleConfig {
  const config = useContext(TentacleConfigContext);
  if (!config) {
    throw new Error("useTentacleConfig must be used within TentacleConfigContext.Provider");
  }
  return config;
}
