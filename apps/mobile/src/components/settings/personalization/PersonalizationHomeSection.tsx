import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  mergeHiddenHomeRows, reconcileHomeRows, useMediaItem, useSaveHomeLayoutPatch, useServerCapabilities, visibleHomeRows,
} from "@tentacle-tv/api-client";
import { heroModeHintKey, heroModeLabelKey, heroModesOffered } from "@tentacle-tv/shared";
import type { CardDensity, HeroMode, HomeLayoutData, HomeRowDescriptor } from "@tentacle-tv/api-client";
import {
  SettingsSection, SettingsRow, SettingsChoiceRow, SettingsPickerRow, type SettingsIcon, type SettingsOption,
} from "@/components/settings";
import { FavoritePickerSheet } from "./FavoritePickerSheet";
import { HomeRowsEditor } from "./HomeRowsEditor";
import { homeRowLabel } from "./homeRowLabel";

interface Props {
  layout: HomeLayoutData;
  libraries: ReadonlyArray<{ Id: string; Name: string }>;
}

/** Le signe de chaque source du bandeau (Feather). */
const HERO_ICONS: Readonly<Record<HeroMode, SettingsIcon>> = {
  resume: "play-circle",
  random: "shuffle",
  reco: "star",
  recoMovies: "film",
  recoSeries: "tv",
  fixed: "bookmark",
};

/**
 * Sections « Bandeau principal » et « Rangées de l'accueil » : la source du
 * bandeau (une feuille où chaque source dit ce qu'elle MONTRE — seulement
 * celles que le serveur sait servir, shared `heroModesOffered`), le titre fixe
 * choisi dans les favoris ; puis la taille des cartes (trois mots → segmenté
 * en ligne), l'ordre et l'activation des rangées. Chaque changement relit le serveur et n'écrit que lui ; les
 * rangées se patchent PAR CLÉ sur la copie fraîche, réconciliée avec les
 * bibliothèques.
 */
export function PersonalizationHomeSection({ layout, libraries }: Props) {
  const { t } = useTranslation("preferences");
  const { t: tCommon } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const { t: tHome } = useTranslation("homeSettings");
  const libs = useMemo(() => libraries.map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const librariesById = useMemo(() => new Map(libraries.map((l) => [l.Id, l.Name])), [libraries]);
  const save = useSaveHomeLayoutPatch({ libraries: libs });
  const fixed = useMediaItem(layout.heroMode === "fixed" ? (layout.heroFixedItemId ?? undefined) : undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { capabilities } = useServerCapabilities();

  // La liste VISIBLE que l'éditeur manipule — même réconciliation que l'accueil.
  const editorRows = useMemo(
    () => visibleHomeRows(
      reconcileHomeRows(layout.rows, libs, { anchorNewLibraries: layout.stored === false, catalog: layout.catalog }),
      layout.catalog,
    ),
    [layout, libs],
  );
  const labelFor = useCallback((key: string) => homeRowLabel(key, { tCommon, tReco, librariesById }), [tCommon, tReco, librariesById]);
  // Les rangées cachées reprennent leur place derrière celles que l'éditeur a
  // ordonnées — sur la copie FRAÎCHE (un autre appareil a pu bouger entre-temps).
  const changeRows = useCallback((next: HomeRowDescriptor[]) => {
    save.mutate((fresh) => ({ rows: mergeHiddenHomeRows(fresh.rows, next, fresh.catalog) }));
  }, [save]);

  const heroOptions: ReadonlyArray<SettingsOption<HeroMode>> = heroModesOffered(capabilities, layout.heroMode).map((mode) => ({
    value: mode,
    label: tHome(heroModeLabelKey(mode)),
    description: tHome(heroModeHintKey(mode)),
    icon: HERO_ICONS[mode],
  }));
  const densityOptions = [
    { value: "compact", label: t("persoDensityCompact") },
    { value: "normal", label: t("persoDensityNormal") },
    { value: "large", label: t("persoDensityLarge") },
  ];

  return (
    <>
      <SettingsSection title={tHome("heroTitle")} caption={tHome("heroCaption")}>
        <SettingsPickerRow
          icon="image"
          label={tHome("heroTitle")}
          options={heroOptions}
          value={layout.heroMode}
          onChange={(heroMode) => save.mutate({ heroMode })}
          last={layout.heroMode !== "fixed"}
        />
        {layout.heroMode === "fixed" && (
          <SettingsRow
            icon="bookmark"
            label={tHome("heroFixedPickTitle")}
            value={fixed.data?.Name ?? t("persoHeroFixedNone")}
            chevron
            last
            onPress={() => setPickerOpen(true)}
          />
        )}
      </SettingsSection>

      <SettingsSection title={tHome("rowsTitle")} caption={t("persoRowsHintMobile")}>
        <SettingsChoiceRow
          icon="grid"
          label={tHome("densityTitle")}
          options={densityOptions}
          value={layout.cardDensity}
          onChange={(cardDensity) => save.mutate({ cardDensity: cardDensity as CardDensity })}
        />
        <HomeRowsEditor rows={editorRows} labelFor={labelFor} onChange={changeRows} />
      </SettingsSection>

      <FavoritePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={layout.heroFixedItemId}
        onSelect={(id) => save.mutate({ heroFixedItemId: id })}
      />
    </>
  );
}
