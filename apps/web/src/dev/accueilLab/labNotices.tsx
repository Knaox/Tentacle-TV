/**
 * Les avis du labo : la carte d'avertissement (`NoticeCard`) dans ses trois gravités, posée
 * comme `NoticeHost` la pose, et les messages brefs (`Toast`) dans leurs trois tons — ceux-là
 * sont de vrais avis, levés par le fournisseur de l'application au clic.
 */

import { NoticeCard } from "../../components/notices/NoticeCard";
import { useToast } from "../../contexts/ToastContext";

const noop = () => undefined;
const COUNTDOWN = { running: true, secondsLeft: 12 };

export function LabNotices() {
  const toast = useToast();
  return (
    <section data-lab-view="avis" className="row-gutter pt-6">
      <h2 className="mb-4 text-heading-2 text-content-primary">Avis</h2>
      <div className="flex flex-col items-start gap-3">
        <div className="w-[min(28rem,100%)]">
          <NoticeCard
            severity="blocking"
            icon="server"
            title="Serveur à mettre à jour"
            lines={["Cette application demande le serveur 1.41.0 ; le vôtre est en 1.17.0."]}
            primary={{ label: "Voir comment faire", onClick: noop }}
            countdown={null}
            durationMs={null}
            onClose={noop}
          />
        </div>
        <div className="w-[min(28rem,100%)]">
          <NoticeCard
            severity="recommendation"
            icon="key"
            title="Clé TMDB manquante"
            lines={["Sans elle, ni recommandations ni tendances."]}
            primary={{ label: "Ajouter la clé", onClick: noop }}
            secondary={{ label: "Ne plus afficher", onClick: noop }}
            countdown={COUNTDOWN}
            durationMs={12_000}
            onClose={noop}
          />
        </div>
        <div className="w-[min(28rem,100%)]">
          <NoticeCard
            severity="info"
            icon="check"
            lines={["Vous ne verrez plus ce rappel."]}
            primary={{ label: "Annuler", onClick: noop }}
            countdown={COUNTDOWN}
            durationMs={12_000}
            onClose={noop}
          />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn btn-soft" onClick={() => toast.show("success", "Ajouté à Ma liste", { action: { label: "Annuler", onPress: noop } })}>
          Avis de réussite
        </button>
        <button type="button" className="btn btn-soft" onClick={() => toast.show("error", "Le serveur n'a pas répondu.", { title: "Le favori n'a pas été enregistré" })}>
          Avis d'échec
        </button>
        <button type="button" className="btn btn-soft" onClick={() => toast.show("info", "Lecture reprise sur cet appareil.")}>
          Avis d'information
        </button>
      </div>
    </section>
  );
}
