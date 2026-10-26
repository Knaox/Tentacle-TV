import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isVigieRecoAvailable, useRecoSettings, useResetTasteProfile, useSaveRecoSettingsPatch, useTrendingNowSetting,
} from "@tentacle-tv/api-client";
import type { RecoSettingsData } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { rangeFill } from "../../../lib/rangeFill";
import { ToggleSwitch } from "../ToggleSwitch";
import { SettingItem } from "../wide/SettingItem";
import { WideGroup } from "../wide/WideGroup";
import { SETTING_DANGER_BUTTON } from "../wide/settingButtons";

/** Le curseur n'écrit qu'au repos : une mutation par cran ferait vingt allers-retours. */
const BALANCE_SAVE_MS = 300;

/**
 * Accueil et découverte › Recommandations : ce que le moteur peut proposer et
 * ce qu'il a le droit d'utiliser — tendances, suggestions personnalisées, hors
 * bibliothèque (Vigie), communauté, partage de l'historique, curseur Sûr ↔
 * Aventureux, remise à zéro du profil. Réglages du COMPTE, écrits aussitôt en
 * « lire avant d'écrire ». Monté seulement en ligne.
 */
export function RecoSettingsGroup() {
  const { t } = useTranslation("preferences");
  const { t: tCommon } = useTranslation("common");
  const { data: settings } = useRecoSettings();
  const saveSettings = useSaveRecoSettingsPatch();
  const resetProfile = useResetTasteProfile();
  // « Tendances actuelles » : seulement face à un serveur qui déclare `reco.trending`.
  const trendingNow = useTrendingNowSetting();
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
  // « Hors bibliothèque » n'a de sens que si CE serveur sait servir du hors
  // bibliothèque : il le dit lui-même (`vigieAvailable`) ; la liste des
  // plugins ne reste que le repli des serveurs d'avant ce champ.
  const vigie = isVigieRecoAvailable(settings?.vigieAvailable, useActivePluginsMeta());

  if (!settings) return null;
  const toggle = (key: "personalized" | "includeVigie" | "community" | "shareHistory", label: string) => (
    <ToggleSwitch checked={settings[key]} onChange={(value) => saveSettings.mutate({ [key]: value } as Partial<RecoSettingsData>)} label={label} />
  );

  return (
    <WideGroup section="personalization" group="reco">
      {/* En tête : c'est la PREMIÈRE rangée de « Pour vous ». */}
      {trendingNow.available && (
        <SettingItem
          setting="trendingNow"
          trailing={<ToggleSwitch checked={trendingNow.enabled} onChange={trendingNow.setEnabled} label={t("persoRecoTrending")} />}
        />
      )}
      <SettingItem setting="recoPersonalized" trailing={toggle("personalized", t("persoRecoPersonalized"))} />
      {vigie && <SettingItem setting="recoVigie" trailing={toggle("includeVigie", t("persoRecoVigie"))} />}
      <SettingItem setting="recoCommunity" trailing={toggle("community", t("persoRecoCommunity"))} />
      <SettingItem setting="recoShareHistory" note={t("persoRecoShareHistoryHint")} trailing={toggle("shareHistory", t("persoRecoShareHistory"))} />
      <SettingItem setting="recoBalance">
        <div className="flex items-center gap-3">
          {/* shrink-0 : en flex, min-width:auto écraserait la piste au lieu de laisser le libellé entier. */}
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
      </SettingItem>
      <SettingItem
        setting="recoReset"
        trailing={(
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className={SETTING_DANGER_BUTTON}
          >
            {t("persoResetProfileConfirm")}
          </button>
        )}
      />
      <ConfirmDialog
        open={confirmReset}
        title={t("persoResetProfile")}
        message={t("persoResetProfileBody")}
        confirmLabel={t("persoResetProfileConfirm")}
        cancelLabel={tCommon("common:cancel")}
        danger
        pending={resetProfile.isPending}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => resetProfile.mutate(undefined, { onSettled: () => setConfirmReset(false) })}
      />
    </WideGroup>
  );
}
