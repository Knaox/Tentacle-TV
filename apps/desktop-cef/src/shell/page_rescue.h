#pragma once
// Le garde-fou de l'affichage de la page : un pilote ne doit jamais laisser l'app noire.
//
// La page arrive par une texture partagée (dmabuf sous Linux) que le compositeur importe. Trois
// façons de ne RIEN voir, relevées le 10/11/2026 (bench/noir) :
//   - l'import n'existe pas (EGL sans dma_buf_import) : su avant de créer la page — elle est
//     alors peinte en logiciel (OnPaint), sans rien noter ;
//   - l'import est REFUSÉ image après image (pilote, modificateur) : su dans le lancement ;
//   - le processus GPU de Chromium meurt en boucle (« GPU process isn't usable. Goodbye. ») :
//     l'app sort avant d'avoir rien montré.
// Deux filets, sur le modèle du secours de session d'Electron (`sessionRescue.ts`) :
//   1. le TÉMOIN (`page-essai`) : posé au lancement, effacé à la PREUVE d'affichage (une image
//      de la page importée). Encore là au lancement suivant : le précédent n'a jamais montré
//      la page, quelle qu'en soit la cause — secours « sans GPU » ;
//   2. le REFUS constaté : secours « peinture logicielle », et l'app se relance d'elle-même.
// Le secours vaut `kRescueLaunches` lancements, puis la voie accélérée est retentée : un faux
// positif (app tuée avant sa première image) coûte quelques lancements plus lents, jamais un
// écran noir, et un pilote réparé retrouve sa voie rapide tout seul.
// Règle sans CEF ni SDL : un dossier, deux fichiers.

#include <string>

namespace tentacle::rescue {

constexpr int kRescueLaunches = 5;
constexpr const char* kWitnessFile = "page-essai";
constexpr const char* kRescueFile = "page-secours.json";

enum class Mode {
  accelerated,    // texture partagée (dmabuf) : zéro copie
  softwarePaint,  // OnPaint : Chromium garde son GPU, la page nous arrive en octets
  noGpu,          // OnPaint ET Chromium sans GPU (--disable-gpu) : rien ne dépend du pilote
};

struct Decision {
  Mode mode = Mode::accelerated;
  std::string reason;  // pour le journal ; vide en voie accélérée
  int launchesLeft = 0;  // lancements de secours restants APRÈS celui-ci
};

/// Au lancement, avant CEF. `forced` : TENTACLE_NO_SHARED_TEXTURE (outil d'essai : ni témoin ni
/// secours ne bougent). Écrit le témoin ou décompte le secours.
Decision atStartup(const std::string& dir, bool forced);
/// La décision de CE lancement (voie accélérée tant que `atStartup` n'a pas été appelé : macOS,
/// Windows). Le Shell y lit s'il crée la page en texture partagée.
const Decision& current();
/// Ce lancement a passé la main à l'instance qui tourne déjà : il n'essayait rien — son témoin
/// est retiré, son lancement de secours rendu.
void startupHandedOff(const std::string& dir);
/// La preuve d'affichage : une image de la page est arrivée par la voie accélérée.
void pageShown(const std::string& dir);
/// La voie accélérée ne donne rien dans CE lancement : les suivants peindront en logiciel.
void acceleratedRefused(const std::string& dir, const std::string& reason);
/// La ligne du journal d'une décision de secours ("" en voie accélérée).
std::string describe(const Decision& d);

/// La santé de l'import, image après image (règle pure) : `note` rend vrai UNE fois, quand il
/// faut conclure que la voie accélérée ne donne rien — trois refus d'affilée sans aucune image
/// réussie (pilote qui refuse d'emblée), ou deux secondes de refus après des réussites.
class ImportHealth {
 public:
  bool note(bool imported);
  bool everImported() const { return imported_ > 0; }

 private:
  unsigned long long imported_ = 0;
  int failuresInARow_ = 0;
  bool concluded_ = false;
};
constexpr int kRefusalsAtStart = 3;
constexpr int kRefusalsLater = 120;

}  // namespace tentacle::rescue
