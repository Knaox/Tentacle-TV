import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { termeDeRepli, scoreRecherche } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

/**
 * Recherche générale — avec un rattrapage quand la ponctuation fait tout rater.
 *
 * Jellyfin compare le terme au nom de l'élément en ignorant casse et accents,
 * mais **la ponctuation compte au pied de la lettre**. Relevé sur une
 * bibliothèque réelle : 7 résultats pour `Spider-Man`, **0** pour `Spider Man`,
 * **0** pour `spiderman`, et 8 pour `spider`. Normaliser le terme envoyé ne
 * sert donc à rien — seul un mot isolé passe.
 *
 * Le rattrapage est SÉQUENTIEL, et c'est ce qui le rend gratuit : on envoie ce
 * qui a été tapé, et seulement si la réponse est vide, on réessaie avec le mot
 * le plus long avant de reclasser. Une recherche qui aboutissait hier part en
 * une seule requête et ressort intacte, dans l'ordre de Jellyfin — lui connaît
 * la popularité et les titres de tri, nous non.
 *
 * Ce que ça ne résout pas, et il faut le savoir : « spiderman » soudé reste
 * introuvable. Un seul mot ne donne aucune prise, et rien ne permet de deviner
 * où l'utilisateur aurait dû mettre l'espace.
 */
export function useSearchItems(query: string) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const chercher = (terme: string) =>
        client
          .fetch<{ Items: MediaItem[] }>(
            `/Users/${userId}/Items?searchTerm=${encodeURIComponent(terme)}&Recursive=true` +
              `&IncludeItemTypes=Movie,Series&Limit=24&Fields=Overview,PrimaryImageAspectRatio,MediaSources` +
              `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`
          )
          .then((r) => r.Items ?? []);

      const direct = await chercher(query);
      if (direct.length > 0) return direct;

      const repli = termeDeRepli(query);
      if (!repli) return direct;

      return classerResultats(await chercher(repli), query);
    },
    enabled: !!userId && query.length >= 2,
    staleTime: 30 * 1000,
  });
}

/**
 * Reclasse une réponse ÉLARGIE sur la saisie complète.
 *
 * Un mot isolé ramène forcément plus large que demandé : « spider » remonte
 * huit titres là où on en cherchait cinq. Ce qui ne répond pas à la saisie
 * entière est écarté plutôt que relégué en fin de liste — sauf si rien ne
 * répond, auquel cas l'approchant vaut mieux que la page vide qu'on avait.
 */
export function classerResultats(items: MediaItem[], query: string): MediaItem[] {
  const notes = items.map((item, rang) => ({
    item,
    rang,
    score: scoreRecherche(item.Name ?? "", query),
  }));

  const retenus = notes.filter((n) => n.score > 0);
  const liste = retenus.length > 0 ? retenus : notes;

  // `rang` en second critère : à score égal, l'ordre de Jellyfin tranche.
  return liste.sort((a, b) => b.score - a.score || a.rang - b.rang).map((n) => n.item);
}
