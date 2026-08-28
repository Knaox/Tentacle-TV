import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import type { SegmentAction, SegmentSettings } from "@tentacle-tv/shared";

/**
 * Ce que le lecteur a le droit de faire tout seul, à la télécommande.
 *
 * Des boutons plutôt qu'un interrupteur : un pouce qui coulisse ne veut rien
 * dire sur une dalle. Même grammaire que la langue d'interface, juste au-dessus.
 *
 * Les réglages viennent du magasin de COMPTE (`playback_settings`), le même que
 * lisent les surcouches du lecteur sur cette cible : un réglage changé ici est
 * su du lecteur dans la seconde, et vaut sur les autres appareils du foyer.
 *
 * Le DÉLAI du saut automatique n'est pas offert ici, à dessein : saisir un
 * nombre à la télécommande est une punition, et le réglage suit le compte —
 * il se pose une fois depuis un ordinateur ou un téléphone, et il vaut pour la
 * télévision. Extrait de `PlaybackScreenTv` pour tenir les 300 lignes.
 */

interface Choix {
  valeur: string;
  libelle: string;
}

interface SectionProps {
  titre: string;
  aide: string;
  valeur: string;
  choix: Choix[];
  onChoisir: (valeur: string) => void;
}

function SectionReglage({ titre, aide, valeur, choix, onChoisir }: SectionProps) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-content-tertiary">
        {titre}
      </h2>
      <p className="mb-4 max-w-3xl text-[15px] leading-relaxed text-content-tertiary">{aide}</p>
      <div className="flex gap-4">
        {choix.map((c) => (
          <button
            key={c.valeur}
            type="button"
            className="bouton-reglage-tv"
            data-actif={valeur === c.valeur}
            onClick={() => onChoisir(c.valeur)}
          >
            <span className="bouton-reglage-tv-valeur">{c.libelle}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function estAction(valeur: string): valeur is SegmentAction {
  return valeur === "button" || valeur === "auto" || valeur === "off";
}

/**
 * Les passages d'un épisode, puis sa fin — dans l'ordre où ils surviennent.
 * Les trois réglages de fin restent STRICTEMENT indépendants : montrer la
 * fiche, décompter, enchaîner.
 */
export function ReglagesLectureTv() {
  const { t } = useTranslation("preferences");
  const reglages = usePlaybackSettings();

  const actions: Choix[] = [
    { valeur: "button", libelle: t("segmentActionButton") },
    { valeur: "auto", libelle: t("segmentActionAuto") },
    { valeur: "off", libelle: t("segmentActionOff") },
  ];
  const ouiNon: Choix[] = [
    { valeur: "oui", libelle: t("reglageActive") },
    { valeur: "non", libelle: t("reglageDesactive") },
  ];

  const passages: { cle: string; titre: string; aide: string; etat: SegmentSettings;
    appliquer: (patch: Partial<SegmentSettings>) => void }[] = [
    {
      cle: "intro",
      titre: t("segmentIntroTitle"),
      aide: t("segmentIntroHint"),
      etat: reglages.intro,
      appliquer: (intro) => { setPlaybackSettings({ intro }); },
    },
    {
      cle: "recap",
      titre: t("segmentRecapTitle"),
      aide: t("segmentRecapHint"),
      etat: reglages.recap,
      appliquer: (recap) => { setPlaybackSettings({ recap }); },
    },
    {
      cle: "outro",
      titre: t("segmentOutroTitle"),
      aide: t("segmentOutroHint"),
      etat: reglages.outro,
      appliquer: (outro) => { setPlaybackSettings({ outro }); },
    },
    {
      cle: "preview",
      titre: t("segmentPreviewTitle"),
      aide: t("segmentPreviewHint"),
      etat: reglages.preview,
      appliquer: (preview) => { setPlaybackSettings({ preview }); },
    },
  ];

  const suivant = reglages.next;

  return (
    <>
      {passages.map((passage) => (
        <SectionReglage
          key={passage.cle}
          titre={passage.titre}
          aide={passage.aide}
          valeur={passage.etat.action}
          choix={actions}
          onChoisir={(valeur) => {
            if (estAction(valeur)) passage.appliquer({ action: valeur });
          }}
        />
      ))}
      <SectionReglage
        titre={t("upNextCardTitle")}
        aide={t("upNextCardHint")}
        valeur={suivant.nextCard ? "oui" : "non"}
        choix={ouiNon}
        onChoisir={(valeur) => { setPlaybackSettings({ next: { nextCard: valeur === "oui" } }); }}
      />
      <SectionReglage
        titre={t("upNextCountdownTitle")}
        aide={t("upNextCountdownHint")}
        valeur={suivant.nextCountdown ? "oui" : "non"}
        choix={ouiNon}
        onChoisir={(valeur) => {
          setPlaybackSettings({ next: { nextCountdown: valeur === "oui" } });
        }}
      />
      <SectionReglage
        titre={t("upNextAutoPlayTitle")}
        aide={t("upNextAutoPlayHint")}
        valeur={suivant.nextAutoPlay ? "oui" : "non"}
        choix={ouiNon}
        onChoisir={(valeur) => {
          setPlaybackSettings({ next: { nextAutoPlay: valeur === "oui" } });
        }}
      />
    </>
  );
}
