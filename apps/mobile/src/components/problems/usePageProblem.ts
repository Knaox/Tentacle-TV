import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import {
  problemFromError,
  type FailureTarget, type ProblemActionKey, type ProblemAvailability, type ProblemContext, type ProblemModel,
} from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";

interface Options {
  /** Ce que la page joignait (défaut : Jellyfin par le relais du serveur). */
  target?: FailureTarget;
  context?: ProblemContext;
  availability?: ProblemAvailability;
  onRetry: () => void;
}

/**
 * L'erreur d'une requête de page, mise en message — et ses gestes communs :
 * réessayer, se reconnecter, revenir. `null` tant qu'il n'y a pas d'erreur.
 */
export function usePageProblem(error: unknown, options: Options): {
  model: ProblemModel | null;
  onAction: (key: ProblemActionKey) => void;
} {
  const router = useRouter();
  const { target = "relayed", context = "page", availability, onRetry } = options;
  const key = JSON.stringify(availability ?? {});
  const model = useMemo(
    () => (error ? problemFromError(error, { target, context, availability }) : null),
    [error, target, context, key], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const onAction = useCallback((action: ProblemActionKey) => {
    if (action === "retry") onRetry();
    else if (action === "signIn") router.replace("/(auth)/login");
    else if (action === "offlineLibrary") router.push("/on-device");
    else backOrHome(router);
  }, [onRetry, router]);
  return { model, onAction };
}
