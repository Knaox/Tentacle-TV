// `client_fetch_run` / `client_fetch_log` (voir client_fetch_commands.h et ipc/clientFetch.ts).

#include "net/client_fetch_commands.h"

#include "net/arg_check.h"
#include "net/fs_platform.h"
#include "net/plugin_documents.h"

namespace tentacle::net::cf {
namespace {

bool isPositiveInt(const Json& v) {
  if (!v.is_number()) return false;
  const double d = v.get<double>();
  return d > 0 && d == double(int64_t(d));
}

// z.record(z.string(), z.string().max(max))
bool isStringRecord(const Json& v, size_t maxValueChars) {
  if (!v.is_object()) return false;
  for (const auto& e : v) {
    if (!e.is_string() || plugins::utf16Length(e.get<std::string>()) > maxValueChars) return false;
  }
  return true;
}

// Le schéma `RUN` d'Electron ; les champs inconnus de `request` sont retirés (zod les retire).
std::optional<std::string> validate(const Json& args, Json& request) {
  if (!args.is_object()) return "objet attendu";
  const auto origin = args.find("serverOrigin");
  if (origin == args.end() || !origin->is_string()) return "serverOrigin : chaine attendue";
  const std::string o = origin->get<std::string>();
  if (o.empty() || plugins::utf16Length(o) > 2048 || !(o.rfind("http://", 0) == 0 || o.rfind("https://", 0) == 0)) {
    return "serverOrigin : valeur refusee";
  }
  if (!args.contains("headers") || !isStringRecord(args["headers"], 4096)) return "headers : valeur refusee";
  if (!args.contains("pluginId") || !args["pluginId"].is_string() ||
      !plugins::isValidPluginId(args["pluginId"].get<std::string>())) {
    return "pluginId : valeur refusee";
  }
  const auto r = args.find("request");
  if (r == args.end() || !r->is_object()) return "request : objet attendu";
  const auto opt = [&](const char* k) -> const Json* {
    auto it = r->find(k);
    return it == r->end() || it->is_null() ? nullptr : &*it;
  };
  const Json* method = opt("method");
  if (!method || (*method != "GET" && *method != "POST")) return "request.method : valeur refusee";
  const Json* url = opt("url");
  if (!url || !url->is_string() || plugins::utf16Length(url->get<std::string>()) > 4096) return "request.url : valeur refusee";
  request = Json{{"method", *method}, {"url", *url}};
  if (const Json* h = opt("headers")) {
    if (!isStringRecord(*h, 8192)) return "request.headers : valeur refusee";
    request["headers"] = *h;
  }
  if (const Json* b = opt("body")) {
    if (!b->is_string() || plugins::utf16Length(b->get<std::string>()) > 256 * 1024) return "request.body : valeur refusee";
    request["body"] = *b;
  }
  for (const char* k : {"timeoutMs", "maxBytes"}) {
    if (const Json* v = opt(k)) {
      if (!isPositiveInt(*v)) return std::string("request.") + k + " : valeur refusee";
      request[k] = int64_t(v->get<double>());
    }
  }
  return std::nullopt;
}

}  // namespace

Commands::Commands(PluginManifests::Fetch fetch, Hop hop, std::function<int64_t()> now)
    : manifests_(std::make_shared<PluginManifests>(std::move(fetch), now)),
      quota_(std::make_shared<Quota>(now)),
      hop_(std::move(hop)),
      now_(std::move(now)) {}

void Commands::run(const bridge::Json& args, bridge::Reply reply) {
  Json request;
  if (auto error = validate(args.is_null() ? Json::object() : args, request)) {
    return reply.fail("bad_args", "arguments invalides pour client_fetch_run: " + *error);
  }
  ServerSession session{args["serverOrigin"].get<std::string>(), {}};
  for (auto h = args["headers"].begin(); h != args["headers"].end(); ++h) session.headers.emplace_back(h.key(), h->get<std::string>());
  const std::string pluginId = args["pluginId"].get<std::string>();
  const auto target = parseHttpUrl(request["url"].get<std::string>());
  const int64_t started = now_ ? now_() : nowMs();
  auto log = log_;
  auto now = now_;
  Json entry{{"t", started}, {"pluginId", pluginId}, {"host", target ? target->host : "?"},
             {"path", target ? target->path : "?"}};
  runDelegated(session, pluginId, request, *manifests_, *quota_, hop_, now_,
               [reply, log, now, entry, started](Outcome o) mutable {
                 entry["outcome"] = o.ok ? Json(o.status) : Json(o.reason);
                 entry["ms"] = (now ? now() : nowMs()) - started;
                 log->push_back(entry);
                 while (log->size() > 200) log->pop_front();
                 reply.ok(o.toJson());
               });
}

void Commands::log(const bridge::Json& args, bridge::Reply reply) {
  if (!args.is_null() && !args.is_object()) return reply.fail("bad_args", "arguments invalides pour client_fetch_log: objet attendu");
  reply.ok(Json(std::vector<Json>(log_->begin(), log_->end())));
}

}  // namespace tentacle::net::cf
