import { useTranslation } from "react-i18next";
import { magasinCarteASuivre, magasinDecompteEnchainement } from "@/lib/enchainementEpisode";
import { useCarteASuivre, useDecompteEnchainement } from "@/hooks/useEnchainementEpisode";
import { magasinSautIntro, useSautIntroAuto } from "../../playback/sautIntroAuto";

/**
 * Les réglages d'appareil de l'écran de lecture — ce que le lecteur a le droit
 * de faire tout seul.
 *
 * Deux boutons plutôt qu'un interrupteur : à la télécommande, un pouce qui
 * coulisse ne veut rien dire. Même grammaire que la langue d'interface, juste
 * en dessous.
 *
 * Extrait de `PlaybackScreenTv` pour tenir le budget de 300 lignes par fichier.
 *
 * Les deux réglages de fin d'épisode empruntent le magasin du CLIENT WEB
 * (`@/lib/enchainementEpisode`) et non un magasin local : c'est celui que lisent
 * les surcouches du lecteur sur cette même cible. Deux magasins pour une seule
 * clé de `localStorage` s'accorderaient au redémarrage, mais pas pendant la
 * session — le réglage changé ici ne préviendrait pas le lecteur.
 */

interface SectionProps {
  titre: string;
  aide: string;
  actif: boolean;
  onChoisir: (actif: boolean) => void;
}

function SectionReglage({ titre, aide, actif, onChoisir }: SectionProps) {
  const { t } = useTranslation("preferences");
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-content-tertiary">
        {titre}
      </h2>
      <p className="mb-4 max-w-3xl text-[15px] leading-relaxed text-content-tertiary">{aide}</p>
      <div className="flex gap-4">
        {[
          { valeur: true, libelle: t("reglageActive") },
          { valeur: false, libelle: t("reglageDesactive") },
        ].map((choix) => (
          <button
            key={String(choix.valeur)}
            type="button"
            className="bouton-reglage-tv"
            data-actif={actif === choix.valeur}
            onClick={() => onChoisir(choix.valeur)}
          >
            <span className="bouton-reglage-tv-valeur">{choix.libelle}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Les trois réglages d'appareil, dans l'ordre où ils surviennent à l'écran :
 *  le générique de début, puis la fin de l'épisode. */
export function ReglagesLectureTv() {
  const { t } = useTranslation("preferences");
  const sautIntroActif = useSautIntroAuto();
  const carteActive = useCarteASuivre();
  const decompteActif = useDecompteEnchainement();

  return (
    <>
      <SectionReglage
        titre={t("autoSkipIntroTitle")}
        aide={t("autoSkipIntroHint")}
        actif={sautIntroActif}
        onChoisir={(actif) => magasinSautIntro.definir(actif)}
      />
      <SectionReglage
        titre={t("upNextCardTitle")}
        aide={t("upNextCardHint")}
        actif={carteActive}
        onChoisir={(actif) => magasinCarteASuivre.definir(actif)}
      />
      <SectionReglage
        titre={t("upNextCountdownTitle")}
        aide={t("upNextCountdownHint")}
        actif={decompteActif}
        onChoisir={(actif) => magasinDecompteEnchainement.definir(actif)}
      />
    </>
  );
}
