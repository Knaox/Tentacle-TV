import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useLibraryPreferences,
  useSetLibraryPreference,
  useDeleteLibraryPreference,
  useSetInterfaceLanguage,
} from "@tentacle-tv/api-client";
import { CarteBibliothequeTv, type ReglageTv } from "./CarteBibliothequeTv";
import { PanneauChoixTv, type ChoixTv } from "./PanneauChoixTv";
import { CLES_LANGUE, CODES_LANGUE, LANGUES_INTERFACE, MODES_SOUS_TITRES } from "./languesTv";

/**
 * Les réglages de lecture, pilotables à la télécommande.
 *
 * Substitué à `apps/web/src/pages/Preferences.tsx`, dont il reprend les données
 * — les hooks partagés de `@tentacle-tv/api-client`, donc le même stockage
 * serveur — et dont il abandonne la mise en page : six `<select>` natifs et un
 * bouton « Modifier » par bibliothèque supposent une souris.
 *
 * Ce qui est parti avec, et pourquoi. Le **mode hors ligne** : un téléviseur ne
 * passe pas hors ligne, il s'éteint ; tout le graphe `offline/` reste donc hors
 * du bundle, ce qui vaut mieux qu'un cache local que personne ne relira.
 * **`HdrAutoToggle`** : il ne se montre que sur Windows avec mpv, et rend `null`
 * partout ailleurs. Le **bouton Modifier** : sur une dalle, un réglage
 * s'applique quand on le choisit — un mode édition demanderait un aller-retour
 * de plus pour chaque changement.
 *
 * Les préférences par CONTENU (`item_track_preferences`) ne sont pas ici : elles
 * se posent depuis le lecteur, sur le titre qu'on regarde, et c'est le seul
 * endroit où elles ont un sens.
 */

export function EcranLectureTv() {
  const { t, i18n } = useTranslation("preferences");
  const { data: bibliotheques } = useLibraries();
  const { data: preferences } = useLibraryPreferences();
  const enregistrer = useSetLibraryPreference();
  const supprimer = useDeleteLibraryPreference();
  const poserLangue = useSetInterfaceLanguage();

  /** Le réglage dont on est en train de choisir la valeur, s'il y en a un. */
  const [ouvert, setOuvert] = useState<{ bibliotheque: string; reglage: ReglageTv } | null>(null);

  const langues = useMemo<ChoixTv[]>(
    () => CODES_LANGUE.map((code) => ({ valeur: code, libelle: t(CLES_LANGUE[code]) })),
    [t],
  );
  const modes = useMemo<ChoixTv[]>(
    () => MODES_SOUS_TITRES.map((mode) => ({ valeur: mode.valeur, libelle: t(mode.cle) })),
    [t],
  );

  const nommerLangue = useCallback(
    (code: string | null | undefined, vide: string) =>
      code ? (CLES_LANGUE[code] ? t(CLES_LANGUE[code]) : code) : vide,
    [t],
  );

  const changerLangueInterface = useCallback(
    (code: string) => {
      i18n.changeLanguage(code);
      localStorage.setItem("tentacle_language", code);
      poserLangue.mutate(code);
    },
    [i18n, poserLangue],
  );

  const appliquer = useCallback(
    (valeur: string) => {
      if (!ouvert) return;
      const actuelle = preferences?.find((pref) => pref.libraryId === ouvert.bibliotheque);
      // Une valeur vide efface le réglage sans effacer les deux autres : le
      // backend fait un upsert du trio, pas une fusion champ par champ.
      enregistrer.mutate({
        libraryId: ouvert.bibliotheque,
        audioLang: ouvert.reglage.cle === "audio" ? valeur || null : (actuelle?.audioLang ?? null),
        subtitleLang:
          ouvert.reglage.cle === "sousTitres" ? valeur || null : (actuelle?.subtitleLang ?? null),
        subtitleMode:
          ouvert.reglage.cle === "mode"
            ? (valeur as "none" | "always" | "forced" | "signs")
            : (actuelle?.subtitleMode ?? "none"),
      });
      setOuvert(null);
    },
    [enregistrer, ouvert, preferences],
  );

  return (
    <div>
      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-content-tertiary">
          {t("interfaceLanguage")}
        </h2>
        <div className="flex gap-4">
          {LANGUES_INTERFACE.map((langue) => (
            <button
              key={langue.code}
              type="button"
              className="bouton-reglage-tv"
              data-actif={i18n.language.startsWith(langue.code)}
              onClick={() => changerLangueInterface(langue.code)}
            >
              <span className="bouton-reglage-tv-valeur">{langue.libelle}</span>
            </button>
          ))}
        </div>
      </section>

      {(bibliotheques ?? []).map((bibliotheque) => {
        const pref = preferences?.find((entree) => entree.libraryId === bibliotheque.Id);
        const reglages: ReglageTv[] = [
          {
            cle: "audio",
            intitule: t("audio"),
            valeur: nommerLangue(pref?.audioLang, t("default")),
            choix: [{ valeur: "", libelle: t("default") }, ...langues],
            selection: pref?.audioLang ?? "",
          },
          {
            cle: "mode",
            intitule: t("subtitleMode"),
            valeur: t(
              MODES_SOUS_TITRES.find((mode) => mode.valeur === (pref?.subtitleMode ?? "none"))!.cle,
            ),
            choix: modes,
            selection: pref?.subtitleMode ?? "none",
          },
          {
            cle: "sousTitres",
            intitule: t("subtitles"),
            valeur: nommerLangue(pref?.subtitleLang, t("none")),
            choix: [{ valeur: "", libelle: t("none") }, ...langues],
            selection: pref?.subtitleLang ?? "",
          },
        ];

        return (
          <section key={bibliotheque.Id} className="mb-6">
            <CarteBibliothequeTv
              nom={bibliotheque.Name}
              reglages={reglages}
              personnalisee={!!pref}
              onOuvrir={(reglage) => setOuvert({ bibliotheque: bibliotheque.Id, reglage })}
              onReinitialiser={() => supprimer.mutate(bibliotheque.Id)}
            />
          </section>
        );
      })}

      {ouvert && (
        <PanneauChoixTv
          titre={ouvert.reglage.intitule}
          choix={ouvert.reglage.choix}
          selection={ouvert.reglage.selection}
          onChoisir={appliquer}
          onFermer={() => setOuvert(null)}
        />
      )}
    </div>
  );
}

export default EcranLectureTv;
