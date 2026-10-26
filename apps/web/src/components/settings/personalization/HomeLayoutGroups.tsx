import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFavoritesAll, useHomeLayout, useLibraries, useSaveHomeLayoutPatch, useServerCapabilities } from "@tentacle-tv/api-client";
import type { CardDensity, HomeLayoutData } from "@tentacle-tv/api-client";
import { heroModesOffered } from "@tentacle-tv/shared";
import { SegmentedChoice } from "../SegmentedChoice";
import { SettingItem } from "../wide/SettingItem";
import { WideGroup } from "../wide/WideGroup";
import { HeroSourcePicker } from "./HeroSourcePicker";
import { HomeRowsEditor } from "./HomeRowsEditor";
import { useHomeRowsEditorModel } from "./useHomeRowsEditorModel";

/**
 * Accueil et découverte › Bandeau principal, puis › Rangées de l'accueil
 * (taille des cartes, ordre et visibilité). Réglages du COMPTE : chaque
 * changement se sauvegarde aussitôt en « lire avant d'écrire » — un autre
 * appareil qui écrit au même moment n'est pas écrasé, et reçoit ce changement
 * en direct. Monté seulement en ligne (le serveur tient ces réglages).
 */
export function HomeLayoutGroups() {
  const { t } = useTranslation("preferences");
  const { t: tHome } = useTranslation("homeSettings");
  const { data: layout } = useHomeLayout();
  const { data: libraries } = useLibraries();
  const { data: favorites } = useFavoritesAll();
  const libs = useMemo(() => (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const saveLayout = useSaveHomeLayoutPatch({ libraries: libs });
  const serverCaps = useServerCapabilities();
  const homeRows = useHomeRowsEditorModel();

  if (!layout) return null;

  const patchLayout = (patch: Partial<Omit<HomeLayoutData, "stored" | "catalog">>) => {
    saveLayout.mutate(patch);
  };
  // Les sources que CE serveur sait servir ; la valeur en vigueur reste lisible.
  const heroModes = heroModesOffered(serverCaps.capabilities, layout.heroMode);
  const densityOptions: ReadonlyArray<{ value: CardDensity; label: string }> = [
    { value: "compact", label: t("persoDensityCompact") },
    { value: "normal", label: t("persoDensityNormal") },
    { value: "large", label: t("persoDensityLarge") },
  ];

  return (
    <>
      <WideGroup section="personalization" group="hero">
        <SettingItem setting="heroSource">
          <HeroSourcePicker
            modes={heroModes}
            value={layout.heroMode}
            onChange={(heroMode) => patchLayout({ heroMode })}
            favorites={favorites}
            fixedItemId={layout.heroFixedItemId}
            onFixedItemChange={(heroFixedItemId) => patchLayout({ heroFixedItemId })}
          />
        </SettingItem>
      </WideGroup>

      <WideGroup section="personalization" group="rows">
        <SettingItem
          setting="cardDensity"
          trailing={(
            <SegmentedChoice
              label={tHome("densityTitle")}
              value={layout.cardDensity}
              options={densityOptions}
              onChange={(cardDensity) => patchLayout({ cardDensity })}
            />
          )}
        />
        <SettingItem setting="homeRows" note={t("persoRowsHint")}>
          <HomeRowsEditor rows={homeRows.rows} labelFor={homeRows.labelFor} onChange={homeRows.onChange} />
        </SettingItem>
      </WideGroup>
    </>
  );
}
