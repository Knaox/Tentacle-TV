import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { launchAffinityMatch, useResolvePlayTarget } from "@tentacle-tv/api-client";
import type { MediaItem, WtAffinityMatchDto } from "@tentacle-tv/shared";
import { closeAffinity } from "./affinityStore";

/**
 * « Regarder ensemble » : prévenir la salle (ceux qui swipaient suivront),
 * puis lancer comme partout ailleurs — arriver sur le lecteur d'un autre
 * média le lance pour le groupe (`wt:setItem`). Une série se lit à l'épisode
 * à reprendre de celui qui lance ; terminée, on ouvre sa fiche.
 */
export function useAffinityLaunch(): (match: WtAffinityMatchDto) => Promise<void> {
  const navigate = useNavigate();
  const resolvePlayTarget = useResolvePlayTarget();

  return useCallback(async (match: WtAffinityMatchDto) => {
    // Un serveur muet n'empêche pas de lancer : les autres suivront par la pilule.
    await launchAffinityMatch(match.key).catch(() => undefined);
    const item = { Id: match.itemId, Type: match.mediaType === "tv" ? "Series" : "Movie" } as MediaItem;
    const target = await resolvePlayTarget(item);
    closeAffinity();
    navigate(target ? `/watch/${target}` : `/media/${match.itemId}`);
  }, [navigate, resolvePlayTarget]);
}
