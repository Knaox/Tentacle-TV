import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { desktopPlatform, invoke, relaunch } from "../../desktop/bridge";
import { supportsLinuxSession } from "../../desktop/capabilities";

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
    <div>
      <p className="text-sm font-medium text-content-primary">{t("preferences:linuxSessionTitle")}</p>
      <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
        {t("preferences:linuxSessionHint")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={value}
          onChange={(e) => changer(e.target.value as SessionChoice)}
          className="w-full max-w-xs appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 py-2 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary"
        >
          <option value="auto">{t("preferences:linuxSessionAuto")}</option>
          <option value="wayland">{t("preferences:linuxSessionWayland")}</option>
          <option value="x11">{t("preferences:linuxSessionX11")}</option>
        </select>
        {changed && (
          <button
            onClick={() => void relaunch()}
            className="rounded-lg bg-tentacle-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            {t("preferences:linuxSessionRestart")}
          </button>
        )}
      </div>
      {state.montage !== null && (
        <p className="mt-2 text-xs text-content-tertiary">
          {t("preferences:linuxSessionCurrent", { montage: state.montage })}
        </p>
      )}
    </div>
  );
}
