import { memo } from "react";
import { DEBUG_GROUPS, type DebugAction, type DebugStatus } from "./debugActionTypes";

interface DebugActionsViewProps {
  actions: readonly DebugAction[];
  /** L'état de chaque action, par identifiant ; absent tant qu'il n'est pas relevé. */
  statuses: ReadonlyMap<string, DebugStatus>;
  onRun: (action: DebugAction, choice?: string) => void;
}

const ActionRow = memo(function ActionRow({
  action, status, onRun,
}: {
  action: DebugAction;
  status: DebugStatus | undefined;
  onRun: (action: DebugAction, choice?: string) => void;
}) {
  const unavailable = status?.unavailable;
  const disabled = unavailable !== undefined;
  return (
    <>
      <button
        type="button"
        className="dbg-row"
        role={action.kind === "switch" ? "switch" : undefined}
        aria-checked={action.kind === "switch" ? status?.on === true : undefined}
        aria-disabled={disabled}
        onClick={() => { if (!disabled) onRun(action); }}
      >
        <span className="dbg-row__text">
          <span className="dbg-row__label">{action.label}</span>
          {/* Indisponible : la RAISON prend la place de la phrase — c'est elle qu'on cherche. */}
          {disabled ? <span className="dbg-row__why">{unavailable}</span> : <span className="dbg-row__hint">{action.hint}</span>}
        </span>
        {status?.value !== undefined && !disabled && <span className="dbg-value" title={status.value}>{status.value}</span>}
        {action.kind === "switch" && <span className="dbg-switch" data-on={status?.on === true} aria-hidden />}
        <kbd className="dbg-key" aria-hidden>{action.key.toUpperCase()}</kbd>
      </button>
      {action.choices && (
        <div className="dbg-choices" role="group" aria-label={action.label}>
          {action.choices.map((choice) => (
            <button key={choice.id} type="button" className="dbg-choice" disabled={disabled} onClick={() => onRun(action, choice.id)}>
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
});

/**
 * L'onglet « Actions » : chaque bascule dans son groupe, avec son état — allumée ou non, sa
 * valeur en cours, ou la raison pour laquelle elle ne peut pas agir sur cette coquille.
 */
export function DebugActionsView({ actions, statuses, onRun }: DebugActionsViewProps) {
  return (
    <>
      {DEBUG_GROUPS.map((group) => {
        const rows = actions.filter((a) => a.group === group.id);
        if (rows.length === 0) return null;
        return (
          <section key={group.id} className="dbg-group" aria-label={group.label}>
            <h3 className="dbg-group__label">{group.label}</h3>
            <div className="dbg-card">
              {rows.map((action) => <ActionRow key={action.id} action={action} status={statuses.get(action.id)} onRun={onRun} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
