/**
 * Les états du labo : ce qu'une rangée et l'accueil montrent quand il n'y a rien à montrer —
 * l'attente, la rangée vide, la rangée en échec, la bibliothèque sans titre.
 */

import { EmptyLibraryState } from "../../components/home/EmptyLibraryState";
import { RecoRowSkeleton } from "../../components/reco/RecoRowSkeleton";
import { MediaRow } from "../../components/rows/MediaRow";
import { RowErrorState } from "../../components/rows/RowErrorState";

const noop = () => undefined;

export function LabStates() {
  return (
    <div data-lab-view="etats" className="pt-6">
      <RecoRowSkeleton />
      <MediaRow title="Une rangée vide" items={[]} />
      <RowErrorState title="Une rangée en échec" retrying={false} onRetry={noop} />
      <EmptyLibraryState />
    </div>
  );
}
