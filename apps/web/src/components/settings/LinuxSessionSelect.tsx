import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { desktopPlatform, invoke, relaunch } from "../../desktop/bridge";
import { supportsLinuxSession } from "../../desktop/capabilities";
import { SettingItem } from "./wide/SettingItem";
import { SegmentedChoice } from "./SegmentedChoice";

/**
 * Le choix de session graphique Linux — Auto / Wayland / X11.
 *
 * C'est l'arbitrage central du lecteur Linux (voir CLAUDE.md) : Wayland est la
 * seule voie du HDR mais impose la lecture plein écran ; X11 lit en fenêtre
 * mais n'aura jamais de HDR. Le réglage existait côté coquille
 * (`session-graphique.json`) sans aucune interface — variable d'environnement
 * ou fichier édité à la main. La décision se fige au démarrage : après un
 * changement, le composant propose la relance, il ne l'impose jamais.
 *
 * S'efface hors coquille Linux, comme `HdrAutoToggle` hors Windows.
 */

type SessionChoice = "auto" | "wayland" | "x11";

interface SessionState {
  choice: SessionChoice;
  montage: string | null;
  bureau: string | null;
}

export function LinuxSessionSelect() {
  const { t } = useTranslation("preferences");
  const [state, setState] = useState<SessionState | null>(null);
  const [chosen, setChosen] = useState<SessionChoice | null>(null);

  const available = desktopPlatform() === "linux" && supportsLinuxSession();

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    void invoke<SessionState>("linux_session_get")
      .then((e) => {
        if (!cancelled) setState(e);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [available]);

  if (!available || state === null) return null;

  const value = chosen ?? state.choice;
  const changed = chosen !== null && chosen !== state.choice;

  const changer = (next: SessionChoice): void => {
    setChosen(next);
    // Écrit tout de suite : même sans relance immédiate, le prochain
    // lancement — quel qu'il soit — lira le nouveau choix.
    void invoke("linux_session_set", { choice: next }).catch(() => undefined);
  };

  return (
    <SettingItem
      setting="linuxSession"
      note={(
        <>
          <span className="block">{t("preferences:linuxSessionHint")}</span>
          {state.montage !== null && (
            <span className="mt-1 block">{t("preferences:linuxSessionCurrent", { montage: state.montage })}</span>
          )}
        </>
      )}
      trailing={(
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedChoice
            label={t("preferences:linuxSessionTitle")}
            value={value}
            options={[
              { value: "auto", label: t("preferences:linuxSessionAuto") },
              { value: "wayland", label: t("preferences:linuxSessionWayland") },
              { value: "x11", label: t("preferences:linuxSessionX11") },
            ]}
            onChange={changer}
            className="max-w-full"
          />
          {/* Le choix ne vaut qu'au prochain lancement : la relance est proposée, jamais imposée. */}
          {changed && (
            <button type="button" onClick={() => void relaunch()} className="btn btn-accent btn-sm">
              {t("preferences:linuxSessionRestart")}
            </button>
          )}
        </div>
      )}
    />
  );
}
