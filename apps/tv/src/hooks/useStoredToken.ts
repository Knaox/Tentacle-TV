import { useEffect, useState } from "react";
import type { StorageAdapter } from "@tentacle-tv/api-client";

/**
 * Le jeton de jumelage, relu toutes les deux secondes. Les synchronisations
 * montées au-dessus du navigateur (direct streaming, canal de session) ne
 * sont pas remontées par un jumelage ou une déconnexion : sans cette relecture,
 * elles garderaient le jeton du démarrage.
 */
export function useStoredToken(storage: StorageAdapter): string | null {
  const [token, setToken] = useState<string | null>(storage.getItem("tentacle_token"));
  useEffect(() => {
    const id = setInterval(() => {
      const current = storage.getItem("tentacle_token");
      setToken((prev) => (current !== prev ? current : prev));
    }, 2000);
    return () => clearInterval(id);
  }, [storage]);
  return token;
}
