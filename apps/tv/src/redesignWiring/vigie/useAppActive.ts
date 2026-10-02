import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** L'app est au premier plan — en arrière-plan, les demandes ne se suivent plus. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}
