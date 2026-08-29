import { useState } from "react";
import { useTranslation } from "react-i18next";
import { desktopPlatform, supportsMpv } from "../../desktop/bridge";
import {
  hardwareDecodingChoice,
  setHardwareDecoding,
  type HardwareDecoding,
} from "../../lib/hardwareDecoding";
import { SettingsSection } from "@tentacle-tv/ui";
import { SegmentedChoice } from "./SegmentedChoice";

/**
 * Le décodage matériel — Auto / Copie mémoire / Logiciel.
 *
 * Il n'existe pas de réglage universel : c'est le PILOTE de la machine qui
 * décide, et certains rendent des trames que le moteur de rendu importe mal
 * (macroblocs sur certaines vidéos seulement — voir `lib/hardwareDecoding.ts`
 * pour la mesure). « Copie mémoire » est la sortie de secours qui marche
 * partout, au prix d'un aller-retour par image.
 *
 * N'apparaît que là où mpv décode : la coquille de bureau. Le choix appartient
 * à l'appareil, et s'applique à la lecture suivante — pas de relance.
 */
export function HardwareDecodingSelect() {
  const { t } = useTranslation("preferences");
  const [choice, setChoice] = useState<HardwareDecoding>(hardwareDecodingChoice);

  // Windows n'a jamais montré ce défaut (D3D11VA est natif) mais le réglage y
  // a le même sens : un pilote peut mal se comporter partout.
  if (!supportsMpv() || desktopPlatform() === null) return null;

  return (
    <SettingsSection title={t("hwDecodeTitle")}>
      <div className="p-5">
        <p className="text-xs leading-relaxed text-content-tertiary">{t("hwDecodeHint")}</p>
        <SegmentedChoice
          label={t("hwDecodeTitle")}
          value={choice}
          options={[
            { value: "auto", label: t("hwDecodeAuto") },
            { value: "copy", label: t("hwDecodeCopy") },
            { value: "off", label: t("hwDecodeOff") },
          ]}
          onChange={(next: HardwareDecoding) => {
            setChoice(next);
            setHardwareDecoding(next);
          }}
          className="mt-4 max-w-full"
        />
        <p className="mt-3 text-xs leading-relaxed text-content-quaternary">
          {t(choice === "auto" ? "hwDecodeAutoHint" : choice === "copy" ? "hwDecodeCopyHint" : "hwDecodeOffHint")}
        </p>
      </div>
    </SettingsSection>
  );
}
