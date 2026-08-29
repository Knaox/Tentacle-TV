import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import type { SegmentAction, SegmentSettings } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Bouton } from "../../theme/boutons";

/**
 * Ce que le lecteur a le droit de faire tout seul, à la télécommande.
 *
 * Pas d'interrupteur à glissière : il n'en existe aucun dans l'application, et
 * un pouce qui coulisse ne veut rien dire sans doigt pour le pousser. Des
 * boutons, comme la langue d'interface juste en dessous — celui qui est actif
 * se cerne de la teinte de marque.
 *
 * Les réglages viennent du magasin de COMPTE, le même que lisent les surcouches
 * du lecteur : un choix posé ici vaut sur le téléphone, et réciproquement. Le
 * DÉLAI du saut automatique n'est pas offert ici, à dessein — saisir un nombre
 * à la télécommande est une punition, et le réglage suit le compte.
 */

interface Choix {
  valeur: string;
  libelle: string;
}

function BlocReglage({ titre, aide, valeur, choix, onChoisir }: {
  titre: string;
  aide: string;
  valeur: string;
  choix: Choix[];
  onChoisir: (valeur: string) => void;
}) {
  return (
    <View style={{ marginBottom: 36 }}>
      <Text style={{
        color: Colors.textTertiary, fontSize: 13, fontWeight: "600",
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
      }}>
        {titre}
      </Text>
      <Text style={{
        color: Colors.textTertiary, fontSize: 15, lineHeight: 22,
        maxWidth: 900, marginBottom: 14,
      }}>
        {aide}
      </Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {choix.map((c) => {
          const choisi = valeur === c.valeur;
          return (
            <Focusable
              key={c.valeur}
              variant="button"
              focusRadius={Bouton.moyen.borderRadius}
              scaleOverride={1.04}
              onPress={() => { onChoisir(c.valeur); }}
              accessibilityLabel={c.libelle}
            >
              <View style={{
                minWidth: 160,
                alignItems: "center",
                ...Bouton.moyen,
                borderWidth: 1,
                borderColor: choisi ? brandAlpha(0.6) : Colors.glassBorder,
                backgroundColor: choisi ? brandAlpha(0.18) : "transparent",
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}>
                <Text style={{
                  color: choisi ? Colors.accentPurpleLight : Colors.textPrimary,
                  fontSize: 17,
                  fontWeight: "600",
                }}>
                  {c.libelle}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}

function estAction(valeur: string): valeur is SegmentAction {
  return valeur === "button" || valeur === "auto" || valeur === "off";
}

export function TVPlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  const reglages = usePlaybackSettings();
  const suivant = reglages.next;

  const actions: Choix[] = [
    { valeur: "button", libelle: t("segmentActionButton") },
    { valeur: "auto", libelle: t("segmentActionAuto") },
    { valeur: "off", libelle: t("segmentActionOff") },
  ];
  const ouiNon: Choix[] = [
    { valeur: "oui", libelle: t("reglageActive") },
    { valeur: "non", libelle: t("reglageDesactive") },
  ];

  const passages: {
    cle: string; titre: string; aide: string; etat: SegmentSettings;
    appliquer: (patch: Partial<SegmentSettings>) => void;
  }[] = [
    { cle: "intro", titre: t("segmentIntroTitle"), aide: t("segmentIntroHint"), etat: reglages.intro,
      appliquer: (intro) => { setPlaybackSettings({ intro }); } },
    { cle: "recap", titre: t("segmentRecapTitle"), aide: t("segmentRecapHint"), etat: reglages.recap,
      appliquer: (recap) => { setPlaybackSettings({ recap }); } },
    { cle: "outro", titre: t("segmentOutroTitle"), aide: t("segmentOutroHint"), etat: reglages.outro,
      appliquer: (outro) => { setPlaybackSettings({ outro }); } },
    { cle: "preview", titre: t("segmentPreviewTitle"), aide: t("segmentPreviewHint"), etat: reglages.preview,
      appliquer: (preview) => { setPlaybackSettings({ preview }); } },
  ];

  const bascules: { cle: string; titre: string; aide: string; actif: boolean; poser: (v: boolean) => void }[] = [
    { cle: "carte", titre: t("upNextCardTitle"), aide: t("upNextCardHint"), actif: suivant.nextCard,
      poser: (nextCard) => { setPlaybackSettings({ next: { nextCard } }); } },
    { cle: "decompte", titre: t("upNextCountdownTitle"), aide: t("upNextCountdownHint"), actif: suivant.nextCountdown,
      poser: (nextCountdown) => { setPlaybackSettings({ next: { nextCountdown } }); } },
    { cle: "auto", titre: t("upNextAutoPlayTitle"), aide: t("upNextAutoPlayHint"), actif: suivant.nextAutoPlay,
      poser: (nextAutoPlay) => { setPlaybackSettings({ next: { nextAutoPlay } }); } },
  ];

  return (
    <>
      {passages.map((passage) => (
        <BlocReglage
          key={passage.cle}
          titre={passage.titre}
          aide={passage.aide}
          valeur={passage.etat.action}
          choix={actions}
          onChoisir={(valeur) => { if (estAction(valeur)) passage.appliquer({ action: valeur }); }}
        />
      ))}
      {bascules.map((bascule) => (
        <BlocReglage
          key={bascule.cle}
          titre={bascule.titre}
          aide={bascule.aide}
          valeur={bascule.actif ? "oui" : "non"}
          choix={ouiNon}
          onChoisir={(valeur) => { bascule.poser(valeur === "oui"); }}
        />
      ))}
    </>
  );
}
