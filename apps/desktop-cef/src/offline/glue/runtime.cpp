#include "offline/glue/runtime.h"

#include <cstdio>

#include "offline/core/schema.h"
#include "offline/core/utf8_path.h"

namespace tentacle::offline {

Database& Runtime::db() {
  if (!database_) {
    database_ = openLocalDatabase(userData);
    std::fprintf(stderr, "[offline] base ouverte : %s\n", pathToUtf8(userData / kDbFileName).c_str());
  }
  return *database_;
}

void Runtime::closeDb() {
  if (!database_) return;
  database_->close();
  database_.reset();
}

Volume Runtime::volume() { return resolveRoot(db(), userData); }

void Runtime::notifyChanged() const {
  if (emit) emit("downloads://changed", nullptr);
}

Runtime& runtime() {
  static Runtime instance;
  return instance;
}

}  // namespace tentacle::offline
