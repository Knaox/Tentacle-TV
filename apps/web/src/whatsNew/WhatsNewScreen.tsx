import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/ui/Modal";
import { ModalHeader } from "../components/ui/ModalHeader";
import { SceneMediaContext, useSceneMediaSource } from "./sceneMedia";
import type { WhatsNewSelection } from "./selectFeatures";
import type { WhatsNewSelectedFeature } from "./types";
import { useWhatsNewKeys } from "./useWhatsNewKeys";
import { WhatsNewFeatureList } from "./WhatsNewFeatureList";
import { WhatsNewFooter } from "./WhatsNewFooter";
import { WhatsNewStagePanel } from "./WhatsNewStagePanel";

interface WhatsNewScreenProps {
  open: boolean;
  selection: WhatsNewSelection | null;
  /** Quel que soit le geste : croix, Esc, scrim, Terminé, lien profond. */
  onClose: () => void;
}

/**
 * L'écran des nouveautés : une grande modale sur `Modal` — colonne des
 * nouveautés, scène active, texte, pied de navigation. Une seule scène montée
 * à la fois. La dernière sélection reste affichée le temps de la sortie
 * animée, une fois la porte refermée.
 */
export function WhatsNewScreen({ open, selection, onClose }: WhatsNewScreenProps) {
  const { t } = useTranslation("whatsNew");
  const lastRef = useRef<WhatsNewSelection | null>(null);
  if (selection) lastRef.current = selection;
  const shown = selection ?? lastRef.current;
  const features = shown?.features ?? [];
  const subtitle =
    shown?.spansReleases && shown.from
      ? t("whatsNew:subtitleSince", { version: shown.from })
      : shown?.to
        ? t("whatsNew:subtitleVersion", { version: shown.to })
        : undefined;
  // Une nouvelle sélection remet l'index à zéro : le corps est reconstruit.
  const bodyKey = features.map((f) => `${f.version}:${f.id}`).join("|");

  return (
    <Modal
      open={open && features.length > 0}
      onClose={onClose}
      maxWidth={980}
      labelledBy="whats-new-title"
      className="flex h-[min(760px,92vh)] flex-col"
    >
      <ModalHeader title={t("whatsNew:title")} subtitle={subtitle} onClose={onClose} titleId="whats-new-title" />
      {features.length > 0 && (
        <WhatsNewBody key={bodyKey} features={features} showVersion={shown?.spansReleases ?? false} onClose={onClose} />
      )}
    </Modal>
  );
}

interface WhatsNewBodyProps {
  features: WhatsNewSelectedFeature[];
  showVersion: boolean;
  onClose: () => void;
}

function WhatsNewBody({ features, showVersion, onClose }: WhatsNewBodyProps) {
  const [index, setIndex] = useState(0);
  const count = features.length;
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(count - 1, next))), [count]);
  useWhatsNewKeys({ index, count, go });
  const navigate = useNavigate();
  // Les vraies affiches des scènes : demandé ICI, corps monté seulement ouvert.
  const media = useSceneMediaSource();
  const feature = features[index];
  const openRoute = useCallback(() => {
    if (!feature.route) return;
    onClose();
    navigate(feature.route);
  }, [feature, navigate, onClose]);

  return (
    <SceneMediaContext.Provider value={media}>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr]">
        <WhatsNewFeatureList features={features} index={index} onSelect={go} />
        <WhatsNewStagePanel feature={feature} index={index} count={count} showVersion={showVersion} onOpenRoute={openRoute} />
      </div>
      <WhatsNewFooter index={index} count={count} onSelect={go} onDone={onClose} />
    </SceneMediaContext.Provider>
  );
}
