import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  mergeHiddenHomeRows, reconcileHomeRows, useMediaItem, useSaveHomeLayoutPatch, visibleHomeRows,
} from "@tentacle-tv/api-client";
import type { CardDensity, HeroMode, HomeLayoutData, HomeRowDescriptor } from "@tentacle-tv/api-client";
import {
  SettingsSection, SettingsRow, SettingsChoiceRow, SettingsPickerRow, type SettingsOption,
} from "@/components/settings";
import { FavoritePickerSheet } from "./FavoritePickerSheet";
import { HomeRowsEditor } from "./HomeRowsEditor";
import { homeRowLabel } from "./homeRowLabel";

interface Props {
  layout: HomeLayoutData;
  libraries: ReadonlyArray<{ Id: string; Name: string }>;
}

/**
 * Sections « Accueil » et « Rangées de l'accueil » : mode du bandeau (quatre
 * valeurs → une feuille), titre fixe choisi dans les favoris, densité des
 * cartes (trois mots → segmenté en ligne), puis l'ordre et l'activation des
 * rangées. Chaque changement relit le serveur et n'écrit que lui ; les
 * rangées se patchent PAR CLÉ sur la copie fraîche, réconciliée avec les
 * bibliothèques.
 */
export function PersonalizationHomeSection({ layout, libraries }: Props) {
  const { t } = useTranslation("preferences");
  const { t: tCommon } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const libs = useMemo(() => libraries.map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const librariesById = useMemo(() => new Map(libraries.map((l) => [l.Id, l.Name])), [libraries]);
  const save = useSaveHomeLayoutPatch({ libraries: libs });
  const fixed = useMediaItem(layout.heroMode === "fixed" ? (layout.heroFixedItemId ?? undefined) : undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const heroOptions: ReadonlyArray<SettingsOption<HeroMode>> = [
    { value: "resume", label: t("persoHeroResume"), icon: "play-circle" },
    { value: "random", label: t("persoHeroRandom"), icon: "shuffle" },
    { value: "reco", label: t("persoHeroReco"), icon: "star" },
    { value: "fixed", label: t("persoHeroFixed"), icon: "bookmark" },
  ];
  const densityOptions = [
    { value: "compact", label: t("persoDensityCompact") },
    { value: "normal", label: t("persoDensityNormal") },
    { value: "large", label: t("persoDensityLarge") },
  ];

  return (
    <>
      <SettingsSection title={t("persoHomeTitle")} caption={t("persoHomeCaption")}>
        <SettingsPickerRow
          icon="image"
          label={t("persoHeroMode")}
          options={heroOptions}
          value={layout.heroMode}
          onChange={(heroMode) => save.mutate({ heroMode })}
        />
        {layout.heroMode === "fixed" && (
          <SettingsRow
            icon="bookmark"
            label={t("persoHeroFixed")}
            value={fixed.data?.Name ?? t("persoHeroFixedNone")}
            chevron
            onPress={() => setPickerOpen(true)}
          />
        )}
        <SettingsChoiceRow
          icon="grid"
          label={t("persoDensity")}
          options={densityOptions}
          value={layout.cardDensity}
          onChange={(cardDensity) => save.mutate({ cardDensity: cardDensity as CardDensity })}
          last
        />
      </SettingsSection>

      <SettingsSection title={t("persoRowsTitle")} caption={t("persoRowsHintMobile")}>
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
