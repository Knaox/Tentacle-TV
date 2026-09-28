import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { launchAffinityMatch, useResolvePlayTarget } from "@tentacle-tv/api-client";
import type { MediaItem, WtAffinityMatchDto } from "@tentacle-tv/shared";
import { closeAffinity } from "./affinityStore";

/**
 * « Regarder ensemble » : le serveur d'abord — il referme la séance chez
 * tous, et ceux qui swipaient suivront —, puis lancer comme partout ailleurs :
 * arriver sur le lecteur d'un autre média le lance pour le groupe
 * (`wt:setItem`). Une série se lit à l'épisode à reprendre de celui qui
 * lance ; terminée, on ouvre sa fiche.
 *
 * Le serveur refuse (code `answered`) si quelqu'un a répondu avant : rien ne
 * part alors, l'erreur remonte à l'appelant — sinon deux membres pourraient
 * partir chacun de leur côté.
 */
export function useAffinityLaunch(): (match: WtAffinityMatchDto) => Promise<void> {
  const navigate = useNavigate();
  const resolvePlayTarget = useResolvePlayTarget();

  return useCallback(async (match: WtAffinityMatchDto) => {
    await launchAffinityMatch(match.key);
    const item = { Id: match.itemId, Type: match.mediaType === "tv" ? "Series" : "Movie" } as MediaItem;
    // Le serveur a dit oui : la séance est refermée chez tous, on part —
    // au pire sur la fiche.
    const target = await resolvePlayTarget(item).catch(() => null);
    closeAffinity();
    navigate(target ? `/watch/${target}` : `/media/${match.itemId}`);
  }, [navigate, resolvePlayTarget]);
}
