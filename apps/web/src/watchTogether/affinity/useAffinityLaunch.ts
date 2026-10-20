import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { launchAffinityMatchFor, useResolvePlayTarget } from "@tentacle-tv/api-client";
import type { WtAffinityMatchDto } from "@tentacle-tv/shared";

/**
 * « Regarder ensemble » sur le web : la règle vit dans api-client
 * (`launchAffinityMatchFor`, partagée avec le mobile) ; ici, la navigation —
 * le lecteur, sinon la fiche.
 */
export function useAffinityLaunch(): (match: WtAffinityMatchDto) => Promise<void> {
  const navigate = useNavigate();
  const resolvePlayTarget = useResolvePlayTarget();

  return useCallback(async (match: WtAffinityMatchDto) => {
    const target = await launchAffinityMatchFor(match, resolvePlayTarget);
    navigate("itemId" in target ? `/watch/${target.itemId}` : `/media/${target.detailId}`);
  }, [navigate, resolvePlayTarget]);
}
