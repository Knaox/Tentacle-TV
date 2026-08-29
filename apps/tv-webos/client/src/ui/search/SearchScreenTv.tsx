import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSearchItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { pushRecentSearch, readRecentSearches } from "@/components/search/recentSearches";
import { registerBack } from "../../focus/back";
import { closeSearch, useSearchOpen } from "./searchState";
import { ResultCardTv } from "./ResultCardTv";

/**
 * L'écran de recherche du téléviseur.
 *
 * **Rien n'est codé pour le clavier.** webOS ouvre le sien dès qu'un `<input>`
 * reçoit le focus, et le referme à la validation ; c'est aussi ce clavier qui
 * porte le bouton micro de la Magic Remote. Écrire une grille de lettres
 * reviendrait à réimplémenter en moins bien ce que la plateforme fournit — et
 * à perdre la dictée au passage.
 *
 * Sur le micro, précisément : `com.webos.service.tts` est de la SYNTHÈSE
 * vocale, pas de la reconnaissance, et webOS n'expose aucune API de
 * reconnaissance aux applications tierces. Le clavier système est donc le seul
 * chemin de dictée — le même verdict que sur tvOS. L'indice ne s'affiche que
 * sur une vraie dalle : au navigateur, il désignerait un bouton qui n'existe
 * pas.
 *
 * Une surcouche et non une route : `App.tsx` n'est pas modifié, et le client
 * web ne fait pas autrement. La fermeture passe par la pile de la touche
 * Retour, avant `history.back()` — sans quoi Retour quitterait l'écran
 * d'arrière-plan au lieu de refermer ce qui est devant.
 */

const TYPING_DELAY_MS = 350;
const MIN_LENGTH = 2;
const MAX_RESULTS = 24;

/**
 * Délai de grâce avant de rendre la main à la barre quand le clavier se retire.
 *
 * La dictée fait passer `visibility` par faux AVANT de revenir à vrai — le
 * clavier s'efface pendant que l'interface vocale s'affiche. Rendre le focus
 * sur-le-champ casserait la saisie vocale, la seule que cette plateforme offre.
 */
const BAR_RETURN_DELAY_MS = 450;

function onTv(): boolean {
  return typeof (window as unknown as { PalmSystem?: unknown }).PalmSystem !== "undefined";
}

export function SearchScreenTv() {
  const opened = useSearchOpen();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  // Deux éléments là où il n'y en avait qu'un, et c'est tout le correctif.
  //
  // Sur webOS, focaliser un `<input>` fait monter le clavier système — le guide
  // l'affirme, et l'application n'a aucun moyen de s'y opposer. Tant que la
  // barre de recherche ÉTAIT ce champ, la simple navigation au D-pad ouvrait un
  // clavier plein écran que personne n'avait demandé, et le moteur de focus se
  // suspendait dans la foulée.
  //
  // La barre est donc un bouton — focalisable, jamais éditable — et le champ
  // véritable est retiré du parcours (`tabIndex={-1}`) et posé par-dessus, à
  // l'identique mais transparent. Le clavier ne monte plus qu'au geste explicite
  // qui le demande : OK sur la barre.
  const barre = useRef<HTMLButtonElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    const identifier = setTimeout(() => setQuery(input.trim()), TYPING_DELAY_MS);
    return () => clearTimeout(identifier);
  }, [input]);

  // L'entrée se pose sur la BARRE, jamais sur le champ.
  //
  // Ouvrir la recherche ne doit pas ouvrir le clavier : on arrive souvent ici
  // pour reprendre une recherche récente, ou simplement pour lire ce qu'on avait
  // tapé. Un clavier plein écran qu'il faut refermer avant de voir l'écran est
  // un péage, pas un service. Le report d'un tour de boucle laisse le temps au
  // portail d'être peint — un `focus()` sur un élément pas encore composé est
  // ignoré par WebKit comme par Blink.
  useEffect(() => {
    if (!opened) {
      setInput("");
      setQuery("");
      return;
    }
    setRecents(readRecentSearches());
    const identifier = setTimeout(() => barre.current?.focus(), 60);
    return () => clearTimeout(identifier);
  }, [opened]);

  /**
   * Fermer, et faire redescendre le clavier avec.
   *
   * Le champ est démonté par le rendu suivant, et l'on aurait pu croire que
   * cela suffisait : un élément qui disparaît perd le focus, et le clavier
   * n'aurait plus de raison d'être. Mesuré sur le Simulator webOS 26, non — le
   * clavier reste à l'écran par-dessus l'accueil, sans champ où écrire, et rien
   * ne l'en fait partir.
   *
   * Le `blur()` est donc explicite, et il vient AVANT la fermeture : après, la
   * référence est déjà vide.
   */
  const close = useCallback(() => {
    champ.current?.blur();
    return closeSearch();
  }, []);

  // La touche Retour ferme la recherche avant de reculer d'un écran.
  useEffect(() => registerBack(() => close()), [close]);

  /**
   * OK sur la barre : c'est LE geste qui ouvre le clavier, et le seul.
   *
   * Donner le focus au champ suffit — c'est précisément ce que webOS interprète
   * comme une demande de saisie. La barre n'étant pas éditable, aucun autre
   * chemin n'y mène : ni la navigation au D-pad, ni l'entrée dans l'écran, ni
   * une restitution de focus automatique.
   *
   * Idempotent par construction : si le champ a déjà le focus, le clavier est
   * déjà là et il n'y a rien à faire. C'est le cas que l'ancienne version ne
   * savait pas traiter — un `focus()` sur l'élément déjà actif ne produit aucune
   * transition, donc ne rouvre rien.
   */
  const openKeyboard = useCallback(() => {
    champ.current?.focus();
  }, []);

  /**
   * Le clavier se retire : la barre reprend le focus.
   *
   * Sans cela, le focus resterait sur un champ invisible et hors du parcours du
   * D-pad — l'anneau disparaîtrait et plus aucune flèche n'aurait de point de
   * départ. On rend donc la main à la barre, qui est la représentation visible
   * de ce champ.
   *
   * Le délai n'est pas un confort : la dictée fait passer `visibility` par faux
   * avant de revenir à vrai, et rendre le focus sur-le-champ interromprait la
   * saisie vocale. Un retour à vrai dans l'intervalle annule le retour.
   */
  useEffect(() => {
    if (!opened) return;
    let back: ReturnType<typeof setTimeout> | undefined;
    const surClavier = (event: Event) => {
      const detail = (event as CustomEvent<{ visibility?: boolean }>).detail;
      if (detail?.visibility === true) {
        clearTimeout(back);
        return;
      }
      back = setTimeout(() => {
        if (document.activeElement === champ.current) barre.current?.focus();
      }, BAR_RETURN_DELAY_MS);
    };
    document.addEventListener("keyboardStateChange", surClavier);
    return () => {
      document.removeEventListener("keyboardStateChange", surClavier);
      clearTimeout(back);
    };
  }, [opened]);

  const { data: results, isLoading } = useSearchItems(query);
  const visible2 = results?.slice(0, MAX_RESULTS) ?? [];

  const open2 = useCallback(
    (item: MediaItem) => {
      // Mémorisée à la SÉLECTION, pas à la frappe : une requête abandonnée en
      // route n'a rien donné, la ressortir en suggestion serait un mauvais
      // conseil.
      pushRecentSearch(query);
      close();
      navigate(`/media/${item.Id}`);
    },
    [navigate, query, close],
  );

  if (!opened) return null;

  const wait = query.length < MIN_LENGTH;

  return (
    <div className="recherche-tv" role="dialog" aria-label={t("common:searchPlaceholder")}>
      <div className="recherche-tv-entete">
        <div className="recherche-tv-barre">
          {/* La cible du D-pad. Un bouton, donc rien que webOS puisse prendre
              pour une demande de saisie — c'est ce qui garde le clavier fermé
              tant qu'on ne l'a pas demandé. Le moteur de focus active une cible
              par un `click()` : c'est ici qu'arrive l'appui sur OK. */}
          <button
            ref={barre}
            type="button"
            className="recherche-tv-champ"
            onClick={openKeyboard}
            aria-label={t("common:searchMediaLong")}
          >
            {input || (
              <span className="recherche-tv-invite">{t("common:searchMediaLong")}</span>
            )}
          </button>
          {/* Le champ véritable, posé par-dessus la barre et transparent. Il
              porte la saisie et reçoit la dictée ; `tabIndex={-1}` le retire du
              recensement du moteur, donc aucune flèche ne peut l'atteindre. */}
          <input
            ref={champ}
            tabIndex={-1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="recherche-tv-saisie"
            aria-hidden="true"
          />
        </div>
        {onTv() && <p className="recherche-tv-indice">{t("common:rechercheTvDictee")}</p>}
      </div>

      <div className="recherche-tv-corps">
        {wait && recents.length > 0 && (
          <ul className="recherche-tv-recentes">
            {recents.map((recent) => (
              <li key={recent}>
                <button
                  type="button"
                  className="recherche-tv-recente"
                  onClick={() => {
                    setInput(recent);
                    setQuery(recent);
                  }}
                >
                  {recent}
                </button>
              </li>
            ))}
          </ul>
        )}

        {wait && recents.length === 0 && (
          <p className="recherche-tv-message">{t("common:rechercheTvVide")}</p>
        )}

        {!wait && isLoading && <p className="recherche-tv-message">{t("common:loading")}</p>}

        {!wait && !isLoading && visible2.length === 0 && (
          <p className="recherche-tv-message">{t("common:noResults")}</p>
        )}

        {!wait && visible2.length > 0 && (
          <ul className="recherche-tv-grille">
            {visible2.map((item) => (
              <ResultCardTv key={item.Id} item={item} onOpen={open2} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
