import { useQuery } from "@tanstack/react-query";
import { isOutdatedLinksServer, serverLinksApi } from "./serverLinksApi";

/**
 * Les liens enregistrés, sondés par le serveur. Une minute de fraîcheur :
 * chaque lecture coûte jusqu'à trois requêtes sortantes au serveur, et
 * « Revérifier » les refait à la demande. Ce que la page « Services »
 * enregistre invalide cette clé.
 */
export const SERVER_LINKS_KEY = ["admin", "server-links"] as const;

export function useServerLinks() {
  return useQuery({
    queryKey: SERVER_LINKS_KEY,
    queryFn: () => serverLinksApi.report(),
    staleTime: 60_000,
    // Un serveur trop ancien ne répondra pas mieux la seconde fois.
    retry: (count, error) => !isOutdatedLinksServer(error) && count < 1,
  });
}
