import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSearchItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { pushRecentSearch, readRecentSearches } from "@/components/search/recentSearches";
import { inscrireRetour } from "../../focus/retour";
import { fermerRecherche, useRechercheOuverte } from "./etatRecherche";
import { CarteResultatTv } from "./CarteResultatTv";

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

const DELAI_FRAPPE_MS = 350;
const LONGUEUR_MINIMALE = 2;
const RESULTATS_MAX = 24;

function surTeleviseur(): boolean {
  return typeof (window as unknown as { PalmSystem?: unknown }).PalmSystem !== "undefined";
}

export function EcranRechercheTv() {
  const ouverte = useRechercheOuverte();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const champ = useRef<HTMLInputElement>(null);

  const [saisie, setSaisie] = useState("");
  const [requete, setRequete] = useState("");
  const [recentes, setRecentes] = useState<string[]>([]);

  useEffect(() => {
    const identifiant = setTimeout(() => setRequete(saisie.trim()), DELAI_FRAPPE_MS);
    return () => clearTimeout(identifiant);
  }, [saisie]);

  // Le focus du champ EST l'ouverture du clavier système : il ne doit pas
  // attendre un appui de plus. Le report d'un tour de boucle laisse le temps au
  // portail d'être peint — un `focus()` sur un élément pas encore composé est
  // ignoré par WebKit comme par Blink.
  useEffect(() => {
    if (!ouverte) {
      setSaisie("");
      setRequete("");
      return;
    }
    setRecentes(readRecentSearches());
    const identifiant = setTimeout(() => champ.current?.focus(), 60);
    return () => clearTimeout(identifiant);
  }, [ouverte]);

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
  const fermer = useCallback(() => {
    champ.current?.blur();
    return fermerRecherche();
  }, []);

  // La touche Retour ferme la recherche avant de reculer d'un écran.
  useEffect(() => inscrireRetour(() => fermer()), [fermer]);

  /**
   * Rouvrir le clavier système, et pourquoi ce n'est pas un simple `focus()`.
   *
   * webOS referme son clavier SANS retirer le focus du champ — le guide
   * l'affirme, et l'émulateur webOS 4 le confirme : `keyboardStateChange` passe
   * à faux, `document.activeElement` reste l'`<input>`. Or le clavier ne monte
   * que sur une TRANSITION de focus. Rappeler `focus()` sur l'élément qui est
   * déjà actif ne produit aucun événement et ne rouvre donc rien : mesuré, le
   * compteur d'événements clavier ne bouge pas d'un cran.
   *
   * Il faut sortir du champ pour y revenir. Le `blur()` est reporté d'un tour de
   * boucle avant le `focus()`, faute de quoi les deux se compensent dans la même
   * tâche et la transition n'a pas lieu.
   */
  const rouvrirClavier = useCallback(() => {
    const element = champ.current;
    if (!element) return;
    if (document.activeElement !== element) {
      element.focus();
      return;
    }
    element.blur();
    setTimeout(() => champ.current?.focus(), 0);
  }, []);

  const { data: resultats, isLoading } = useSearchItems(requete);
  const visibles = resultats?.slice(0, RESULTATS_MAX) ?? [];

  const ouvrir = useCallback(
    (item: MediaItem) => {
      // Mémorisée à la SÉLECTION, pas à la frappe : une requête abandonnée en
      // route n'a rien donné, la ressortir en suggestion serait un mauvais
      // conseil.
      pushRecentSearch(requete);
      fermer();
      navigate(`/media/${item.Id}`);
    },
    [navigate, requete, fermer],
  );

  if (!ouverte) return null;

  const attente = requete.length < LONGUEUR_MINIMALE;

  return (
    <div className="recherche-tv" role="dialog" aria-label={t("common:searchPlaceholder")}>
      <div className="recherche-tv-entete">
        <input
          ref={champ}
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          // OK sur le champ rouvre le clavier. Le moteur de focus active une
          // cible par un `click()` : c'est donc ici qu'arrive l'appui, qu'on
          // vienne du rail ou qu'on remonte depuis les résultats.
          onClick={rouvrirClavier}
          placeholder={t("common:searchMediaLong")}
          className="recherche-tv-champ"
          aria-label={t("common:searchMediaLong")}
        />
        {surTeleviseur() && <p className="recherche-tv-indice">{t("common:rechercheTvDictee")}</p>}
      </div>

      <div className="recherche-tv-corps">
        {attente && recentes.length > 0 && (
          <ul className="recherche-tv-recentes">
            {recentes.map((recente) => (
              <li key={recente}>
                <button
                  type="button"
                  className="recherche-tv-recente"
                  onClick={() => {
                    setSaisie(recente);
                    setRequete(recente);
                  }}
                >
                  {recente}
                </button>
              </li>
            ))}
          </ul>
        )}

        {attente && recentes.length === 0 && (
          <p className="recherche-tv-message">{t("common:rechercheTvVide")}</p>
        )}

        {!attente && isLoading && <p className="recherche-tv-message">{t("common:loading")}</p>}

        {!attente && !isLoading && visibles.length === 0 && (
          <p className="recherche-tv-message">{t("common:noResults")}</p>
        )}

        {!attente && visibles.length > 0 && (
          <ul className="recherche-tv-grille">
            {visibles.map((item) => (
              <CarteResultatTv key={item.Id} item={item} onOuvrir={ouvrir} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
