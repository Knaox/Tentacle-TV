import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import type { ReverseProxyKind } from "@tentacle-tv/shared";
import { StatusPill } from "../admin/kit";

/** « Sans mandataire » d'abord : le choix par défaut de qui n'en a pas — les autres ne valent que pour qui en a DÉJÀ un. */
const KINDS: readonly ReverseProxyKind[] = ["none", "caddy", "traefik", "other"];

/**
 * Ce qui reçoit Internet : quatre cartes à choix unique. De vrais boutons
 * radio (clavier, lecteurs d'écran), la carte entière cliquable. « Sans
 * mandataire » est le défaut ; Caddy, Traefik et Nginx ne sont ni inclus ni
 * installés par Tentacle — l'écran le dit au-dessus des cartes.
 */
export const ProxyChoice = memo(function ProxyChoice({ value, onChange }: { value: ReverseProxyKind; onChange: (kind: ReverseProxyKind) => void }) {
  const { t } = useTranslation("remoteAccess");
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{t("step1Title")}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((kind) => {
          const selected = value === kind;
          return (
            <label
              key={kind}
              className={`flex cursor-pointer gap-3 rounded-tile p-4 transition-colors duration-hover focus-within:ring-2 focus-within:ring-line-focus ${
                selected ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-surface-2 hover:bg-surface-3"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={kind}
                checked={selected}
                onChange={() => onChange(kind)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-content-primary">
                  {t(`proxy_${kind}_title`)}
                  {kind === "none" ? (
                    <StatusPill tone="brand" size="sm" dot={false}>
                      {t("defaultChoice")}
                    </StatusPill>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-content-tertiary">
                  {t(`proxy_${kind}_body`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
});
