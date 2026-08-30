/**
 * L'échec d'UNE rangée — dit, plutôt que masqué.
 *
 * Une requête de rangée en erreur rendait `null` : le rail disparaissait en
 * entier, en-tête compris, et rien ne distinguait « cette bibliothèque n'a rien
 * de récent » de « la requête est tombée ». L'utilisateur voyait une
 * bibliothèque manquer à l'appel sans savoir qu'il y avait quelque chose à
 * réessayer — et un rechargement de page était le seul geste possible, à
 * l'aveugle.
 *
 * ⚠️ La retenue est la moitié du travail. Ceci se répète PAR BIBLIOTHÈQUE :
 * l'accueil en aligne autant que le serveur en déclare, et une panne les fait
 * toutes tomber ensemble. D'où deux règles :
 *
 *  - hors ligne, on se TAIT (`useServerReachable`) : `OfflineBanner` porte déjà
 *    le message, et cinq encarts qui répètent la même panne sous cinq titres
 *    différents transforment un incident unique en désordre. C'est la règle que
 *    `ContentErrorState` s'applique déjà, pour la même raison ;
 *  - le bouton relance CETTE requête, pas toutes les requêtes actives : chaque
 *    rangée se répare seule, sans emporter le reste de la page dans son échec.
 *
 * L'encart reste discret — la surface tranquille du dépôt (`fill-subtle` sur
 * `line-subtle`), la même que `ContentErrorState`. PAS de `backdrop-filter` :
 * il n'y a rien derrière que le fond de la page, un flou n'y flouterait rien et
 * coûterait une couche composée (règle du dépôt, § coût GPU).
 */

import { useTranslation } from "react-i18next";
import { RowHeader } from "./RowHeader";
import { useServerReachable } from "../../hooks/useServerReachable";

interface RowErrorStateProps {
  /** Le titre qu'aurait porté la rangée — elle garde sa place et son nom. */
  title: string;
  /** Une nouvelle tentative est-elle en cours ? (l'`isFetching` de la requête). */
  retrying: boolean;
  /** Relance la requête de CETTE rangée. */
  onRetry: () => void;
}

export function RowErrorState({ title, retrying, onRetry }: RowErrorStateProps) {
  const { t } = useTranslation("common");
  const { isReachable } = useServerReachable();

  // Hors ligne : la bannière parle pour tout le monde (voir l'en-tête). On
  // retombe alors sur le comportement d'avant — la rangée s'efface.
  if (!isReachable) return null;

  return (
    // `group/row` : `RowHeader` étire son rail de marque au survol de la
    // rangée, et l'attend sur un ancêtre nommé.
    <section className="group/row mb-10" role="status">
      <RowHeader title={title} />
      <div className="row-gutter mt-3">
        <div className="flex max-w-xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line-subtle bg-fill-subtle px-4 py-3">
          <p className="text-sm text-content-tertiary">{t("common:rowErrorMessage")}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="ml-auto inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-fill-subtle px-4 text-sm font-semibold text-content-primary transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {retrying ? t("common:retrying") : t("common:retry")}
          </button>
        </div>
      </div>
    </section>
  );
}
