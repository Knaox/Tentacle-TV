import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useLibraries,
  useLibraryPreferences,
  useSetLibraryPreference,
  useDeleteLibraryPreference,
  useSetInterfaceLanguage,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import { Focusable } from "../focus/Focusable";
import { SelectionModal } from "../SelectionModal";
import { TVLibraryPrefCard, type ReglageTv } from "./TVLibraryPrefCard";
import { CLES_LANGUE, CODES_LANGUE, LANGUES_INTERFACE, MODES_SOUS_TITRES } from "../../utils/languageKeys";
import { Colors } from "../../theme/colors";

/**
 * Les réglages de lecture — parité `PlaybackScreenTv` (LG) : la langue de
 * l'interface, puis PAR bibliothèque l'audio, le mode de sous-titres et leur
 * langue, via les hooks partagés de `@tentacle-tv/api-client` (même stockage
 * serveur que le web et la LG). Les `fetch()` bruts, l'état de chargement
 * manuel et la liste locale de 20 langues de l'ancien écran disparaissent —
 * on y gagne les 38 langues et le bouton « Réinitialiser » par bibliothèque.
 */
export function TVSettingsPlaybackSection() {
  const { t, i18n } = useTranslation("preferences");
  const { storage } = useTentacleConfig();
  const { data: bibliotheques } = useLibraries();
  const { data: preferences } = useLibraryPreferences();
  const enregistrer = useSetLibraryPreference();
  const supprimer = useDeleteLibraryPreference();
  const poserLangue = useSetInterfaceLanguage();

  /** Le réglage dont on choisit la valeur, s'il y en a un. */
  const [ouvert, setOuvert] = useState<{ bibliotheque: string; reglage: ReglageTv } | null>(null);

  const langues = useMemo(
    () => CODES_LANGUE.map((code) => ({ value: code, label: t(CLES_LANGUE[code]) })),
    [t],
  );
  const modes = useMemo(
    () => MODES_SOUS_TITRES.map((mode) => ({ value: mode.valeur, label: t(mode.cle) })),
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
      storage.setItem("tentacle_language", code);
      poserLangue.mutate(code);
    },
    [i18n, storage, poserLangue],
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
    <View>
      <Text
        style={{
          color: Colors.textTertiary,
          fontSize: 13,
          fontWeight: "600",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {t("interfaceLanguage")}
      </Text>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 36 }}>
        {LANGUES_INTERFACE.map((langue) => {
          const actif = i18n.language.startsWith(langue.code);
          return (
            <Focusable
              key={langue.code}
              variant="button"
              scaleOverride={1.04}
              onPress={() => changerLangueInterface(langue.code)}
              accessibilityLabel={langue.libelle}
            >
              <View
                style={{
                  minWidth: 160,
                  alignItems: "center",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: actif ? "rgba(139, 92, 246, 0.6)" : Colors.glassBorder,
                  backgroundColor: actif ? "rgba(139, 92, 246, 0.18)" : "transparent",
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    color: actif ? Colors.accentPurpleLight : Colors.textPrimary,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  {langue.libelle}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </View>

      <View style={{ gap: 20 }}>
        {(bibliotheques ?? []).map((bibliotheque) => {
          const pref = preferences?.find((entree) => entree.libraryId === bibliotheque.Id);
          const reglages: ReglageTv[] = [
            {
              cle: "audio",
              intitule: t("audio"),
              valeur: nommerLangue(pref?.audioLang, t("default")),
              choix: [{ value: "", label: t("default") }, ...langues],
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
              choix: [{ value: "", label: t("none") }, ...langues],
              selection: pref?.subtitleLang ?? "",
            },
          ];

          return (
            <TVLibraryPrefCard
              key={bibliotheque.Id}
              nom={bibliotheque.Name}
              reglages={reglages}
              personnalisee={!!pref}
              onOuvrir={(reglage) => setOuvert({ bibliotheque: bibliotheque.Id, reglage })}
              onReinitialiser={() => supprimer.mutate(bibliotheque.Id)}
            />
          );
        })}
      </View>

      {ouvert && (
        <SelectionModal
          title={ouvert.reglage.intitule}
          options={ouvert.reglage.choix}
          selectedValue={ouvert.reglage.selection}
          onSelect={appliquer}
          onClose={() => setOuvert(null)}
        />
      )}
    </View>
  );
}
