/**
 * Les adresses que l'admin déclare locales pour le plafond de débit : la liste
 * en pastilles, chacune avec sa croix, et — quand le « + » de la ligne « Réseau
 * local » l'a ouvert — un champ pour en ajouter une. Le brouillon appartient au
 * formulaire parent : c'est son bouton Enregistrer qui envoie tout.
 */

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cls } from "./adminUtils";
import { isValidIpOrCidr } from "./adminBandwidthUnits";

interface AdminBandwidthIpsProps {
  ips: string[];
  onChange: (ips: string[]) => void;
  /** Le champ d'ajout est ouvert (le « + » de la ligne). */
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

export function AdminBandwidthIps({ ips, onChange, adding, onAddingChange }: AdminBandwidthIpsProps) {
  const { t } = useTranslation("admin");
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!isValidIpOrCidr(value)) {
      setInvalid(true);
      return;
    }
    if (!ips.includes(value)) onChange([...ips, value]);
    setDraft("");
    setInvalid(false);
    onAddingChange(false);
  };

  if (!adding && ips.length === 0) return null;

  return (
    <div className="ml-3 space-y-2 border-l-2 border-line-subtle pl-3">
      <p className="text-xs text-content-quaternary">{t("bandwidthIpsHelp")}</p>
      {ips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {ips.map((ip) => (
            <li key={ip} className={`${cls.chip} bg-fill-soft text-content-primary`}>
              <span className="font-mono">{ip}</span>
              <button
                type="button"
                onClick={() => onChange(ips.filter((other) => other !== ip))}
                aria-label={t("bandwidthIpRemove", { ip })}
                className="ml-0.5 rounded-full text-content-tertiary transition hover:text-content-primary"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <span className="w-64">
            <input
              autoFocus
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(false);
              }}
              placeholder={t("bandwidthIpPlaceholder")}
              aria-label={t("bandwidthAddIp")}
              aria-invalid={invalid}
              className={`${cls.inp} font-mono`}
            />
          </span>
          <button type="submit" className={cls.bs}>{t("bandwidthIpAdd")}</button>
          <button type="button" onClick={() => onAddingChange(false)} className="text-xs text-content-tertiary hover:text-content-primary">
            {t("common:cancel")}
          </button>
          {invalid && <span className="text-xs text-[var(--status-error-fg)]">{t("bandwidthIpInvalid")}</span>}
        </form>
      )}
    </div>
  );
}
