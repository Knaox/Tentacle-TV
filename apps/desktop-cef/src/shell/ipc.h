#pragma once
// Plomberie IPC page ↔ natif (processus navigateur). Contrat : docs/INTERFACES.md.
//
//   page : window.__shell.invoke(channel, payload) → Promise ; window.__shell.on(ev, cb)
//   natif : registerHandler(channel, h) ; emit(event, payload) ; registerInjectedScript(js)
//
// Fil : registerHandler / emit / registerInjectedScript sur le fil principal (emit et
// Responder sont sûrs depuis n'importe quel fil : ils repassent par le fil principal).

#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "include/cef_browser.h"
#include "include/cef_process_message.h"
#include "shell/json.h"

namespace tentacle::ipc {

// Réponse à un invoke. Copiable ; la première réponse gagne, les suivantes sont ignorées.
// Si aucune réponse n'est jamais donnée, la promesse de la page reste en attente.
class Responder {
 public:
  struct State;
  explicit Responder(std::shared_ptr<State> s) : s_(std::move(s)) {}
  void reply(Json result = nullptr) const;
  void fail(std::string code, std::string message) const;

 private:
  std::shared_ptr<State> s_;
};

using Handler = std::function<void(const Json& payload, Responder responder)>;

// Un seul gestionnaire par canal ; réenregistrer remplace. Canal inconnu → la promesse est
// rejetée avec err.code === "no_handler". Charge utile illisible → "bad_payload".
void registerHandler(std::string channel, Handler handler);
void unregisterHandler(const std::string& channel);

// Diffuse vers le cadre principal de toutes les pages ouvertes.
void emit(std::string event, Json payload = nullptr);

// Script exécuté à la création de chaque contexte JS du cadre principal, après l'amorce de
// window.__shell et avant tout script de la page. À enregistrer AVANT la création du
// navigateur (les scripts voyagent dans extra_info de CreateBrowser).
void registerInjectedScript(std::string js);

// --- interne au socle ---------------------------------------------------------------
const std::vector<std::string>& injectedScripts();
void attachBrowser(CefRefPtr<CefBrowser> browser);
void detachBrowser(CefRefPtr<CefBrowser> browser);
bool onProcessMessage(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                      CefRefPtr<CefProcessMessage> message);

}  // namespace tentacle::ipc
