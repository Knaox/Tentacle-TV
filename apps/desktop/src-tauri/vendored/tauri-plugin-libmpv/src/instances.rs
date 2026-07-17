//! FORK TENTACLE — mécanique de verrouillage par instance (voir VENDORED.md).
//!
//! Upstream, un unique `Mutex<HashMap<label, MpvInstance>>` était tenu PENDANT
//! les appels FFI bloquants : une seule commande coincée dans mpv suffisait à
//! empiler indéfiniment toutes les suivantes, puis à geler l'app entière dès
//! que le thread UI touchait le même mutex (capturé en prod le 15.07.2026 —
//! dump freeze-probe : 89 threads en attente + thread principal bloqué dans la
//! wndproc via `on_event CloseRequested`).
//!
//! Ici le verrou de map ne couvre QUE les opérations de map (quelques µs).
//! Chaque instance porte sa propre barrière `RwLock` :
//! - opérations FFI (`command`/`set_property`/`get_property`) : `read()` —
//!   concurrentes entre elles (l'API libmpv est thread-safe), n'excluent que
//!   le destroy de LEUR instance ;
//! - `destroy` : `write()` — attend la fin des opérations en vol sur CETTE
//!   instance uniquement, puis libère l'instance.
//!
//! Une instance mpv coincée n'occupe plus qu'un thread `spawn_blocking` (son
//! destroy, en embuscade sur `write()`, qui termine le démontage dès que
//! l'opération coincée lâche) — jamais la map, jamais les autres instances,
//! jamais le thread UI.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, RwLock};

use log::warn;

use crate::models::MpvInstance;

/// Barrière d'une instance. `inner == None` : slot réservé (création en
/// cours) ou instance déjà détruite — les opérations répondent alors
/// `InstanceNotFound` au lieu de bloquer.
pub struct InstanceSlot {
    inner: RwLock<Option<MpvInstance>>,
    /// Un destroy est passé pendant que le slot était encore réservé : la
    /// création doit démonter elle-même l'instance qu'elle vient de produire
    /// (upstream, son verrou global bloquant rendait cette race impossible).
    doomed: AtomicBool,
}

impl InstanceSlot {
    fn reserved() -> Self {
        Self {
            inner: RwLock::new(None),
            doomed: AtomicBool::new(false),
        }
    }

    /// Pose l'instance créée dans un slot réservé par [`InstanceMap::reserve`].
    /// Renvoie `false` si un destroy est passé entre-temps : l'appelant doit
    /// alors démonter immédiatement l'instance (elle n'est plus dans la map).
    #[must_use]
    pub fn fulfill(&self, instance: MpvInstance) -> bool {
        let mut guard = match self.inner.write() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        if self.doomed.load(Ordering::Acquire) {
            return false;
        }
        *guard = Some(instance);
        true
    }

    /// Lit l'instance sous `read()` et exécute `operation` PENDANT que le
    /// guard est tenu : l'instance ne peut pas être détruite sous nos pieds
    /// (le destroy attend `write()`), mais les autres opérations restent
    /// concurrentes.
    pub fn with_read<T>(
        &self,
        operation: impl FnOnce(Option<&MpvInstance>) -> T,
    ) -> T {
        let guard = match self.inner.read() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        operation(guard.as_ref())
    }

    /// Attend la fin des opérations en vol (`write()`) puis retire l'instance
    /// du slot. `None` si le slot était encore réservé (il est alors marqué
    /// `doomed` : la création en cours démontera l'instance) ou déjà détruit.
    pub fn take_for_destroy(&self) -> Option<MpvInstance> {
        let mut guard = match self.inner.write() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        let taken = guard.take();
        if taken.is_none() {
            self.doomed.store(true, Ordering::Release);
        }
        taken
    }
}

/// Map label → slot. Le verrou interne n'est JAMAIS tenu pendant un appel FFI.
pub struct InstanceMap {
    map: Mutex<HashMap<String, Arc<InstanceSlot>>>,
}

impl InstanceMap {
    pub fn new() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<String, Arc<InstanceSlot>>> {
        match self.map.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                warn!("Mutex was poisoned, recovering.");
                poisoned.into_inner()
            }
        }
    }

    /// `contains_key` sans JAMAIS bloquer l'appelant : destiné au thread
    /// principal (`on_event CloseRequested`). Si le verrou est occupé,
    /// répond pessimiste (`true`) — un destroy de label inexistant est un
    /// no-op inoffensif, alors qu'un thread UI endormi gèle toute l'app.
    pub fn contains_nonblocking(&self, window_label: &str) -> bool {
        use std::sync::TryLockError;
        match self.map.try_lock() {
            Ok(guard) => guard.contains_key(window_label),
            Err(TryLockError::Poisoned(poisoned)) => {
                poisoned.into_inner().contains_key(window_label)
            }
            Err(TryLockError::WouldBlock) => true,
        }
    }

    /// Réserve `window_label` : insère un slot vide et le retourne, ou `None`
    /// si le label existe déjà (instance vivante ou création en cours).
    pub fn reserve(&self, window_label: &str) -> Option<Arc<InstanceSlot>> {
        let mut map = self.lock();
        if map.contains_key(window_label) {
            return None;
        }
        let slot = Arc::new(InstanceSlot::reserved());
        map.insert(window_label.to_string(), slot.clone());
        Some(slot)
    }

    /// Annule une réservation dont la création FFI a échoué. Ne retire
    /// l'entrée que si c'est encore NOTRE slot (`Arc::ptr_eq`) — un
    /// destroy+init concurrent a pu remplacer l'entrée entre-temps.
    pub fn cancel_reservation(&self, window_label: &str, slot: &Arc<InstanceSlot>) {
        let mut map = self.lock();
        if map
            .get(window_label)
            .is_some_and(|cur| Arc::ptr_eq(cur, slot))
        {
            map.remove(window_label);
        }
    }

    /// Clone l'`Arc` du slot sous verrou court (µs) — l'appel FFI se fait
    /// ensuite HORS verrou de map, sous `read()` du slot.
    pub fn get(&self, window_label: &str) -> Option<Arc<InstanceSlot>> {
        self.lock().get(window_label).cloned()
    }

    /// Retire le slot de la map (verrou court). Le démontage effectif se fait
    /// ensuite via [`InstanceSlot::take_for_destroy`], hors verrou de map.
    pub fn remove(&self, window_label: &str) -> Option<Arc<InstanceSlot>> {
        self.lock().remove(window_label)
    }
}
