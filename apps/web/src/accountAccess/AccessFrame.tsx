import { useEffect, useRef, type ComponentType, type ReactNode } from "react";

/**
 * Le cadre des pages de l'accès du compte (docs/DROITS-UTILISATEURS.md § 9.1),
 * web et bureau : plein écran à la place de l'application, une pastille,
 * le titre, la raison, ce que la page a de plus à dire, les actions — la
 * première est la principale, le focus y entre — puis une ligne de pied.
 */
export interface AccessFrameAction {
  key: string;
  label: string;
  onClick: () => void;
}

export function AccessFrame(props: {
  icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  actions: AccessFrameAction[];
  footer?: string;
  children?: ReactNode;
}) {
  const { icon: Icon, actions } = props;
  const primaryRef = useRef<HTMLButtonElement>(null);
  // Le focus entre sur l'action principale : le clavier n'a rien d'autre à atteindre.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="account-access-title"
      aria-describedby="account-access-body"
      className="fixed inset-0 z-[1001] overflow-y-auto bg-surface-modal backdrop-blur-md motion-safe:[animation:fadeIn_0.4s_ease-out]"
    >
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-lg flex-col items-center text-center">
          <div className="rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] p-px">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-modal">
              <Icon aria-hidden className="h-9 w-9 text-content-primary" strokeWidth={1.75} />
            </div>
          </div>
          <h1 id="account-access-title" className="mt-7 text-2xl font-bold leading-tight text-content-primary">
            {props.title}
          </h1>
          <p id="account-access-body" className="mt-3 max-w-md text-[15px] leading-relaxed text-content-secondary">
            {props.body}
          </p>
          {props.children}
          <div className="mt-9 flex w-full flex-col items-center gap-3">
            {actions.map((action, index) => (
              <button
                key={action.key}
                ref={index === 0 ? primaryRef : undefined}
                type="button"
                onClick={action.onClick}
                className={
                  index === 0
                    ? "inline-flex min-h-[44px] min-w-[240px] cursor-pointer items-center justify-center rounded-full bg-cta-primary-bg px-7 py-3 text-sm font-bold text-cta-primary-fg transition-transform duration-200 hover:scale-[1.03] hover:bg-cta-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.98]"
                    : "inline-flex min-h-[44px] min-w-[240px] cursor-pointer items-center justify-center rounded-full border border-line-strong bg-fill-subtle px-7 py-3 text-sm font-semibold text-content-secondary backdrop-blur-md transition-transform duration-200 hover:scale-[1.03] hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] active:scale-[0.98]"
                }
              >
                {action.label}
              </button>
            ))}
          </div>
          {props.footer ? <p className="mt-9 text-xs leading-relaxed text-content-tertiary">{props.footer}</p> : null}
        </div>
      </div>
    </div>
  );
}
