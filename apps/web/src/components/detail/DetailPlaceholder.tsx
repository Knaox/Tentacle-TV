import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PageProblem, usePageProblemModel } from "../problems/PageProblem";

interface DetailPlaceholderProps {
  /** La requête de l'item a échoué et la fiche n'a rien à montrer. */
  failed: boolean;
  /** Une nouvelle tentative est en cours. */
  retrying: boolean;
  onRetry: () => void;
  /** L'erreur de la requête : sa cause se dit (fiche retirée, serveur muet, session expirée). */
  error?: unknown;
  /**
   * La fiche est là, ses images se décodent (`useDetailArrival`, 800 ms au
   * plus) : le fond seul, sans le rond d'attente — sur une image en cache, il
   * n'aurait été qu'un éclair.
   */
  quiet?: boolean;
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
export function DetailPlaceholder({ failed, retrying, onRetry, error, quiet = false }: DetailPlaceholderProps) {
  const navigate = useNavigate();
  const model = usePageProblemModel(failed ? error ?? new Error("item") : null, { availability: { canGoBack: true } });

  if (quiet && !failed) return <div className="h-screen bg-surface-0" />;

  if (!failed || !model) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        {/* Le rond ne paraît qu'après 400 ms : une fiche qui arrive vite n'en montre pas l'éclair. */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.2 }}>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-line-strong border-t-content-primary" />
        </motion.div>
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
