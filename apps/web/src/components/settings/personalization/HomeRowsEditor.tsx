import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HomeRowDescriptor } from "@tentacle-tv/api-client";
import { ToggleSwitch } from "../ToggleSwitch";
import { moveRow } from "../../../lib/homeLayout";

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
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
            overIndex === index && dragIndex !== null && dragIndex !== index
              ? "border-line-focus bg-fill-soft"
              : "border-line-subtle bg-fill-faint"
          } ${dragIndex === index ? "opacity-50" : ""}`}
        >
          <span aria-hidden className="cursor-grab text-content-quaternary" title={t("persoRowsDragHint")}>
            <GripIcon />
          </span>
          <span className={`min-w-0 flex-1 truncate text-sm ${row.enabled ? "text-content-primary" : "text-content-tertiary"}`}>
            {labelFor(row.key)}
          </span>
          <div className="flex items-center gap-1">
            <MoveButton
              label={t("persoRowMoveUp")}
              disabled={index === 0}
              onClick={() => onChange(moveRow(rows, index, index - 1))}
            >
              <ChevronUp />
            </MoveButton>
            <MoveButton
              label={t("persoRowMoveDown")}
              disabled={index === rows.length - 1}
              onClick={() => onChange(moveRow(rows, index, index + 1))}
            >
              <ChevronDown />
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
      className="flex h-7 w-7 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function GripIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
