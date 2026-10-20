import { useEffect } from "react";
import { usePathname } from "expo-router";
import { describeProblem, problemDetails } from "@tentacle-tv/shared";
import { useServerCompat } from "@/hooks/useServerCompat";
import { hydrateProblemJournal, recordProblem, setProblemScreen, setProblemServerVersion } from "./problemJournalStore";

interface ErrorUtilsLike {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

let handlerInstalled = false;

/**
 * Une erreur JavaScript qui n'a été attrapée nulle part (une promesse d'un
 * geste, un minuteur) entre au journal avant que le gestionnaire de React
 * Native ne la traite comme avant. Rien ne change pour l'utilisateur : ce qui
 * se voit passe par les limites d'erreur des écrans.
 */
function installGlobalHandler(): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (handlerInstalled || !errorUtils) return;
  handlerInstalled = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    recordProblem(describeProblem({
      cause: isFatal ? "renderCrash" : "unknown",
      context: "screen",
      details: problemDetails({ message }),
    }));
    previous(error, isFatal);
  });
}

/**
 * Ce que le journal des erreurs doit savoir de l'app, tenu à jour à la racine :
 * l'écran courant, la version du serveur ; et sa relecture au démarrage.
 * Monté une fois, sous les fournisseurs.
 */
export function ProblemJournalBinding() {
  const pathname = usePathname();
  const { serverVersion } = useServerCompat();
  useEffect(() => {
    installGlobalHandler();
    void hydrateProblemJournal();
  }, []);
  useEffect(() => setProblemScreen(pathname), [pathname]);
  useEffect(() => setProblemServerVersion(serverVersion), [serverVersion]);
  return null;
}
