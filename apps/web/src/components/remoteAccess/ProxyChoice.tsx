import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import type { ReverseProxyKind } from "@tentacle-tv/shared";
import { StatusPill } from "../admin/kit";

const KINDS: readonly ReverseProxyKind[] = ["caddy", "traefik", "other", "none"];

/**
 * Ce qui reçoit Internet : quatre cartes à choix unique. De vrais boutons
 * radio (clavier, lecteurs d'écran), la carte entière cliquable ; « Sans
 * mandataire » porte sa mise en garde dès la carte.
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
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors duration-150 focus-within:ring-2 focus-within:ring-line-focus ${
                selected ? "border-[rgba(var(--brand-rgb),0.55)] bg-[var(--brand-soft)]" : "border-line-subtle bg-fill-faint hover:bg-fill-subtle"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={kind}
                checked={selected}
                onChange={() => onChange(kind)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-content-primary">
                  {t(`proxy_${kind}_title`)}
                  {kind === "caddy" ? (
                    <StatusPill tone="brand" size="sm" dot={false}>
                      {t("recommended")}
                    </StatusPill>
                  ) : null}
                </span>
                <span className={`mt-1 block text-sm leading-relaxed ${kind === "none" ? "text-status-warning-fg" : "text-content-tertiary"}`}>
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
