import type { ReactNode } from "react";

interface SubSettingProps {
  title: string;
  hint?: ReactNode;
  /** L'identifiant du titre, pour qu'un contrôle s'y réfère (`aria-labelledby`, `htmlFor`). */
  titleId?: string;
  /** Le contrôle à droite ; il passe sous le texte quand la place manque. */
  trailing?: ReactNode;
  /** Ce qui demande de la place, sous le texte. */
  children?: ReactNode;
  /** Grisé : le réglage existe mais ne s'applique pas ici (son explication dit pourquoi). */
  disabled?: boolean;
}

/**
 * Un contrôle À L'INTÉRIEUR d'une ligne de réglage — la fiche « à suivre » dans « Épisode
 * suivant », le décompte d'un passage. Même grammaire que la ligne (`SettingItem` : un titre, une
 * phrase, le contrôle à droite), un cran plus petit : on lit d'un coup d'œil ce qui est un
 * réglage et ce qui en est un détail.
 */
export function SubSetting({ title, hint, titleId, trailing, children, disabled }: SubSettingProps) {
  return (
    <div className={disabled ? "opacity-60" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        {/* min-w-0 : sans lui, une phrase longue refuse de rétrécir et pousse le contrôle hors de la carte. */}
        <div className="min-w-0 flex-[999_1_14rem]">
          <p id={titleId} className="text-sm font-semibold text-content-primary">{title}</p>
          {hint !== undefined && <p className="mt-0.5 max-w-[62ch] text-[13px] leading-relaxed text-content-tertiary">{hint}</p>}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
