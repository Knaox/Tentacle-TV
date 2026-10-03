import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import type { ServerUpdateCommands } from "@tentacle-tv/shared";
import { useCopyFeedback } from "../../../hooks/useCopyFeedback";
import { cls } from "../../../pages/adminUtils";
import { AdminNotice, TabPanel, Tabs } from "../kit";

/**
 * « Mettre à jour » : la commande à copier en un geste. Deux variantes, parce
 * que le serveur ne sait pas laquelle a servi à l'installer — docker compose
 * d'abord, le mode du README. Une étiquette figée se dit AVANT la commande :
 * sans changer le fichier, elle n'irait rien chercher.
 *
 * Copier lance le guet de la carte (`onCopied`). Une copie impossible (page
 * en http:// sur le réseau local, presse-papiers refusé) le dit, et
 * sélectionne la commande pour la copier à la main.
 */

type Variant = "compose" | "run";

interface Props {
  commands: ServerUpdateCommands;
  current: string;
  /** La version visée : la dernière publiée, ou celle qu'exigent les clients. */
  target: string | null;
  onCopied: () => void;
}

export function UpdateCommand({ commands, current, target, onCopied }: Props) {
  const { t } = useTranslation("adminOverview");
  const idPrefix = useId();
  const [variant, setVariant] = useState<Variant>("compose");
  const pinned = commands.pinned;

  return (
    <div className="mt-5 border-t border-line-subtle pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-content-primary">{t("updateTitle")}</h3>
        <Tabs
          idPrefix={idPrefix}
          label={t("updateVariants")}
          items={[{ id: "compose", label: t("updateCompose") }, { id: "run", label: t("updateRun") }]}
          active={variant}
          onChange={setVariant}
        />
      </div>
      {pinned ? (
        <AdminNotice tone="warning" className="mt-3">
          {pinned.to ? t("updatePinned", { from: pinned.from, to: pinned.to }) : t("updatePinnedNoTarget", { from: pinned.from })}
        </AdminNotice>
      ) : null}
      <TabPanel idPrefix={idPrefix} id={variant} active className="mt-3">
        <CommandLine command={variant === "compose" ? commands.compose : commands.run} onCopied={onCopied} />
        <p className="mt-2 text-xs leading-relaxed text-content-tertiary">
          {variant === "compose" ? t("updateComposeHint") : t("updateRunHint")}
        </p>
        {commands.assumedTag && target ? (
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("updateAssumedTag", { current, latest: target })}</p>
        ) : null}
      </TabPanel>
    </div>
  );
}

function CommandLine({ command, onCopied }: { command: string; onCopied: () => void }) {
  const { t } = useTranslation("adminOverview");
  const { status, copy } = useCopyFeedback();
  const code = useRef<HTMLElement>(null);

  const onCopy = async () => {
    if (await copy(command)) {
      onCopied();
      return;
    }
    // La copie à la main : la commande sélectionnée, prête pour ⌘C.
    const selection = window.getSelection();
    if (code.current && selection) selection.selectAllChildren(code.current);
  };

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap">
        <code
          ref={code}
          className="min-w-0 flex-1 select-all whitespace-pre-wrap break-words rounded-lg border border-line-subtle bg-fill-faint px-3 py-2.5 font-mono text-[13px] leading-relaxed text-content-primary"
        >
          {command}
        </code>
        <button type="button" onClick={() => void onCopy()} className={`${cls.bp} w-full sm:w-auto`}>
          {status === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {status === "copied" ? t("copied") : t("copy")}
        </button>
      </div>
      {/* « Copiée » se dit aussi aux lecteurs d'écran ; l'échec, lui, s'annonce. */}
      <span aria-live="polite" className="sr-only">{status === "copied" ? t("copied") : ""}</span>
      {status === "failed" ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-status-error-fg">{t("copyFailed")}</p>
      ) : null}
    </>
  );
}
