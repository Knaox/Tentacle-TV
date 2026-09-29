import { PageTransition } from "../components/PageTransition";
import { GuideAdmin } from "../components/help/GuideAdmin";
import { GuideEveryone } from "../components/help/GuideEveryone";
import { GuideHeader } from "../components/help/GuideHeader";
import { GuideHiddenNote } from "../components/help/GuideHiddenNote";
import { GuideStatus } from "../components/help/GuideStatus";
import { useGuideLinkContext } from "../components/help/useGuideLinkContext";
import { useHashTarget } from "../components/admin/services/useHashTarget";
import { useBackOrHome } from "../mirror/catalog/useBackOrHome";
import { useMirror } from "../mirror/useFormFactor";

/**
 * Le guide « Bandes-annonces » (`/help/trailers`) — la même page au bureau et
 * au téléphone (miroir), comme « Vos statistiques » : une colonne de lecture,
 * « Pour tous » puis « Pour l'administrateur ». Le lien discret des fiches y
 * mène, la vue d'ensemble de l'administration vise `#admin`, l'Aide la liste.
 *
 * La structure et les mots viennent du modèle partagé (`help/trailerGuide.ts`,
 * espace `trailerHelp`) : le mobile rend exactement le même guide.
 *
 * ⚠️ Hors du périmètre webOS : `lazyPagesTv.tsx` l'exporte en écran
 * « indisponible » — le téléviseur n'en montre qu'une phrase qui renvoie ici.
 */
export function TrailerGuide() {
  const mirror = useMirror();
  const back = useBackOrHome();
  const ctx = useGuideLinkContext();
  // `/help/trailers#admin` mène à la partie administrateur, à l'arrivée comme
  // depuis le sommaire — la page est entière dès son premier rendu.
  useHashTarget(true);

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-8">
        <GuideHeader onBack={mirror ? back : undefined} />
        <GuideStatus isAdmin={ctx.isAdmin} />
        <div className="mt-10 space-y-16">
          <GuideEveryone isAdmin={ctx.isAdmin} />
          <GuideAdmin ctx={ctx} touch={mirror} />
        </div>
        <GuideHiddenNote />
      </div>
    </PageTransition>
  );
}
