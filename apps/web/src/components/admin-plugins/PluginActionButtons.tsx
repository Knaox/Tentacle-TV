import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleArrowUp, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ActionPill, type PillStatus } from "../admin/sessions/ActionPill";
import { ConfirmButton } from "../admin/sessions/ConfirmButton";
import type { PluginActionKind, PluginActionState } from "./usePluginActions";

/** L'état d'un bouton : celui du geste en cours sur ce plugin, s'il est de sa sorte. */
export function pillStatus(state: PluginActionState | undefined, kind: PluginActionKind): PillStatus {
  return state?.kind === kind ? state.status : "idle";
}

interface UpdateButtonProps {
  name: string;
  version: string;
  /** La mise à jour redémarrera le serveur : on le dit avant. */
  restarts: boolean;
  state: PluginActionState | undefined;
  locked: boolean;
  onUpdate: () => void;
}

/**
 * « Mettre à jour vers vX » — confirmé seulement quand le serveur redémarrera
 * au bout, parce que c'est alors l'affaire de tous les spectateurs.
 */
export function UpdateButton({ name, version, restarts, state, locked, onUpdate }: UpdateButtonProps) {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const [confirming, setConfirming] = useState(false);
  const status = pillStatus(state, "update");
  return (
    <>
      <ActionPill
        tone="brand"
        icon={CircleArrowUp}
        label={t("update")}
        busyLabel={t("updating")}
        doneLabel={t("updated")}
        errorLabel={t("updateFailedShort")}
        status={status}
        disabled={locked && status !== "busy"}
        // La version est dans la puce « vX disponible » : le bouton reste court.
        title={locked && status !== "busy" ? t("lockedHint") : t("updateTo", { version })}
        onClick={() => (restarts ? setConfirming(true) : onUpdate())}
      />
      <ConfirmDialog
        open={confirming}
        title={t("updateConfirmTitle", { name, version })}
        message={t("updateConfirmBody")}
        confirmLabel={t("updateAndRestart")}
        cancelLabel={t("common:cancel")}
        onConfirm={() => {
          setConfirming(false);
          onUpdate();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

interface UninstallButtonProps {
  name: string;
  restarts: boolean;
  state: PluginActionState | undefined;
  locked: boolean;
  onUninstall: () => void;
}

/**
 * La désinstallation, en deux temps : une bulle ancrée au bouton, « Annuler »
 * qui a le focus (la grammaire des sessions en direct) — plus de `confirm()`,
 * que les webviews de bureau n'affichent pas toujours.
 *
 * Verrouillée pendant un autre geste lourd : `ConfirmButton` ne connaît pas
 * `disabled`, le `fieldset` désactive nativement le bouton qu'il contient.
 */
export function UninstallButton({ name, restarts, state, locked, onUninstall }: UninstallButtonProps) {
  const { t } = useTranslation(["adminPlugins", "common"]);
  const status = pillStatus(state, "uninstall");
  const blocked = locked && status !== "busy";
  return (
    <fieldset disabled={blocked} title={blocked ? t("lockedHint") : undefined} className="m-0 min-w-0 border-0 p-0">
      <ConfirmButton
        icon={Trash2}
        label={t("uninstall")}
        busyLabel={t("uninstalling")}
        title={t("confirmUninstall", { name })}
        body={restarts ? t("uninstallBodyRestart") : t("uninstallBody")}
        confirmLabel={t("uninstall")}
        cancelLabel={t("common:cancel")}
        status={status}
        onConfirm={onUninstall}
      />
    </fieldset>
  );
}
