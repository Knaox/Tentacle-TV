// Côté rendu : pose window.__shell dans le contexte du cadre principal, exécute les
// scripts injectés (ordre d'enregistrement) avant tout script de la page, et relaie
// invoke/reply/event par CefProcessMessage.
//
// Pourquoi seulement le cadre principal : une iframe tierce n'a pas à piloter le lecteur.

#include "shell/renderer_ipc.h"

#include <cstdio>
#include <map>
#include <string>
#include <vector>

#include "shell/bootstrap_js.h"
#include "shell/ipc_protocol.h"

namespace tentacle::renderer {
namespace {

std::map<int, std::vector<std::string>> g_scripts;  // par identifiant de navigateur

struct FrameShell {
  CefRefPtr<CefV8Context> context;
  CefRefPtr<CefV8Value> dispatch;  // fonction JS enregistrée par l'amorce
};
std::map<std::string, FrameShell> g_frames;  // par identifiant de cadre

class NativeHandler final : public CefV8Handler {
 public:
  explicit NativeHandler(CefRefPtr<CefFrame> frame) : frame_(frame) {}

  bool Execute(const CefString& name, CefRefPtr<CefV8Value> object,
               const CefV8ValueList& args, CefRefPtr<CefV8Value>& retval,
               CefString& exception) override {
    if (name == "send") {
      if (args.size() != 3 || !args[0]->IsInt() || !args[1]->IsString() ||
          !args[2]->IsString()) {
        exception = "__shellNative.send(id, channel, json)";
        return true;
      }
      auto msg = CefProcessMessage::Create(ipc::proto::kInvoke);
      auto list = msg->GetArgumentList();
      list->SetInt(0, args[0]->GetIntValue());
      list->SetString(1, args[1]->GetStringValue());
      list->SetString(2, args[2]->GetStringValue());
      frame_->SendProcessMessage(PID_BROWSER, msg);
      return true;
    }
    if (name == "register") {
      if (args.size() != 1 || !args[0]->IsFunction()) {
        exception = "__shellNative.register(fn)";
        return true;
      }
      auto& fs = g_frames[frame_->GetIdentifier().ToString()];
      fs.context = CefV8Context::GetCurrentContext();
      fs.dispatch = args[0];
      return true;
    }
    return false;
  }

 private:
  CefRefPtr<CefFrame> frame_;
  IMPLEMENT_REFCOUNTING(NativeHandler);
};

void evalLogged(CefRefPtr<CefV8Context> context, const std::string& code, const char* what) {
  CefRefPtr<CefV8Value> ret;
  CefRefPtr<CefV8Exception> exc;
  if (!context->Eval(code, "tentacle://injected", 1, ret, exc) && exc) {
    std::fprintf(stderr, "[renderer] script injecté %s : %s (ligne %d)\n", what,
                 exc->GetMessage().ToString().c_str(), exc->GetLineNumber());
  }
}

}  // namespace

void rememberScripts(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDictionaryValue> extra) {
  std::vector<std::string> scripts;
  if (extra && extra->HasKey(ipc::proto::kExtraScripts)) {
    auto list = extra->GetList(ipc::proto::kExtraScripts);
    for (size_t i = 0; list && i < list->GetSize(); ++i) {
      scripts.push_back(list->GetString(i).ToString());
    }
  }
  g_scripts[browser->GetIdentifier()] = std::move(scripts);
}

void forgetBrowser(CefRefPtr<CefBrowser> browser) { g_scripts.erase(browser->GetIdentifier()); }

void installShell(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                  CefRefPtr<CefV8Context> context) {
  if (!frame->IsMain()) return;
  CefRefPtr<CefV8Handler> handler = new NativeHandler(frame);
  auto native = CefV8Value::CreateObject(nullptr, nullptr);
  native->SetValue("send", CefV8Value::CreateFunction("send", handler),
                   V8_PROPERTY_ATTRIBUTE_NONE);
  native->SetValue("register", CefV8Value::CreateFunction("register", handler),
                   V8_PROPERTY_ATTRIBUTE_NONE);
  context->GetGlobal()->SetValue("__shellNative", native, V8_PROPERTY_ATTRIBUTE_NONE);
  // Eval est synchrone : tout s'exécute ici, avant le premier script de la page.
  evalLogged(context, kBootstrapJs, "amorce");
  auto it = g_scripts.find(browser->GetIdentifier());
  if (it == g_scripts.end()) return;
  int n = 0;
  for (const auto& js : it->second) {
    evalLogged(context, js, std::to_string(++n).c_str());
  }
}

void releaseShell(CefRefPtr<CefFrame> frame) { g_frames.erase(frame->GetIdentifier().ToString()); }

bool onProcessMessage(CefRefPtr<CefFrame> frame, CefRefPtr<CefProcessMessage> message) {
  const std::string name = message->GetName().ToString();
  const bool isReply = name == ipc::proto::kReply;
  if (!isReply && name != ipc::proto::kEvent) return false;
  auto it = g_frames.find(frame->GetIdentifier().ToString());
  if (it == g_frames.end() || !it->second.dispatch) return true;  // page sans __shell
  auto& fs = it->second;
  auto list = message->GetArgumentList();
  CefV8ValueList args;
  fs.context->Enter();
  if (isReply) {
    args = {CefV8Value::CreateString("reply"), CefV8Value::CreateInt(list->GetInt(0)),
            CefV8Value::CreateBool(list->GetBool(1)),
            CefV8Value::CreateString(list->GetBool(1) ? list->GetString(2) : list->GetString(3)),
            CefV8Value::CreateString(list->GetString(4))};
  } else {
    args = {CefV8Value::CreateString("event"), CefV8Value::CreateString(list->GetString(0)),
            CefV8Value::CreateString(list->GetString(1))};
  }
  fs.dispatch->ExecuteFunction(nullptr, args);
  fs.context->Exit();
  return true;
}

}  // namespace tentacle::renderer
