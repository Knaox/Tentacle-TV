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
    let attrs: [u32; 7] = [
        8,   // NSOpenGLPFAColorSize
        32,
        11,  // NSOpenGLPFADepthSize
        24,
        5,   // NSOpenGLPFADoubleBuffer
        99,  // NSOpenGLPFAOpenGLProfile
        0x1000, // NSOpenGLProfileVersionLegacy
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
        return Err("Failed to create NSOpenGLView".to_string());
    }

    // Enable Retina (wantsBestResolutionOpenGLSurface)
    let _: () = msg_send![gl_view, setWantsBestResolutionOpenGLSurface: Bool::YES];

    // Autoresizing mask: width + height sizable
    let mask: usize = (1 << 1) | (1 << 4); // NSViewWidthSizable | NSViewHeightSizable
    let _: () = msg_send![gl_view, setAutoresizingMask: mask];

    // Add below web content (NSWindowBelow = -1)
    let first_subview: *mut AnyObject = {
        let subviews: *mut AnyObject = msg_send![content_view, subviews];
        let count: usize = msg_send![subviews, count];
        if count > 0 {
            msg_send![subviews, objectAtIndex: 0usize]
        } else {
            std::ptr::null_mut()
        }
    };

    if !first_subview.is_null() {
        let _: () = msg_send![content_view, addSubview: gl_view, positioned: -1i64, relativeTo: first_subview];
    } else {
        let _: () = msg_send![content_view, addSubview: gl_view];
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
