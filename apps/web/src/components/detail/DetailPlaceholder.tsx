import { useNavigate } from "react-router-dom";
import { PageProblem, usePageProblemModel } from "../problems/PageProblem";

interface DetailPlaceholderProps {
  /** La requête de l'item a échoué et la fiche n'a rien à montrer. */
  failed: boolean;
  /** Une nouvelle tentative est en cours. */
  retrying: boolean;
  onRetry: () => void;
  /** L'erreur de la requête : sa cause se dit (fiche retirée, serveur muet, session expirée). */
  error?: unknown;
}

/**
 * Ce que la fiche montre tant qu'elle n'a pas son item : l'attente, ou l'échec.
 *
 * **Un échec n'est pas une attente.** La fiche ne distinguait pas les deux :
 * `isLoading || !item` gardait le spinner, si bien qu'une requête en erreur —
 * un 500 de Jellyfin, un 404, une coupure au-delà des reprises — le laissait
 * tourner À VIE. Sur un téléviseur : un rond de 40 px sur fond noir, le focus
 * sur `<body>` et rien à viser (reproduit au simulateur webOS 25, toujours là
 * une fois la panne levée). On dit ce qui se passe, et l'on offre de réessayer
 * ou de revenir.
 *
 * L'échec parle le modèle commun (`PageProblem`) : la cause de l'erreur, ses
 * gestes, les détails repliés. Le geste principal prend le focus : sur une
 * dalle, l'échec arrive après les reprises réseau, bien au-delà du délai où le
 * moteur pose lui-même l'anneau d'un écran.
 */
export function DetailPlaceholder({ failed, retrying, onRetry, error }: DetailPlaceholderProps) {
  const navigate = useNavigate();
  const model = usePageProblemModel(failed ? error ?? new Error("item") : null, { availability: { canGoBack: true } });

  if (!failed || !model) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line-strong border-t-content-primary" />
      </div>
    );
  }

  return (
    <PageProblem
      fullScreen
      model={model}
      busy={retrying ? "retry" : null}
      onAction={(key) => (key === "retry" ? onRetry() : key === "signIn" ? navigate("/login") : navigate(-1))}
    />
  );
}
