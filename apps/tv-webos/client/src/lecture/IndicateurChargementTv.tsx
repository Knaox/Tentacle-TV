import { useTranslation } from "react-i18next";
import { useEtatLecteurTv } from "./etatLecteurTv";
import { useEtatRelanceTv } from "./etatRelanceTv";

/**
 * « Ça charge », dit à trois mètres.
 *
 * Le client web dispose déjà d'un indicateur en cours de lecture : un cercle de
 * quarante-huit pixels au centre de l'image. Sur un moniteur, il suffit. Sur
 * une dalle de quarante-deux pouces regardée à trois mètres, il fait la taille
 * d'un ongle et personne ne le voit — d'où le sentiment, mesuré chez
 * l'utilisateur, qu'il ne se passe RIEN pendant les transitions.
 *
 * Trois moments à couvrir, et le web n'en signalait aucun correctement :
 *
 * - **le saut hors du tampon**, que `useSmartSeek` annonce désormais (personne
 *   ne l'annonçait : il ne restait que l'événement `waiting`, débouncé de
 *   800 ms et émis au bon vouloir de la pile média) ;
 * - **le changement de piste**, qui reconstruit l'URL — 1,24 s mesurées ;
 * - **le rechargement de la veille de gel**, qui coupait l'image sans rien dire.
 *
 * Coût GPU : un voile STATIQUE et un anneau animé en `transform` seul. Aucun
 * `backdrop-filter` — il n'y a rien à réfracter par-dessus un décodeur, et la
 * passe de compositing serait payée à chaque image. Le calque n'existe que
 * pendant le chargement : rien n'est laissé monté à opacité nulle.
 */
export function IndicateurChargementTv({ loading, aDemarre }: { loading: boolean; aDemarre: boolean }) {
  const { t } = useTranslation("player");
  const lecteur = useEtatLecteurTv();
  const relance = useEtatRelanceTv();

  // Avant la première image, la bannière du web tient déjà l'écran : deux
  // indicateurs superposés diraient deux fois la même chose.
  const visible = (loading && aDemarre) || relance.enCours;
  // Rien pendant le déplacement : l'écran du curseur fantôme est plein cadre,
  // et c'est lui qu'on regarde. Même règle que les boutons « passer ».
  if (!visible || lecteur.mode === "scrub") return null;

  return (
    <div className="chargement-tv" role="status" aria-live="polite">
      <div className="chargement-tv__voile" />
      <div className="chargement-tv__contenu">
        <div className="chargement-tv__anneau" />
        <span className="chargement-tv__libelle">
          {relance.enCours ? t("player:resuming") : t("player:loading")}
        </span>
      </div>
    </div>
  );
}
