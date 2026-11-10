// Faux voisins pour tester le pont sans CEF, sans libmpv, sans SDL.
#pragma once

#include <map>
#include <string>
#include <vector>

#include "ports.h"

namespace bridge::testing {

struct Answer {
  bool done = false;
  bool ok = false;
  Json value;
  std::string code, message;
};

class FakeIpc : public IpcPort {
 public:
  void registerHandler(const std::string& channel, Handler handler) override { handlers[channel] = std::move(handler); }
  void emit(const std::string& event, const Json& payload) override { emitted.push_back({event, payload}); }

  /// Appelle un canal comme le ferait la page ; la réponse est relevée dans `Answer`.
  Answer invoke(const std::string& channel, const Json& payload = Json::object()) {
    Answer a;
    auto it = handlers.find(channel);
    if (it == handlers.end()) return a;
    Reply reply{[&a](Json v) { a.done = a.ok = true; a.value = std::move(v); },
                [&a](std::string c, std::string m) { a.done = true; a.code = std::move(c); a.message = std::move(m); }};
    it->second(payload, reply);
    return a;
  }

  std::vector<Json> payloadsOf(const std::string& event) const {
    std::vector<Json> out;
    for (const auto& [e, p] : emitted) if (e == event) out.push_back(p);
    return out;
  }

  std::map<std::string, Handler> handlers;
  std::vector<std::pair<std::string, Json>> emitted;
};

/// Lecteur synchrone : chaque opération répond tout de suite (un vrai répond plus tard).
class FakePlayer : public PlayerPort {
 public:
  void start(const Json& options, Done done) override { started.push_back(options); live = true; done(startError); }
  void stop(std::function<void()> done) override { stops++; live = false; done(); }
  bool running() const override { return live; }
  void command(const Json& args, Done done) override { commands.push_back(args); done(commandError); }
  void setProperty(const std::string& name, const Json& value, Done done) override { writes[name] = value; done(std::nullopt); }
  void getProperty(const std::string& name, std::function<void(std::optional<Json>)> done) override {
    auto it = values.find(name);
    done(it == values.end() ? std::nullopt : std::optional<Json>(it->second));
  }
  void observe(const std::string& name, const std::string& format) override { observed.push_back({name, format}); }
  void setListener(PlayerListener* l) override { listener = l; }
  bool canPrewarm() const override { return prewarmable; }
  bool prewarm(const Json& options) override {
    if (!prewarmable || live || warmOptions) return false;
    warmOptions = options;
    prewarms++;
    return true;
  }
  bool warm() const override { return warmOptions.has_value(); }
  void dropWarm() override { warmOptions.reset(); }

  bool prewarmable = false;
  int prewarms = 0;
  std::optional<Json> warmOptions;
  bool live = false;
  int stops = 0;
  std::optional<std::string> startError, commandError;
  std::vector<Json> started, commands;
  std::map<std::string, Json> writes, values;
  std::vector<std::pair<std::string, std::string>> observed;
  PlayerListener* listener = nullptr;
};

class FakeWindow : public WindowPort {
 public:
  bool isFullscreen() const override { return fullscreen; }
  void setFullscreen(bool on) override { requested.push_back(on); }
  void preventDisplaySleep(bool on) override { sleepBlocked = on; }
  bool openExternal(const std::string& url) override { opened.push_back(url); return true; }

  bool fullscreen = false, sleepBlocked = false;
  std::vector<bool> requested;
  std::vector<std::string> opened;
};

}  // namespace bridge::testing
