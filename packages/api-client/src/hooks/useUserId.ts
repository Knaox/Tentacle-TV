import { useTentacleConfig } from "../context";

export function useUserId(): string | null {
  const { storage } = useTentacleConfig();
  try {
    const raw = storage.getItem("tentacle_user");
    if (!raw) return null;
    return JSON.parse(raw).Id ?? null;
  } catch {
    return null;
  }
}
