/**
 * La surface vidéo sur Wayland : deux fenêtres plein écran, et rien à caler.
 *
 * # Pourquoi il n'y a rien à caler
 *
 * Wayland n'autorise pas un client à donner une position à ses fenêtres — c'est
 * une règle du protocole, pas un manque. La fenêtre de mpv ne peut donc pas être
 * posée sur la nôtre au pixel près, comme le fait `videoWindow.ts` sous Windows.
 * Le plein écran est la seule géométrie où la question ne se pose plus : les
 * deux fenêtres couvrent la même sortie, et le compositeur s'occupe du reste.
 *
 * # Le seul calage qui reste : l'ÉCRAN, et il se joue AVANT le loadfile
 *
 * mpv sait viser un écran (`fs-screen-name`, nom de CONNECTEUR — `DP-4`), mais
 * ne le lit qu'à l'ENTRÉE en plein écran de sa fenêtre — c'est-à-dire à sa
 * naissance, au premier `loadfile`. Écrit après coup, le réglage ne déplace
 * plus rien : mesuré, la « re-visée tardive » du banc ne changeait strictement
 * rien (docs/LINUX-FENETRE-VIDEO.md, « L'empilement multi-écrans »).
 *
 * D'où la forme d'`attach()` : il est ASYNCHRONE, et le handler `mpv_init` ne
 * répond à la page qu'une fois `fs-screen-name` posé. La page n'envoie
 * `loadfile` qu'après la réponse — la course n'existe pas.
 *
 * L'écran lui-même est identifié par ce que la PAGE mesure (`displayTarget.ts`) :
 * sur Wayland, `getBounds()` rend (0,0) pour toute fenêtre et la visée par
 * bounds désignait l'écran posé à l'origine — mesurée fausse, supprimée. Quand
 * la mesure ne désigne rien (écrans jumeaux, page muette), on n'écrit RIEN :
 * mpv choisit seul, et un choix libre vaut mieux qu'un ordre faux.
 *
 * # Qui est devant : la fenêtre plein écran ACTIVE — l'activation décide
 *
 * Mesuré sur KWin (relevé de couches à l'appui) : la fenêtre plein écran
 * ACTIVE est promue dans sa propre couche (5), au-dessus de tout ; l'autre
 * retombe en couche normale (2). Celle de mpv naît au `loadfile`, APRÈS la
 * nôtre, et le compositeur active volontiers une fenêtre neuve : la vidéo
 * recouvrait l'interface (100 % de vidéo, 0 % de repères).
 *
 * Le remède n'est PAS un geste de fenêtre — tous mesurés morts ou nuisibles :
 * `setAlwaysOnTop` est inerte sur Wayland (couche inchangée) ; un `hide()` +
 * `show()` DONNE l'activation à mpv puis laisse le compositeur replacer notre
 * fenêtre sur l'écran où l'utilisateur s'active — fenêtrée, ailleurs, injouable.
 * Le remède est l'ACTIVATION elle-même : demander le focus une fois la fenêtre
 * de mpv née (+300 ms après `file-loaded`). Portée par le jeton du clic
 * « lecture », la demande est honorée ; refusée (lecture lancée sans geste
 * utilisateur), la première activation venue — clic, alt-tab — remet
 * l'interface devant : mesuré, l'activation seule rend 94,4 % de vidéo au
 * travers et les deux repères pleins.
 *
 * # Ce que ça coûte, et qui l'a décidé
 *
 * La lecture en fenêtre n'existe pas sur Wayland. C'est le prix du HDR, qui
 * n'existe QUE là (X11 n'en aura jamais). L'utilisateur qui préfère l'inverse
 * bascule le réglage de session sur `x11` — voir `sessionGraphique.ts`.
 *
 * Conséquence directe : tant qu'une vidéo est attachée, la fenêtre RESTE en
 * plein écran. En sortir laisserait la vidéo de mpv couvrir tout l'écran
 * derrière une fenêtre réduite — un film que plus rien ne commande.
 */

import type { BrowserWindow } from "electron";
import { connecteurPourLibelle, ecransConnectes } from "./ecrans";
import { libelleUneFoisMappee } from "./displayTarget";
import { setProperty } from "../video/mpv";
import type { VideoSurface } from "../video/surface";

/**
 * Le délai entre `file-loaded` et la reprise d'activation, MESURÉ au banc — le
 * temps que la fenêtre de mpv soit née et mappée. Demander le focus AVANT sa
 * naissance serait un coup d'épée dans l'eau : elle arriverait après nous et
 * reprendrait le dessus. Ne pas retoucher sans re-mesurer
 * (docs/LINUX-FENETRE-VIDEO.md, « L'empilement multi-écrans »).
 */
const DELAI_ACTIVATION_MS = 300;

export class SurfaceWayland implements VideoSurface {
  /** L'état du plein écran avant la lecture, pour le rendre en sortant. */
  private avant: boolean | null = null;
  /** Dernier écran visé, pour ne pas réécrire la même propriété. */
  private dernierConnecteur: string | null = null;
  /** Dernier motif d'échec tracé, pour n'avertir qu'une fois par cause. */
  private dernierAvertissement: string | null = null;
  /** Coupe les visées en vol : `detach()` ouvre une ère nouvelle. */
  private ere = 0;
  /** La reprise d'activation en attente — une à la fois, annulée au détachement. */
  private minuterieActivation: ReturnType<typeof setTimeout> | null = null;
  private readonly reprendrePleinEcran = (): void => {
    if (this.avant === null || this.host.isDestroyed()) return;
    // Deux fenêtres plein écran, dont une seule est commandable : en sortir
    // laisserait la vidéo couvrir l'écran sans plus rien pour l'arrêter.
    console.info("[video] Wayland : plein écran réaffirmé, la vidéo y est liée");
    this.host.setFullScreen(true);
  };

  constructor(private readonly host: BrowserWindow) {}

  async attach(): Promise<void> {
    if (this.host.isDestroyed()) return;
    this.avant = this.host.isFullScreen();
    this.host.setFullScreen(true);
    // L'activation est ce qui fixe l'ordre : notre fenêtre devient la dernière
    // servie, celle de mpv ne le demande jamais (`focus-on=never`).
    this.host.focus();
    this.host.on("leave-full-screen", this.reprendrePleinEcran);
    // La visée AVANT de rendre la main — voir l'en-tête. Le compositeur met
    // ~200 ms à mapper le plein écran ; l'attente vit dans `displayTarget.ts`.
    await this.viserALaMesure();
  }

  /**
   * L'écran se rejoue — un changement de géométrie peut vouloir dire que la
   * fenêtre a changé de moniteur. Sans effet sur le fichier en cours (mpv ne
   * relit `fs-screen-name` qu'en entrant en plein écran) : c'est pour le
   * prochain chargement.
   */
  align(): void {
    void this.viserALaMesure();
  }

  /** Mesure la page, rapproche un connecteur, écrit `fs-screen-name`. */
  private async viserALaMesure(): Promise<void> {
    if (this.host.isDestroyed()) return;
    const ere = this.ere;
    const libelle = await libelleUneFoisMappee(this.host, {
      encore: () => this.ere === ere,
    });
    if (this.ere !== ere || this.host.isDestroyed()) return;
    if (libelle === null) {
      this.avertirUneFois(
        "mesure",
        "[video] écran non identifié par la mesure de la page — mpv choisira",
      );
      return;
    }
    const connecteur = connecteurPourLibelle(libelle, ecransConnectes());
    if (connecteur === null) {
      this.avertirUneFois(
        `libelle:${libelle}`,
        `[video] écran « ${libelle} » non rapproché d'un connecteur — mpv choisira`,
      );
      return;
    }
    if (connecteur === this.dernierConnecteur) return;
    this.dernierConnecteur = connecteur;
    console.info(`[video] mpv visera ${connecteur} (${libelle})`);
    const erreur = await setProperty("fs-screen-name", connecteur);
    if (erreur !== null) {
      console.warn(`[video] fs-screen-name → ${connecteur} refusé : ${erreur}`);
    }
  }

  /** mpv vient d'ouvrir un fichier : sa fenêtre naît, et sera peut-être activée. */
  fichierCharge(): void {
    // Une reprise à la fois : un second `file-loaded` pendant l'attente n'en
    // rajoute pas, et une surface détachée ou jamais attachée ne bouge plus.
    if (this.minuterieActivation !== null || this.avant === null || this.host.isDestroyed()) return;
    this.minuterieActivation = setTimeout(() => {
      this.minuterieActivation = null;
      this.repasserDevant();
    }, DELAI_ACTIVATION_MS);
  }

  /** Demander l'activation — RIEN d'autre : jamais de hide(), voir l'en-tête. */
  private repasserDevant(): void {
    if (this.avant === null || this.host.isDestroyed()) return;
    this.host.focus();
    console.info("[video] Wayland : activation demandée pour repasser devant la vidéo");
  }

  /** Un avertissement par cause : la visée se rejoue, le journal ne doit pas. */
  private avertirUneFois(cle: string, message: string): void {
    if (this.dernierAvertissement === cle) return;
    this.dernierAvertissement = cle;
    console.warn(message);
  }

  /** Rien à désarmer : `focus-on=never` suffit, la fenêtre de mpv ne prend rien. */
  harden(): boolean {
    return false;
  }

  detach(): void {
    this.ere++;
    if (this.minuterieActivation !== null) {
      clearTimeout(this.minuterieActivation);
      this.minuterieActivation = null;
    }
    if (this.host.isDestroyed()) return;
    this.host.removeListener("leave-full-screen", this.reprendrePleinEcran);
    const avant = this.avant;
    this.avant = null;
    this.dernierConnecteur = null;
    this.dernierAvertissement = null;
    // On ne défait QUE le plein écran qu'on a posé : celui d'un utilisateur qui
    // parcourait déjà son catalogue ainsi ne nous appartient pas.
    if (avant === false) this.host.setFullScreen(false);
  }

  geometrie(): string {
    if (this.host.isDestroyed()) return "fenêtre détruite";
    const b = this.host.getBounds();
    const ecran = this.dernierConnecteur ?? "auto";
    return `wayland hôte=${b.width}x${b.height}+${b.x}+${b.y} pleinÉcran=${this.host.isFullScreen()} écran=${ecran}`;
  }
}
