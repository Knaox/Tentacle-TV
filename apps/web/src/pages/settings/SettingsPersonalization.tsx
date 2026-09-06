import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isVigieActive,
  mergeHiddenHomeRows,
  recoRowTitle,
  reconcileHomeRows,
  useFavoritesAll,
  useHomeLayout,
  useLibraries,
  useRecoSettings,
  useResetTasteProfile,
  useSaveHomeLayoutPatch,
  useSaveRecoSettingsPatch,
  visibleHomeRows,
} from "@tentacle-tv/api-client";
import type { CardDensity, HeroMode, HomeLayoutData, HomeRowDescriptor, RecoSettingsData } from "@tentacle-tv/api-client";
import { SettingsSection } from "@tentacle-tv/ui";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { SegmentedChoice } from "../../components/settings/SegmentedChoice";
import { SettingToggleRow, SETTING_FIELD } from "../../components/settings/SettingToggleRow";
import { HomeRowsEditor } from "../../components/settings/personalization/HomeRowsEditor";
import { LinkedAccounts } from "../../components/settings/personalization/LinkedAccounts";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { rangeFill } from "../../lib/rangeFill";

/** Le curseur n'écrit qu'au repos : une mutation par cran ferait vingt allers-retours. */
const BALANCE_SAVE_MS = 300;

/**
 * Onglet « Personnalisation » : accueil configurable (mode du bandeau, ordre
 * et activation des rangées, densité) et moteur de recommandation (activation,
 * Vigie, communautaire, désinscription vie privée, curseur Sûr ↔ Aventureux,
 * remise à zéro du profil). Chaque changement se sauvegarde immédiatement en
 * « lire avant d'écrire » : le serveur est relu, seul le changement demandé
 * s'applique au bloc frais — un autre appareil qui écrit au même moment n'est
 * pas écrasé, et lui-même reçoit ce changement en direct.
 */
export function SettingsPersonalization() {
  const { t } = useTranslation("preferences");
  const { t: tCommon } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const { data: layout } = useHomeLayout();
  const { data: settings } = useRecoSettings();
  const { data: libraries } = useLibraries();
  const { data: favorites } = useFavoritesAll();
  const libs = useMemo(() => (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const saveLayout = useSaveHomeLayoutPatch({ libraries: libs });
  const saveSettings = useSaveRecoSettingsPatch();
  const resetProfile = useResetTasteProfile();
  const [confirmReset, setConfirmReset] = useState(false);

  // Le curseur garde un état local pendant le geste et n'écrit qu'au repos ;
  // tant qu'une sauvegarde attend ou vole, le serveur ne dicte rien (le
  // rafraîchissement d'une sauvegarde précédente ramènerait l'ancienne valeur).
  const [balance, setBalance] = useState(settings?.explorationBalance ?? 70);
  const balanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverBalance = settings?.explorationBalance;
  useEffect(() => {
    if (serverBalance !== undefined && !saveSettings.isPending && balanceTimer.current === null) setBalance(serverBalance);
  }, [serverBalance, saveSettings.isPending]);
  useEffect(() => () => { if (balanceTimer.current) clearTimeout(balanceTimer.current); }, []);
  const changeBalance = (value: number) => {
    setBalance(value);
    if (balanceTimer.current) clearTimeout(balanceTimer.current);
    balanceTimer.current = setTimeout(() => {
      balanceTimer.current = null;
      saveSettings.mutate({ explorationBalance: value });
    }, BALANCE_SAVE_MS);
  };
  // « Hors bibliothèque » n'a de sens qu'avec le plugin Vigie présent et
  // activé : sans lui, le serveur ignore le réglage et l'interrupteur se tait.
  const vigie = isVigieActive(useActivePluginsMeta());

  // La liste COMPLÈTE (clés hors catalogue comprises : elles restent
  // stockées) et la liste VISIBLE que l'éditeur manipule — seules les rangées
  // que ce serveur sait servir se proposent.
  const rows = useMemo(
    () =>
      layout
        ? reconcileHomeRows(layout.rows, libs, {
            // Même ancre que l'accueil : l'éditeur doit montrer l'ordre RÉEL.
            anchorNewLibraries: layout.stored === false,
            catalog: layout.catalog,
          })
        : [],
    [layout, libs]
  );
  const editorRows = useMemo(() => visibleHomeRows(rows, layout?.catalog), [rows, layout?.catalog]);

  if (!layout || !settings) return null;

  const patchLayout = (patch: Partial<Omit<HomeLayoutData, "stored" | "catalog">>) => {
    saveLayout.mutate(patch);
  };
  // Les rangées cachées reprennent leur place derrière celles que l'éditeur a
  // ordonnées : une clé TMDB retirée puis remise ne perd rien. Patch
  // FONCTIONNEL : appliqué sur la copie fraîche du serveur, réconciliée.
  const changeRows = (next: HomeRowDescriptor[]) => {
    saveLayout.mutate((fresh) => ({ rows: mergeHiddenHomeRows(fresh.rows, next, fresh.catalog) }));
  };
  const patchSettings = (patch: Partial<RecoSettingsData>) => {
    saveSettings.mutate(patch);
  };

  const librariesById = new Map((libraries ?? []).map((l) => [l.Id, l.Name]));
  const labelFor = (key: string): string => {
    if (key === "resume") return tCommon("common:resumeWatching");
    if (key === "nextUp") return tCommon("common:nextEpisodes");
    if (key === "watchlist") return tCommon("common:myList");
    if (key === "watched") return tCommon("common:alreadyWatched");
    if (key === "favorites") return tCommon("common:myFavorites");
    if (key.startsWith("library:")) {
      return tCommon("common:latestAdditions", {
        name: librariesById.get(key.slice("library:".length)) ?? "?",
      });
    }
    if (key.startsWith("reco:")) {
      // Même table que les rangées elles-mêmes (tendances, pouls, mieux notés compris).
      return tReco(recoRowTitle({ key: key.slice("reco:".length) }).key);
    }
    return key;
  };

  const heroOptions: ReadonlyArray<{ value: HeroMode; label: string }> = [
    { value: "resume", label: t("persoHeroResume") },
    { value: "random", label: t("persoHeroRandom") },
    { value: "reco", label: t("persoHeroReco") },
    { value: "fixed", label: t("persoHeroFixed") },
  ];
  const densityOptions: ReadonlyArray<{ value: CardDensity; label: string }> = [
    { value: "compact", label: t("persoDensityCompact") },
    { value: "normal", label: t("persoDensityNormal") },
    { value: "large", label: t("persoDensityLarge") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title={t("persoHomeTitle")} caption={t("persoHomeCaption")}>
        {/* SettingsSection ne pose AUCUN padding (et rogne via overflow-hidden) :
            le p-5 est à la charge du contenu, comme partout ailleurs. */}
        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-content-primary">{t("persoHeroMode")}</p>
            <SegmentedChoice
              label={t("persoHeroMode")}
              value={layout.heroMode}
              options={heroOptions}
              onChange={(heroMode) => patchLayout({ heroMode })}
            />
            {layout.heroMode === "fixed" && (
              <div className="mt-3">
                {favorites && favorites.length > 0 ? (
                  <select
                    className={SETTING_FIELD}
                    value={layout.heroFixedItemId ?? ""}
                    onChange={(e) => patchLayout({ heroFixedItemId: e.target.value || null })}
                    aria-label={t("persoHeroFixedPick")}
                  >
                    <option value="">{t("persoHeroFixedPick")}</option>
                    {favorites.map((f) => (
                      <option key={f.Id} value={f.Id}>
                        {f.Name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-content-tertiary">{t("persoHeroFixedEmpty")}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-content-primary">{t("persoDensity")}</p>
            <SegmentedChoice
              label={t("persoDensity")}
              value={layout.cardDensity}
              options={densityOptions}
              onChange={(cardDensity) => patchLayout({ cardDensity })}
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-content-primary">{t("persoRowsTitle")}</p>
            <p className="mb-3 text-xs leading-relaxed text-content-tertiary">{t("persoRowsHint")}</p>
            <HomeRowsEditor rows={editorRows} labelFor={labelFor} onChange={changeRows} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t("persoRecoTitle")} caption={t("persoRecoCaption")}>
        <div className="flex flex-col gap-4 p-5">
          <SettingToggleRow
            title={t("persoRecoPersonalized")}
            hint={t("persoRecoPersonalizedHint")}
            active={settings.personalized}
            onChange={(personalized) => patchSettings({ personalized })}
          />
          {vigie && (
            <SettingToggleRow
              title={t("persoRecoVigie")}
              hint={t("persoRecoVigieHint")}
              active={settings.includeVigie}
              onChange={(includeVigie) => patchSettings({ includeVigie })}
            />
          )}
          <SettingToggleRow
            title={t("persoRecoCommunity")}
            hint={t("persoRecoCommunityHint")}
            active={settings.community}
            onChange={(community) => patchSettings({ community })}
          />
          <SettingToggleRow
            title={t("persoRecoShareHistory")}
            hint={t("persoRecoShareHistoryHint")}
            active={settings.shareHistory}
            onChange={(shareHistory) => patchSettings({ shareHistory })}
          />

          <div>
            <p className="mb-1 text-sm font-medium text-content-primary">{t("persoBalance")}</p>
            <p className="mb-2 text-xs leading-relaxed text-content-tertiary">{t("persoBalanceHint")}</p>
            <div className="flex items-center gap-3">
              {/* shrink-0 : en flex, min-width:auto écraserait la piste au lieu
                  de laisser le libellé entier. */}
              <span className="shrink-0 text-xs text-content-tertiary">{t("persoBalanceAdventurous")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={balance}
                onChange={(e) => changeBalance(Number(e.target.value))}
                className="ctl-range flex-1"
                style={rangeFill(balance, 0, 100)}
                aria-label={t("persoBalance")}
              />
              <span className="shrink-0 text-xs text-content-tertiary">{t("persoBalanceSafe")}</span>
            </div>
          </div>

          <div className="border-t border-line-subtle pt-4">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="rounded-full border border-danger-border bg-danger-surface px-4 py-2 text-sm font-medium text-status-error transition-colors hover:bg-danger-surface-hover"
            >
              {t("persoResetProfile")}
            </button>
          </div>
        </div>
      </SettingsSection>

      <LinkedAccounts />

      <ConfirmDialog
        open={confirmReset}
        title={t("persoResetProfile")}
        message={t("persoResetProfileBody")}
        confirmLabel={t("persoResetProfileConfirm")}
        cancelLabel={tCommon("common:cancel")}
        danger
        pending={resetProfile.isPending}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() =>
          resetProfile.mutate(undefined, { onSettled: () => setConfirmReset(false) })
        }
      />
    </div>
  );
}
