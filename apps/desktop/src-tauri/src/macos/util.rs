use std::ffi::{c_void, CStr};

extern "C" {
    static _dispatch_main_q: c_void;
    fn dispatch_async_f(
        queue: *const c_void,
        context: *mut c_void,
        work: unsafe extern "C" fn(*mut c_void),
    );
}

fn is_main_thread() -> bool {
    unsafe {
        use objc2::msg_send;
        let cls = objc2::runtime::AnyClass::get(
            CStr::from_bytes_with_nul(b"NSThread\0").unwrap(),
        )
        .unwrap();
        msg_send![cls, isMainThread]
    }
}

/// Dispatch a closure to the main thread and wait for completion.
pub fn dispatch_main_sync<F: FnOnce() + Send + 'static>(f: F) {
    if is_main_thread() {
        f();
    } else {
        let (tx, rx) = std::sync::mpsc::channel();
        let block: Box<dyn FnOnce() + Send> = Box::new(move || {
            f();
            let _ = tx.send(());
        });
        unsafe extern "C" fn trampoline(ctx: *mut c_void) {
            let f = Box::from_raw(ctx as *mut Box<dyn FnOnce() + Send>);
            f();
        }
        let boxed = Box::new(block);
        unsafe {
            dispatch_async_f(
                &_dispatch_main_q as *const c_void,
                Box::into_raw(boxed) as *mut c_void,
                trampoline,
            );
        }
        let _ = rx.recv_timeout(std::time::Duration::from_secs(5));
    }
}

/// Run a closure on the main thread and return its result.
pub fn run_on_main_thread<T: Send + 'static, F: FnOnce() -> T + Send + 'static>(
    f: F,
) -> Result<T, String> {
    if is_main_thread() {
        return Ok(f());
    }
    let (tx, rx) = std::sync::mpsc::channel();
    let block: Box<dyn FnOnce() + Send> = Box::new(move || {
        let result = f();
        let _ = tx.send(result);
    });
    unsafe extern "C" fn trampoline(ctx: *mut c_void) {
        let f = Box::from_raw(ctx as *mut Box<dyn FnOnce() + Send>);
        f();
    }
    let boxed = Box::new(block);
    unsafe {
        dispatch_async_f(
            &_dispatch_main_q as *const c_void,
            Box::into_raw(boxed) as *mut c_void,
            trampoline,
        );
    }
    rx.recv_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("Main thread dispatch timeout: {e}"))
}
