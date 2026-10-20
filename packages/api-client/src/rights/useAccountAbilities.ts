import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_ABILITIES_PATH, parseAccountAbilities } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapabilities } from "../hooks/useServerCapabilities";
import { useUserId } from "../hooks/useUserId";
import type { AccountAbilitiesState } from "./accountAbilitiesGate";

export const ACCOUNT_ABILITIES_KEY = "account-abilities";

/**
 * Ce que la session peut faire (`GET /api/account/abilities`, capacité
 * `account.abilities`) — une seule requête par identité, relue à
 * `rights:changed` (`useRightsLive`) comme toute requête affichée. Les écrans
 * la lisent par `mayShow` / `watchTogetherAbility`.
 */
export function useAccountAbilities(): AccountAbilitiesState {
  const { capabilities, settled } = useServerCapabilities();
  const capable = capabilities.has("account.abilities");
  const userId = useUserId();
  const query = useQuery({
    queryKey: [ACCOUNT_ABILITIES_KEY, userId],
    queryFn: async () => parseAccountAbilities(await tentacleApiFetch<unknown>(ACCOUNT_ABILITIES_PATH)),
    enabled: capable && !!userId,
    staleTime: 60_000,
    retry: 1,
  });
  if (!settled) return { kind: "pending" };
  if (!capable) return { kind: "legacy" };
  return query.data ? { kind: "known", abilities: query.data } : { kind: "pending" };
}
