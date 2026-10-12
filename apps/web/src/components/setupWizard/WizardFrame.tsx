import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Server } from "lucide-react";
import type { SetupPackaging, SetupSelection, SetupStep } from "@tentacle-tv/shared";
import { SetupHelp } from "./SetupHelp";
import { WizardFooter, type WizardAction } from "./WizardFooter";
import { WizardHeader } from "./WizardHeader";

export type { WizardAction } from "./WizardFooter";

/** Ce que le cadre lit de l'assistant : l'écran, sa place, le retour, le Jellyfin choisi, de quoi répondre à « Besoin d'aide ? ». */
export interface WizardFrameState {
  step: SetupStep;
  position: number;
  total: number;
  back: (() => void) | undefined;
  server: SetupSelection | null;
  data: { context: { flow: { noLibraries?: boolean }; packaging?: SetupPackaging } | null };
}

export interface WizardFrameProps {
  wizard: WizardFrameState;
  title: string;
  subtitle?: ReactNode;
  /** Le nombre d'écrans n'est pas encore connu (accueil, avant de savoir si le code sera demandé). */
  hideProgress?: boolean;
  /** La livraison lue avant toute session (écran du code) ; sinon celle du contexte — l'app Windows a ses réponses. */
  helpPackaging?: SetupPackaging | null;
  /** Sous le titre, dans la colonne de gauche : ce qui explique l'écran (avantages, où sont les fichiers…). */
  aside?: ReactNode;
  primary?: WizardAction;
  secondary?: readonly WizardAction[];
  /** Une phrase dans le pied, près des boutons : ce qui manque pour continuer, ou ce qui va se passer. */
  status?: ReactNode;
  /**
   * `split` (défaut) : l'explication à gauche, l'action à droite — et, sans
   * rien à mettre à gauche (`aside` absent), UNE colonne centrée : le titre,
   * le panneau, l'aide, plutôt qu'une colonne vide sur toute la hauteur ;
   * `wide` : le titre en tête et le contenu sur toute la largeur (accès à distance).
   */
  layout?: "split" | "wide";
  /** Le contenu apporte ses propres encadrés : pas de panneau autour. */
  bare?: boolean;
  children: ReactNode;
}

/** Où va chaque bloc du corps, selon la mise en page (classes Tailwind écrites en entier : le JIT les lit telles quelles). */
const PLACEMENT = {
  split: {
    grid: "max-w-[92rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]",
    head: "lg:col-start-1 lg:row-start-1",
    panel: "lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start",
    help: "lg:col-start-1 lg:row-start-2 lg:self-start",
  },
  // Rien à gauche : une colonne centrée, dans l'ordre de lecture (titre, panneau, aide).
  single: { grid: "max-w-3xl", head: "", panel: "", help: "" },
  wide: {
    grid: "max-w-[92rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]",
    head: "lg:col-start-1 lg:row-start-1",
    panel: "lg:col-span-2 lg:row-start-2",
    help: "lg:col-start-2 lg:row-start-1 lg:self-start",
  },
} as const;

/** Les propriétés du cadre que l'écran fixe, quand un formulaire enfant décide des boutons (`CredentialsForm`, `TmdbKeyEntry`). */
export type WizardFrameBase = Omit<WizardFrameProps, "children" | "primary" | "secondary" | "status">;

/**
 * Le cadre PLEINE PAGE de chaque écran de l'assistant : l'en-tête (marque,
 * grandes étapes, progression), un corps qui prend la largeur — l'explication
 * à gauche, l'action dans un panneau à droite, une seule colonne sur un
 * téléphone —, et le pied FIXE (Retour, action principale). Seul le corps
 * défile, et seulement s'il le faut ; le pied ne recouvre jamais rien.
 *
 * La hauteur est celle de la fenêtre moins le bandeau de la coquille macOS
 * (`--hote-bandeau`, 0 ailleurs). Coût GPU : le fond est FIXE (deux dégradés
 * peints une fois), le panneau n'a AUCUN `backdrop-filter` — derrière lui ne
 * passe qu'un dégradé lisse, le flou n'y changerait rien et se recalculerait à
 * chaque défilement. L'entrée d'un écran est bornée, en `transform`/`opacity`.
 */
export function WizardFrame({ wizard, title, subtitle, hideProgress, helpPackaging, aside, primary, secondary, status, layout = "split", bare, children }: WizardFrameProps) {
  const { t } = useTranslation("setupWizard");
  const heading = useRef<HTMLHeadingElement>(null);
  // Un écran sans champ ni bouton focalisé d'office : le focus va au titre, pas au néant (lecteurs d'écran, clavier).
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) heading.current?.focus({ preventScroll: true });
  }, []);
  const wide = layout === "wide";
  const place = PLACEMENT[wide ? "wide" : aside ? "split" : "single"];
  const help = (
    <SetupHelp
      step={wizard.step}
      noLibraries={wizard.data.context?.flow.noLibraries ?? false}
      packaging={helpPackaging ?? wizard.data.context?.packaging ?? null}
    />
  );

  return (
    <div className="relative isolate flex h-[calc(100dvh-var(--hote-bandeau))] flex-col overflow-hidden bg-surface-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 60% at 0% 0%, rgba(var(--brand-rgb), 0.2) 0%, rgba(var(--brand-rgb), 0.05) 45%, transparent 72%)," +
            "radial-gradient(55% 55% at 100% 100%, rgba(var(--brand-accent-rgb), 0.13) 0%, transparent 70%)",
        }}
      />
      <WizardHeader step={wizard.step} position={wizard.position} total={wizard.total} hideProgress={hideProgress} />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className={`mx-auto grid w-full gap-x-14 gap-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 xl:gap-x-20 ${place.grid}`}
        >
          <section aria-labelledby="wizard-title" className={`min-w-0 animate-fade-slide-up ${place.head}`}>
            {hideProgress ? null : (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-light)] tabular-nums">
                {t("progress", { n: wizard.position, total: wizard.total })}
              </p>
            )}
            <h1 id="wizard-title" ref={heading} tabIndex={-1} className="mt-2 text-pretty text-3xl font-extrabold tracking-tight text-content-primary focus:outline-none lg:text-4xl">
              {title}
            </h1>
            {subtitle ? <p className="mt-3 max-w-prose text-base leading-relaxed text-content-secondary">{subtitle}</p> : null}
            {wizard.server ? <ChosenServer server={wizard.server} /> : null}
            {aside ? <div className="mt-6 space-y-4 text-sm leading-relaxed text-content-secondary">{aside}</div> : null}
          </section>

          <div
            className={`min-w-0 animate-fade-slide-up ${place.panel} ${
              bare ? "" : "rounded-2xl border border-line-subtle bg-fill-subtle p-5 shadow-[var(--elev-3)] sm:p-7"
            }`}
          >
            {children}
          </div>

          <div className={`min-w-0 ${place.help}`}>{help}</div>
        </div>
      </main>

      <WizardFooter onBack={wizard.back} primary={primary} secondary={secondary} status={status} />
    </div>
  );
}

/** « Jellyfin “Salon” · déjà configuré » : le serveur que l'on prépare, jamais dit par la couleur seule. */
function ChosenServer({ server }: { server: SetupSelection }) {
  const { t } = useTranslation("setupWizard");
  const name = server.serverName || t("jfUnnamed");
  return (
    <div
      role="note"
      aria-label={t("chosenLabel")}
      data-testid="setup-chosen-server"
      className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-line-subtle bg-fill-faint px-3 py-1.5 text-xs font-medium text-content-secondary"
    >
      <Server size={14} aria-hidden="true" className="shrink-0 text-content-tertiary" />
      <span className="break-words">
        {t("chosenServer", { name, state: t(`chosenState_${server.path}`) })}
        {server.inStack ? ` · ${t("chosenInStack")}` : ""}
      </span>
    </div>
  );
}
