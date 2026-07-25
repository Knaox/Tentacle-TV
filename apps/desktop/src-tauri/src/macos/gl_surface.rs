use std::ffi::{c_void, CStr};
use objc2::msg_send;
use objc2::runtime::{AnyObject, Bool};
use objc2_foundation::NSRect;

pub struct GlSurface {
    pub cgl_context: *mut c_void,
    pub gl_view: *mut c_void,
    pub pixel_width: i32,
    pub pixel_height: i32,
    pub scale_factor: f64,
}

// SAFETY: GlSurface pointers are only used in specific threads (render thread, main thread)
// and are never accessed concurrently without synchronization.
unsafe impl Send for GlSurface {}

/// Retrouve la WKWebView parmi les sous-vues de la contentView.
///
/// On cible la CLASSE, jamais `subviews[0]`. L'ancien code supposait que la
/// premiere sous-vue EST la WKWebView : l'hypothese tient tant que la
/// contentView n'a qu'une sous-vue, mais elle s'inverse des qu'une couche de
/// fond est ajoutee (materiau verre, vibrancy) — cette couche devient
/// `subviews[0]` et la vue GL se retrouve inseree SOUS elle, donc la video
/// passe DERRIERE le materiau. Comme le lecteur est remonte a chaque changement
/// d'episode (`key={itemId}`), le defaut se rejouerait a chaque episode.
///
/// Renvoie un pointeur nul si aucune WKWebView n'est trouvee.
///
/// SAFETY: appels Cocoa — doit s'executer sur le thread principal.
pub unsafe fn find_webview(content_view: *mut AnyObject) -> *mut AnyObject {
    if content_view.is_null() {
        return std::ptr::null_mut();
    }
    let subviews: *mut AnyObject = msg_send![content_view, subviews];
    let count: usize = msg_send![subviews, count];
    let Some(cls) = objc2::runtime::AnyClass::get(
        CStr::from_bytes_with_nul(b"WKWebView\0").unwrap()
    ) else {
        return std::ptr::null_mut();
    };
    for i in 0..count {
        let view: *mut AnyObject = msg_send![subviews, objectAtIndex: i];
        let is_webview: Bool = msg_send![view, isKindOfClass: cls];
        if is_webview.as_bool() {
            return view;
        }
    }
    std::ptr::null_mut()
}

/// Create an NSOpenGLView under the WKWebView's content view.
/// The GL view is positioned behind the web content (z-order below)
/// and does not intercept mouse events (hitTest passthrough).
///
/// SAFETY: Must be called on the main thread.
pub unsafe fn create_gl_surface(ns_window: *mut c_void) -> Result<GlSurface, String> {
    if ns_window.is_null() {
        return Err("NSWindow pointer is null".to_string());
    }

    let window = ns_window as *mut AnyObject;

    // Get content view
    let content_view: *mut AnyObject = msg_send![window, contentView];
    if content_view.is_null() {
        return Err("contentView is null".to_string());
    }

    // Get window frame for size
    let frame: NSRect = msg_send![content_view, frame];
    let scale_factor: f64 = msg_send![window, backingScaleFactor];

    // Create pixel format with double-buffered OpenGL
    let attrs: [u32; 8] = [
        8,   // NSOpenGLPFAColorSize
        32,
        11,  // NSOpenGLPFADepthSize
        24,
        5,   // NSOpenGLPFADoubleBuffer
        99,  // NSOpenGLPFAOpenGLProfile
        0x1000, // NSOpenGLProfileVersionLegacy
        0,   // terminator (required by initWithAttributes:)
    ];
    let pixel_format_class = objc2::runtime::AnyClass::get(
        CStr::from_bytes_with_nul(b"NSOpenGLPixelFormat\0").unwrap()
    ).ok_or("NSOpenGLPixelFormat class not found")?;
    let pixel_format: *mut AnyObject = msg_send![pixel_format_class, alloc];
    let pixel_format: *mut AnyObject = msg_send![pixel_format, initWithAttributes: attrs.as_ptr()];
    if pixel_format.is_null() {
        return Err("Failed to create NSOpenGLPixelFormat".to_string());
    }

    // Create NSOpenGLView
    let gl_view: *mut AnyObject = msg_send![
        objc2::runtime::AnyClass::get(
            CStr::from_bytes_with_nul(b"NSOpenGLView\0").unwrap()
        ).ok_or("NSOpenGLView class not found")?,
        alloc
    ];
    let gl_view: *mut AnyObject = msg_send![gl_view, initWithFrame: frame, pixelFormat: pixel_format];
    if gl_view.is_null() {
        // La vue n'a pas pu retenir le format : on relache notre +1 avant de sortir.
        let _: () = msg_send![pixel_format, release];
        return Err("Failed to create NSOpenGLView".to_string());
    }

    // La NSOpenGLView retient desormais le pixel format. Sans ce `release`, le
    // +1 de `alloc`/`initWithAttributes:` n'est jamais rendu et le
    // NSOpenGLPixelFormat fuit a CHAQUE session de lecture — donc a chaque
    // changement d'episode, puisque le lecteur est remonte par `key={itemId}`.
    let _: () = msg_send![pixel_format, release];

    // Enable Retina (wantsBestResolutionOpenGLSurface)
    let _: () = msg_send![gl_view, setWantsBestResolutionOpenGLSurface: Bool::YES];

    // Autoresizing mask: width + height sizable
    let mask: usize = (1 << 1) | (1 << 4); // NSViewWidthSizable | NSViewHeightSizable
    let _: () = msg_send![gl_view, setAutoresizingMask: mask];

    // Inserer SOUS la WKWebView (NSWindowBelow = -1).
    let webview = find_webview(content_view);

    if !webview.is_null() {
        let _: () = msg_send![content_view, addSubview: gl_view, positioned: -1i64, relativeTo: webview];
    } else {
        // Aucune WKWebView trouvee (ne devrait pas arriver) : on place la vue GL
        // sous TOUTES les sous-vues. `relativeTo: nil` + NSWindowBelow signifie
        // « en dessous de tout », ce qui reste le comportement le plus sur.
        let _: () = msg_send![content_view, addSubview: gl_view, positioned: -1i64, relativeTo: std::ptr::null_mut::<AnyObject>()];
    }

    // Get CGL context
    let ns_gl_context: *mut AnyObject = msg_send![gl_view, openGLContext];
    if ns_gl_context.is_null() {
        return Err("NSOpenGLView has no openGLContext".to_string());
    }
    let cgl_context: *mut c_void = msg_send![ns_gl_context, CGLContextObj];

    let pixel_width = (frame.size.width * scale_factor) as i32;
    let pixel_height = (frame.size.height * scale_factor) as i32;

    Ok(GlSurface {
        cgl_context,
        gl_view: gl_view as *mut c_void,
        pixel_width,
        pixel_height,
        scale_factor,
    })
}

/// Resize callback — updates the GL surface dimensions when the window resizes.
pub unsafe fn get_surface_size(gl_view: *mut c_void, scale_factor: f64) -> (i32, i32) {
    if gl_view.is_null() {
        return (0, 0);
    }
    let view = gl_view as *mut AnyObject;
    let frame: NSRect = msg_send![view, frame];
    (
        (frame.size.width * scale_factor) as i32,
        (frame.size.height * scale_factor) as i32,
    )
}
