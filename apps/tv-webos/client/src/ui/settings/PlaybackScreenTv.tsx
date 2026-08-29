import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useLibraryPreferences,
  useSetLibraryPreference,
  useDeleteLibraryPreference,
  useSetInterfaceLanguage,
} from "@tentacle-tv/api-client";
import { LibraryCardTv, type SettingTv } from "./LibraryCardTv";
import { ChoicePanelTv, type ChoiceTv } from "./ChoicePanelTv";
import { LANGUAGE_KEYS, LANGUAGE_CODES, INTERFACE_LANGUAGES, SUBTITLE_MODES } from "./languagesTv";
import { PlaybackSettingsTv } from "./PlaybackSettingsTv";

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

export function PlaybackScreenTv() {
  const { t, i18n } = useTranslation("preferences");
  const { data: libraries } = useLibraries();
  const { data: preferences } = useLibraryPreferences();
  const save = useSetLibraryPreference();
  const remove2 = useDeleteLibraryPreference();
  const poserLangue = useSetInterfaceLanguage();

  /** Le réglage dont on est en train de choisir la valeur, s'il y en a un. */
  const [open, setOpen] = useState<{ library: string; setting: SettingTv } | null>(null);

  const languages = useMemo<ChoiceTv[]>(
    () => LANGUAGE_CODES.map((code) => ({ value: code, label: t(LANGUAGE_KEYS[code]) })),
    [t],
  );
  const modes = useMemo<ChoiceTv[]>(
    () => SUBTITLE_MODES.map((mode) => ({ value: mode.value, label: t(mode.key) })),
    [t],
  );

  const languageName = useCallback(
    (code: string | null | undefined, vide: string) =>
      code ? (LANGUAGE_KEYS[code] ? t(LANGUAGE_KEYS[code]) : code) : vide,
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

  const apply = useCallback(
    (value: string) => {
      if (!open) return;
      const current2 = preferences?.find((pref) => pref.libraryId === open.library);
      // Une valeur vide efface le réglage sans effacer les deux autres : le
      // backend fait un upsert du trio, pas une fusion champ par champ.
      save.mutate({
        libraryId: open.library,
        audioLang: open.setting.key === "audio" ? value || null : (current2?.audioLang ?? null),
        subtitleLang:
          open.setting.key === "sousTitres" ? value || null : (current2?.subtitleLang ?? null),
        subtitleMode:
          open.setting.key === "mode"
            ? (value as "none" | "always" | "forced" | "signs")
            : (current2?.subtitleMode ?? "none"),
      });
      setOpen(null);
    },
    [save, open, preferences],
  );

  return (
    <div>
      {/* Ce que le lecteur a le droit de faire tout seul — saut d'intro et fin
          d'épisode. Extrait pour le budget de 300 lignes. */}
      <PlaybackSettingsTv />

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-content-tertiary">
          {t("interfaceLanguage")}
        </h2>
        <div className="flex gap-4">
          {INTERFACE_LANGUAGES.map((langue) => (
            <button
              key={langue.code}
              type="button"
              className="bouton-reglage-tv"
              data-active={i18n.language.startsWith(langue.code)}
              onClick={() => changerLangueInterface(langue.code)}
            >
              <span className="bouton-reglage-tv-valeur">{langue.label}</span>
            </button>
          ))}
        </div>
      </section>

      {(libraries ?? []).map((library) => {
        const pref = preferences?.find((entree) => entree.libraryId === library.Id);
        const settings: SettingTv[] = [
          {
            key: "audio",
            intitule: t("audio"),
            value: languageName(pref?.audioLang, t("default")),
            choice: [{ value: "", label: t("default") }, ...languages],
            selection: pref?.audioLang ?? "",
          },
          {
            key: "mode",
            intitule: t("subtitleMode"),
            value: t(
              SUBTITLE_MODES.find((mode) => mode.value === (pref?.subtitleMode ?? "none"))!.key,
            ),
            choice: modes,
            selection: pref?.subtitleMode ?? "none",
          },
          {
            key: "sousTitres",
            intitule: t("subtitles"),
            value: languageName(pref?.subtitleLang, t("none")),
            choice: [{ value: "", label: t("none") }, ...languages],
            selection: pref?.subtitleLang ?? "",
          },
        ];

        return (
          <section key={library.Id} className="mb-6">
            <LibraryCardTv
              nom={library.Name}
              settings={settings}
              custom={!!pref}
              onOpen={(setting) => setOpen({ library: library.Id, setting })}
              onReset={() => remove2.mutate(library.Id)}
            />
          </section>
        );
      })}

      {open && (
        <ChoicePanelTv
          title={open.setting.intitule}
          choice={open.setting.choice}
          selection={open.setting.selection}
          onChoose={apply}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

export default PlaybackScreenTv;
