import { useState } from "react";
import { useTranslation } from "react-i18next";
import { moveRow } from "@tentacle-tv/api-client";
import type { HomeRowDescriptor } from "@tentacle-tv/api-client";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { DotsSixVerticalIcon } from "@phosphor-icons/react/dist/csr/DotsSixVertical";
import { ToggleSwitch } from "../ToggleSwitch";

interface HomeRowsEditorProps {
  rows: HomeRowDescriptor[];
  labelFor: (key: string) => string;
  onChange: (rows: HomeRowDescriptor[]) => void;
}

/**
 * Liste réordonnable des rangées de l'accueil : glisser-déposer HTML5 NATIF
 * (aucune bibliothèque) PLUS boutons monter/descendre — indispensables au
 * clavier et aux lecteurs d'écran, et seuls survivants sur le portage TV où
 * le glisser n'existe pas. L'interrupteur active/désactive sans réordonner.
 */
export function HomeRowsEditor({ rows, labelFor, onChange }: HomeRowsEditorProps) {
  const { t } = useTranslation("preferences");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const drop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) onChange(moveRow(rows, dragIndex, to));
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <ul className="flex flex-col gap-1.5" role="list">
      {rows.map((row, index) => (
        <li
          key={row.key}
          draggable
          onDragStart={(e) => {
            setDragIndex(index);
            e.dataTransfer.effectAllowed = "move";
            // Firefox exige une donnée pour démarrer un glisser.
            e.dataTransfer.setData("text/plain", row.key);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overIndex !== index) setOverIndex(index);
          }}
          onDragLeave={() => setOverIndex((v) => (v === index ? null : v))}
          onDrop={(e) => {
            e.preventDefault();
            drop(index);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={`flex items-center gap-3 rounded-field px-3 py-1.5 transition-colors duration-hover ${
            overIndex === index && dragIndex !== null && dragIndex !== index
              ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]"
              : "bg-surface-2"
          } ${dragIndex === index ? "opacity-50" : ""}`}
        >
          <span aria-hidden className="cursor-grab text-content-quaternary" title={t("persoRowsDragHint")}>
            <DotsSixVerticalIcon size={16} weight="bold" />
          </span>
          <span className={`min-w-0 flex-1 truncate text-sm ${row.enabled ? "text-content-primary" : "text-content-tertiary"}`}>
            {labelFor(row.key)}
          </span>
          <div className="flex items-center">
            <MoveButton
              label={t("persoRowMoveUp")}
              disabled={index === 0}
              onClick={() => onChange(moveRow(rows, index, index - 1))}
            >
              <CaretUpIcon size={15} weight="bold" aria-hidden />
            </MoveButton>
            <MoveButton
              label={t("persoRowMoveDown")}
              disabled={index === rows.length - 1}
              onClick={() => onChange(moveRow(rows, index, index + 1))}
            >
              <CaretDownIcon size={15} weight="bold" aria-hidden />
            </MoveButton>
          </div>
          <ToggleSwitch
            checked={row.enabled}
            onChange={(enabled) =>
              onChange(rows.map((r) => (r.key === row.key ? { ...r, enabled } : r)))
            }
            label={labelFor(row.key)}
          />
        </li>
      ))}
    </ul>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="icon-btn btn-sm"
    >
      {children}
    </button>
  );
}
