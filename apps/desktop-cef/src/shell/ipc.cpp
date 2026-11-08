#include "shell/ipc.h"

#include <atomic>
#include <cstdio>
#include <map>

#include "shell/ipc_protocol.h"
#include "shell/main_thread.h"

namespace tentacle::ipc {

struct Responder::State {
  CefRefPtr<CefFrame> frame;
  int id = 0;
  std::atomic<bool> done{false};
};

namespace {

std::map<std::string, Handler>& handlers() {
  static std::map<std::string, Handler> h;
  return h;
}
std::vector<std::string>& scripts() {
  static std::vector<std::string> s;
  return s;
}
std::vector<CefRefPtr<CefBrowser>>& browsers() {
  static std::vector<CefRefPtr<CefBrowser>> b;
  return b;
}

void sendReply(CefRefPtr<CefFrame> frame, int id, bool ok, const std::string& result,
               const std::string& code, const std::string& message) {
  auto msg = CefProcessMessage::Create(proto::kReply);
  auto list = msg->GetArgumentList();
  list->SetInt(0, id);
  list->SetBool(1, ok);
  list->SetString(2, result);
  list->SetString(3, code);
  list->SetString(4, message);
  if (frame->IsValid()) frame->SendProcessMessage(PID_RENDERER, msg);
}

void onMain(std::function<void()> fn) {
  if (onMainThread()) {
    fn();
  } else {
    postToMain(std::move(fn));
  }
}

}  // namespace

void Responder::reply(Json result) const {
  if (!s_ || s_->done.exchange(true)) return;
  auto s = s_;
  std::string json = result.dump();
  onMain([s, json] { sendReply(s->frame, s->id, true, json, "", ""); });
}

void Responder::fail(std::string code, std::string message) const {
  if (!s_ || s_->done.exchange(true)) return;
  auto s = s_;
  onMain([s, code, message] { sendReply(s->frame, s->id, false, "", code, message); });
}

void registerHandler(std::string channel, Handler handler) {
  handlers()[std::move(channel)] = std::move(handler);
}

void unregisterHandler(const std::string& channel) { handlers().erase(channel); }

void emit(std::string event, Json payload) {
  std::string json = payload.dump();
  onMain([event = std::move(event), json] {
    for (auto& b : browsers()) {
      auto msg = CefProcessMessage::Create(proto::kEvent);
      msg->GetArgumentList()->SetString(0, event);
      msg->GetArgumentList()->SetString(1, json);
      b->GetMainFrame()->SendProcessMessage(PID_RENDERER, msg);
    }
  });
}

void registerInjectedScript(std::string js) { scripts().push_back(std::move(js)); }

const std::vector<std::string>& injectedScripts() { return scripts(); }

void attachBrowser(CefRefPtr<CefBrowser> browser) { browsers().push_back(browser); }

void detachBrowser(CefRefPtr<CefBrowser> browser) {
  auto& v = browsers();
  std::erase_if(v, [&](const CefRefPtr<CefBrowser>& b) { return b->IsSame(browser); });
}

bool onProcessMessage(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                      CefRefPtr<CefProcessMessage> message) {
  if (message->GetName() != proto::kInvoke) return false;
  auto list = message->GetArgumentList();
  auto state = std::make_shared<Responder::State>();
  state->frame = frame;
  state->id = list->GetInt(0);
  Responder responder(state);
  const std::string channel = list->GetString(1).ToString();
  Json payload = Json::parse(list->GetString(2).ToString(), nullptr, /*exceptions=*/false);
  if (payload.is_discarded()) {
    responder.fail("bad_payload", "JSON illisible pour " + channel);
    return true;
  }
  auto it = handlers().find(channel);
  if (it == handlers().end()) {
    responder.fail("no_handler", "aucun gestionnaire pour « " + channel + " »");
    return true;
  }
  // Une exception d'un gestionnaire ne doit pas tuer le processus : on la renvoie à la page.
  try {
    it->second(payload, responder);
  } catch (const std::exception& e) {
    std::fprintf(stderr, "[ipc] %s : exception %s\n", channel.c_str(), e.what());
    responder.fail("handler_exception", e.what());
  }
  return true;
}

}  // namespace tentacle::ipc
