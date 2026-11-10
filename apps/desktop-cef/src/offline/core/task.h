#pragma once
// Les `async` / `await` du cœur d'Electron, en coroutines C++20, sur UN fil.
//
// Le cœur hors ligne d'Electron est fait de fonctions asynchrones qui s'entrelacent sur une
// boucle d'évènements (`await` d'un transfert, d'une image, d'un délai). On garde cette forme
// plutôt que d'en faire une machine à rappels : le portage se relit ligne à ligne contre le
// TypeScript. Tout reprend sur le fil hors ligne (les adaptateurs y repostent leurs rappels) :
// aucune concurrence, de l'entrelacement aux seuls `co_await`, comme chez Electron.
//
//   Task<T>         une fonction `async` (paresseuse : elle part quand on l'attend) ;
//   spawn(task)     `void promise` : lancée tout de suite, jamais attendue ;
//   Started<T>      une promesse lancée MAINTENANT et attendue plus tard (`const p = f(); … await p`) ;
//   awaitCallback   un rappel du monde extérieur devenu attendable.
//
// RÈGLE : jamais un temporaire dans l'expression d'un `co_await` (`co_await f(x + y, [..]{})`).
// GCC avant 13 détruit deux fois certains de ces temporaires (une lambda convertie en
// `std::function`, mesuré sous Debian 12 : un `shared_ptr` libéré trop tôt). On NOMME la tâche
// ou l'attente, puis on l'attend : `auto t = f(x + y, fn); co_await t;`.

#include <coroutine>
#include <cstdio>
#include <exception>
#include <functional>
#include <memory>
#include <optional>
#include <utility>

namespace tentacle::offline {

/// Ce que le cœur demande à sa boucle : poster, différer, l'heure.
class Scheduler {
 public:
  virtual ~Scheduler() = default;
  virtual void post(std::function<void()> task) = 0;
  virtual void postDelayed(std::function<void()> task, int64_t delayMs) = 0;
};

namespace task_detail {
struct PromiseBase {
  std::coroutine_handle<> continuation;
  std::exception_ptr error;
  struct Final {
    bool await_ready() noexcept { return false; }
    template <class P>
    std::coroutine_handle<> await_suspend(std::coroutine_handle<P> h) noexcept {
      const auto next = h.promise().continuation;
      return next ? next : std::noop_coroutine();
    }
    void await_resume() noexcept {}
  };
  std::suspend_always initial_suspend() noexcept { return {}; }
  Final final_suspend() noexcept { return {}; }
  void unhandled_exception() { error = std::current_exception(); }
};
}  // namespace task_detail

template <class T = void>
class [[nodiscard]] Task {
 public:
  struct promise_type : task_detail::PromiseBase {
    std::optional<T> value;
    Task get_return_object() { return Task(std::coroutine_handle<promise_type>::from_promise(*this)); }
    template <class U>
    void return_value(U&& v) {
      value.emplace(std::forward<U>(v));
    }
  };
  Task(Task&& other) noexcept : h_(std::exchange(other.h_, {})) {}
  Task& operator=(Task&&) = delete;
  ~Task() {
    if (h_) h_.destroy();
  }
  bool await_ready() const noexcept { return false; }
  std::coroutine_handle<> await_suspend(std::coroutine_handle<> caller) noexcept {
    h_.promise().continuation = caller;
    return h_;
  }
  T await_resume() {
    if (h_.promise().error) std::rethrow_exception(h_.promise().error);
    return std::move(*h_.promise().value);
  }

 private:
  explicit Task(std::coroutine_handle<promise_type> h) : h_(h) {}
  std::coroutine_handle<promise_type> h_;
};

template <>
class [[nodiscard]] Task<void> {
 public:
  struct promise_type : task_detail::PromiseBase {
    Task get_return_object() { return Task(std::coroutine_handle<promise_type>::from_promise(*this)); }
    void return_void() {}
  };
  Task(Task&& other) noexcept : h_(std::exchange(other.h_, {})) {}
  Task& operator=(Task&&) = delete;
  ~Task() {
    if (h_) h_.destroy();
  }
  bool await_ready() const noexcept { return false; }
  std::coroutine_handle<> await_suspend(std::coroutine_handle<> caller) noexcept {
    h_.promise().continuation = caller;
    return h_;
  }
  void await_resume() {
    if (h_.promise().error) std::rethrow_exception(h_.promise().error);
  }

 private:
  explicit Task(std::coroutine_handle<promise_type> h) : h_(h) {}
  std::coroutine_handle<promise_type> h_;
};

/// Une coroutine qui part tout de suite et se libère seule à la fin.
struct Detached {
  struct promise_type {
    Detached get_return_object() { return {}; }
    std::suspend_never initial_suspend() noexcept { return {}; }
    std::suspend_never final_suspend() noexcept { return {}; }
    void return_void() {}
    void unhandled_exception() noexcept {}
  };
};

namespace task_detail {
inline Detached runDetached(Task<void> task) {
  try {
    co_await task;
  } catch (const std::exception& e) {
    std::fprintf(stderr, "[offline] tâche de fond : %s\n", e.what());
  } catch (...) {
    std::fprintf(stderr, "[offline] tâche de fond : exception\n");
  }
}
}  // namespace task_detail

/// Lance `task` maintenant (jusqu'à son premier `co_await` en suspens) ; personne ne l'attend.
inline void spawn(Task<void> task) { task_detail::runDetached(std::move(task)); }

/// Une promesse lancée MAINTENANT, attendue plus tard — `const media = run(…); … await media`.
template <class T>
class Started {
 public:
  explicit Started(Task<T> task) : state_(std::make_shared<State>()) { drive(std::move(task), state_); }
  bool await_ready() const noexcept { return state_->done; }
  void await_suspend(std::coroutine_handle<> waiter) noexcept { state_->waiter = waiter; }
  T await_resume() {
    if (state_->error) std::rethrow_exception(state_->error);
    return std::move(*state_->value);
  }

 private:
  struct State {
    std::optional<T> value;
    std::exception_ptr error;
    std::coroutine_handle<> waiter;
    bool done = false;
  };
  static Detached drive(Task<T> task, std::shared_ptr<State> state) {
    try {
      state->value.emplace(co_await task);
    } catch (...) {
      state->error = std::current_exception();
    }
    state->done = true;
    if (state->waiter) std::exchange(state->waiter, {}).resume();
  }
  std::shared_ptr<State> state_;
};

/// Un rappel du monde extérieur, attendable. `start(done)` reçoit la fonction à appeler UNE
/// fois avec le résultat — sur le fil de la coroutine (les adaptateurs y repostent), même tout
/// de suite (alors rien n'est suspendu).
template <class T>
class CallbackAwaiter {
 public:
  using Start = std::function<void(std::function<void(T)>)>;
  explicit CallbackAwaiter(Start start) : start_(std::move(start)), state_(std::make_shared<State>()) {}
  bool await_ready() const noexcept { return false; }
  bool await_suspend(std::coroutine_handle<> h) {
    state_->handle = h;
    auto state = state_;
    start_([state](T value) {
      if (state->result) return;  // une seule fois
      state->result.emplace(std::move(value));
      if (state->suspended) state->handle.resume();
    });
    if (state_->result) return false;  // rendu sur-le-champ : on continue sans suspendre
    state_->suspended = true;
    return true;
  }
  T await_resume() { return std::move(*state_->result); }

 private:
  struct State {
    std::optional<T> result;
    std::coroutine_handle<> handle;
    bool suspended = false;
  };
  Start start_;
  std::shared_ptr<State> state_;
};

template <class T>
CallbackAwaiter<T> awaitCallback(typename CallbackAwaiter<T>::Start start) {
  return CallbackAwaiter<T>(std::move(start));
}

/// `await new Promise((r) => setTimeout(r, ms))`.
inline CallbackAwaiter<bool> sleepFor(Scheduler& scheduler, int64_t delayMs) {
  return CallbackAwaiter<bool>([&scheduler, delayMs](std::function<void(bool)> done) {
    scheduler.postDelayed([done] { done(true); }, delayMs);
  });
}

}  // namespace tentacle::offline
