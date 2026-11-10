#pragma once
// Garde de sortie : on ne quitte pas sur un transfert en cours sans le demander (`quitGuard.ts`
// d'Electron, porté à l'identique).
//
// Le SEUL point de passage commun à la croix, à Alt+F4, à Cmd+Q et au menu « Quitter » est la
// demande de fermeture de la fenêtre. Ne JAMAIS piéger l'utilisateur : le loquet `confirmed`
// (l'accord donné, on ne redemande plus), le verrou `pending` (deux Alt+F4 n'empilent pas deux
// boîtes), et le repli sur la fermeture si la boîte échoue. La boîte est native (le natif la
// construit), elle s'affiche même si la page est occupée.

#include <functional>
#include <memory>

namespace tentacle::lifecycle {

/// La question ; `answer(true)` = quitter malgré tout. Une boîte qui échoue répond `true`.
using ExitRequest = std::function<void(int inProgress, std::function<void(bool quit)> answer)>;

class QuitGuard {
 public:
  /// `keepsTransfers` : « Continuer en arrière-plan » — fermer la fenêtre ne coupe rien, pas de
  /// question. Absente, ou qui lève : la question, comme avant.
  QuitGuard(std::function<int()> inProgress, ExitRequest ask, std::function<bool()> keepsTransfers = {});

  /// Une demande de fermeture. Vrai si elle est RETENUE (question posée ou en cours).
  /// `closeAgain` : ce que la garde rappelle après l'accord (le `window.close()` d'Electron),
  /// qui repasse ici et passe grâce au loquet.
  bool onClose(std::function<void()> closeAgain);

 private:
  std::function<int()> inProgress_;
  ExitRequest ask_;
  std::function<bool()> keepsTransfers_;
  // Partagé avec la réponse de la boîte, qui peut arriver après la garde.
  struct State {
    bool confirmed = false;
    bool pending = false;
  };
  std::shared_ptr<State> state_ = std::make_shared<State>();
};

}  // namespace tentacle::lifecycle
