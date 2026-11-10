// La liste fermée des liens externes (`security.ts` → `openExternalSafely`) et les textes
// natifs (`quitGuard.ts`, `backgroundTransfers.ts`), mot pour mot.

#include "lifecycle/external_url.h"
#include "lifecycle/texts.h"
#include "tests/check.h"

using namespace tentacle::lifecycle;

void runExternalUrlTests() {
  CASE("les six schémas d'Electron passent");
  CHECK(externalUrlAllowed("https://tentacletv.app/aide"));
  CHECK(externalUrlAllowed("http://192.168.1.10:8096/web"));
  CHECK(externalUrlAllowed("mailto:contact@tentacletv.app"));
  CHECK(externalUrlAllowed("macappstore://apps.apple.com/app/id123"));
  CHECK(externalUrlAllowed("itms-apps://apps.apple.com/app/id123"));
  CHECK(externalUrlAllowed("ms-windows-store://pdp/?productid=9N"));
  CHECK(externalUrlAllowed("HTTPS://exemple.fr"));
  CASE("tout le reste est refusé : fichiers, scripts, schémas d'application, formes tordues");
  CHECK(!externalUrlAllowed("file:///etc/passwd"));
  CHECK(!externalUrlAllowed("javascript:alert(1)"));
  CHECK(!externalUrlAllowed("smb://serveur/partage"));
  CHECK(!externalUrlAllowed("tentacle://app/"));
  CHECK(!externalUrlAllowed("https:/sans-autorite"));
  CHECK(!externalUrlAllowed("https://"));
  CHECK(!externalUrlAllowed(" https://exemple.fr"));
  CHECK(!externalUrlAllowed("https://exemple.fr/\n"));
  CHECK(!externalUrlAllowed("pas une url"));
  CHECK(!externalUrlAllowed(""));

  CASE("textes de la boîte et de la notification, en français et en anglais");
  CHECK(quitTexts(1, true).message == "Un téléchargement est en cours.");
  CHECK(quitTexts(3, true).message == "3 téléchargements sont en cours.");
  CHECK(quitTexts(1, true).quitApp == "Quitter quand même" && quitTexts(1, true).cancelLabel == "Annuler");
  CHECK(quitTexts(2, false).message == "2 downloads are in progress.");
  CHECK(backgroundTransfersText(1, true).body == "Tentacle finit un téléchargement, puis se fermera.");
  CHECK(backgroundTransfersText(4, false).title == "Downloads in the background");
  CHECK(backgroundTransfersText(4, false).body == "Tentacle is finishing 4 downloads, then it will close.");
}
