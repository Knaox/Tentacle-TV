import { useCallback, useEffect, useState } from "react";
import { UpdateModal, type UpdateState } from "../../components/UpdateModal";
import type { UpdatePhase } from "../../lib/updateTypes";
import { labParam } from "./labFixtures";
import { LabPlayerWeb } from "./labPlayerWeb";

const NOTES = [
  "• Lecteur — Les contrôles tiennent dans deux capsules, la jauge de lecture porte le dégradé du logo.",
  "• Pistes — « Garder pour toute la série » dit ce qu'il garde : l'audio, les sous-titres et leur mode.",
  "• Regarder ensemble — Les invitations, la salle et le chat parlent la même langue que le reste.",
].join("\n");

const START: Record<string, { phase: UpdatePhase; progress?: number; indeterminate?: boolean; error?: string; store?: boolean }> = {
  disponible: { phase: "available" },
  telechargement: { phase: "downloading", progress: 42 },
  magasin: { phase: "downloading", indeterminate: true },
  installation: { phase: "installing", progress: 100 },
  redemarrage: { phase: "restarting", progress: 100 },
  erreur: { phase: "available", error: "notifications:updateStoreUnavailable" },
  appstore: { phase: "available", store: true },
};

/**
 * La pop-up de mise à jour PAR-DESSUS un lecteur en lecture (`?etat=` : disponible,
 * telechargement, magasin, installation, redemarrage, erreur, appstore). « Mettre à jour » lance
 * un téléchargement factice : la pop-up passe en cours et VERROUILLE — c'est ce que le banc
 * éprouve (`bench/lecteur/updateBlock.mjs`).
 */
export function LabUpdate() {
  const start = START[labParam("etat") ?? "disponible"] ?? START.disponible;
  const [phase, setPhase] = useState<UpdatePhase>(start.phase);
  const [progress, setProgress] = useState(start.progress ?? 0);
  const [error, setError] = useState<string | null>(start.error ?? null);
  const [open, setOpen] = useState(true);

  // Le téléchargement factice n'avance que s'il a été LANCÉ ici (une capture garde son état).
  const [launched, setLaunched] = useState(false);
  useEffect(() => {
    if (!launched || phase !== "downloading") return undefined;
    const id = setInterval(() => setProgress((value) => Math.min(96, value + 2)), 400);
    return () => clearInterval(id);
  }, [launched, phase]);

  const installUpdate = useCallback(async () => {
    setError(null);
    setProgress(4);
    setLaunched(true);
    setPhase("downloading");
  }, []);
  const dismiss = useCallback(() => setOpen(false), []);

  const update: UpdateState = {
    available: open, phase, version: "1.43.0", notes: NOTES, downloading: phase === "downloading",
    progress, indeterminate: start.indeterminate === true && !launched, error,
    isStoreUpdate: start.store === true, storeOpened: false, installUpdate, dismiss,
  };

  return (
    <>
      <LabPlayerWeb />
      <UpdateModal update={update} />
    </>
  );
}
