import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFamilyLibraries, useSetFamilyLibraries } from "@tentacle-tv/api-client";
import { toggleParentalLibrary } from "@tentacle-tv/tv-core";
import { libraryIcon } from "../nav/useNavCatalog";
import { parentalLibrariesView } from "./parentalModel";
import { useSaveLane, type SaveOutcome } from "./useSaveLane";

/**
 * Les BIBLIOTHÈQUES du contrôle parental simplifié : lues à la demande
 * (`GET /api/family/profiles/:userId/libraries`, seulement si le serveur
 * déclare `family.libraryLimits`), chaque case envoyée aussitôt, la liste
 * ENTIÈRE, une écriture après l'autre. La dernière case cochée ne se décoche
 * pas (tv-core `toggleParentalLibrary`) : la page le dit, rien ne part.
 */
export function useParentalLibraries({ userId, enabled, report, say }: {
  userId: string;
  enabled: boolean;
  report: (outcome: SaveOutcome) => void;
  say: (text: string) => void;
}) {
  const { t } = useTranslation("parentalTv");
  const query = useFamilyLibraries(userId, { enabled });
  const mutation = useSetFamilyLibraries();
  const { mutateAsync } = mutation;
  const send = useCallback((allowed: string[] | null) => mutateAsync({ userId, allowed }), [mutateAsync, userId]);
  const lane = useSaveLane(send, report, query.data);
  const available = query.data?.available;
  const allowed = lane.value !== undefined ? lane.value : (query.data?.allowed ?? null);

  const view = useMemo(
    () => (available ? parentalLibrariesView({ available, allowed, iconOf: libraryIcon, t }) : null),
    [available, allowed, t],
  );
  const { push } = lane;
  const onLibrary = useCallback(
    (id: string) => {
      if (!available) return;
      const next = toggleParentalLibrary(available, allowed, id);
      if (next.kind === "last") say(t("libraries.keepOne"));
      else push(next.allowed);
    },
    [available, allowed, push, say, t],
  );

  return {
    view: enabled ? view : null,
    onLibrary,
    // Lu sur les données (la TV tourne sur react-query v4 : `isLoading` n'y dit pas la même chose).
    loading: enabled && !query.data && !query.error,
    error: enabled ? (query.error ?? null) : null,
    refetch: query.refetch,
  };
}
