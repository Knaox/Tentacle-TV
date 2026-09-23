/**
 * Ce que l'omnibox DIT, au-dessus de ses résultats : l'orthographe qu'elle a
 * cherchée à la place (« Résultats pour harry potter »), l'absence de
 * résultat — jamais un simple « 0 » —, un résultat partiel, un index qui se
 * prépare, et, barre vide sans historique, une invitation.
 *
 * Le squelette est STATIQUE : il ne vit que le temps d'une première réponse,
 * quelques dizaines de millisecondes ; un scintillement n'y aurait rien à
 * dire (CLAUDE.md, « Coût GPU »).
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchResponse } from "@tentacle-tv/shared";

interface OmniboxNoticeProps {
  query: string;
  response: SearchResponse | undefined;
  current: boolean;
  pending: boolean;
  /** Aucune option hors « tous les résultats ». */
  empty: boolean;
  /** Un plugin cherche encore hors bibliothèque. */
  externalPending?: boolean;
  onPick: (query: string) => void;
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1.5 p-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <span className="h-[54px] w-9 rounded-md bg-fill-soft" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 rounded bg-fill-soft" style={{ width: `${60 - i * 12}%` }} />
            <span className="h-2.5 w-1/3 rounded bg-fill-subtle" />
          </span>
        </div>
      ))}
    </div>
  );
}

export const OmniboxNotice = memo(function OmniboxNotice({ query, response, current, pending, empty, externalPending = false, onPick }: OmniboxNoticeProps) {
  const { t } = useTranslation("search");
  const trimmed = query.trim();

  if (trimmed === "") {
    if (!empty) return null;
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-base font-semibold text-content-primary">{t("emptyTitle")}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-content-tertiary">{t("emptyHint")}</p>
      </div>
    );
  }
  if (pending) return <Skeleton />;
  if (response === undefined) return null;

  if (current && empty && externalPending) {
    // Rien dans la bibliothèque, mais un plugin cherche encore ailleurs.
    return (
      <div role="status">
        <p className="px-3 pb-1 pt-2 text-[13px] text-content-tertiary">{t("externalSearching")}</p>
        <Skeleton />
      </div>
    );
  }

  if (current && empty) {
    return (
      <div className="px-6 py-8 text-center" role="status">
        <p className="text-base font-semibold text-content-primary">{t("noResults", { query: trimmed })}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-content-tertiary">{t("noResultsHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-3 pb-1 pt-1.5 text-[13px]" role="status">
      {!response.ready && <p className="text-content-tertiary">{t("indexing")}</p>}
      {response.correction !== null && (
        <p className="text-content-tertiary">
          {t("resultsFor")}{" "}
          <button type="button" tabIndex={-1} onClick={() => onPick(response.correction ?? "")} className="font-semibold italic text-[var(--brand-light)] hover:underline">
            {response.correction}
          </button>
        </p>
      )}
      {response.partial && <p className="text-content-tertiary">{t("partial")}</p>}
    </div>
  );
});
