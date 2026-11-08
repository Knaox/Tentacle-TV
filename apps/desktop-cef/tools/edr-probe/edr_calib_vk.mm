// edr-calib-vk — témoin d'étalonnage par Vulkan/MoltenVK, SANS mpv.
//
// Même fenêtre que edr-calib, mais la CAMetalLayer est remplie par une swapchain Vulkan
// (MoltenVK, comme mpv) : A2R10G10B10_UNORM + VK_COLOR_SPACE_HDR10_ST2084_EXT, chaque image
// effacée à un code PQ V (0,75 ≈ 1 000 nits). Tranche la question : si ce témoin obtient la
// marge EDR et pas mpv, le problème est dans le rendu de mpv ; sinon, dans MoltenVK.
//
// Usage : edr-calib-vk [--value V] [--seconds S] [--hdr-metadata] [--srgb] [--srgb-first N]
//   --srgb-first N : comme libplacebo/mpv — swapchain sRGB d'abord, N images présentées, puis
//                    recréée en HDR10_ST2084 (oldSwapchain).
//   --alpha A, --post-multiplied : canal alpha des images et mode de composition (libplacebo).

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#include <vulkan/vulkan.h>
#include <vulkan/vulkan_metal.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sys/time.h>
#include <vector>

#define VK(x) do { VkResult r_ = (x); if (r_ != VK_SUCCESS) { fprintf(stderr, "%s -> %d\n", #x, r_); exit(1); } } while (0)

int main(int argc, char** argv) {
    @autoreleasepool {
        double value = 0.75, seconds = 4;
        bool meta = false, srgb = false;
        int srgbFirst = 0;
        double alpha = 1;
        bool postMul = false, regular = false;
        for (int i = 1; i < argc; i++) {
            if (!strcmp(argv[i], "--value") && i + 1 < argc) value = atof(argv[++i]);
            else if (!strcmp(argv[i], "--seconds") && i + 1 < argc) seconds = atof(argv[++i]);
            else if (!strcmp(argv[i], "--hdr-metadata")) meta = true;
            else if (!strcmp(argv[i], "--srgb")) srgb = true;
            else if (!strcmp(argv[i], "--alpha") && i + 1 < argc) alpha = atof(argv[++i]);
            else if (!strcmp(argv[i], "--post-multiplied")) postMul = true;  // comme libplacebo
            else if (!strcmp(argv[i], "--regular")) regular = true;  // app « Regular » (comme le banc)
            else if (!strcmp(argv[i], "--srgb-first") && i + 1 < argc) srgbFirst = atoi(argv[++i]);
        }
        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:regular ? NSApplicationActivationPolicyRegular
                                           : NSApplicationActivationPolicyAccessory];
        [NSApp finishLaunching];
        NSWindow* w = [[NSWindow alloc] initWithContentRect:NSMakeRect(200, 200, 480, 270)
                                                  styleMask:NSWindowStyleMaskTitled
                                                    backing:NSBackingStoreBuffered defer:NO];
        w.releasedWhenClosed = NO;
        w.title = @"edr-calib-vk";
        w.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces |
                               NSWindowCollectionBehaviorFullScreenAuxiliary;
        w.level = NSFloatingWindowLevel;
        CAMetalLayer* layer = [CAMetalLayer layer];
        w.contentView.layer = layer;
        w.contentView.wantsLayer = YES;
        layer.contentsScale = w.backingScaleFactor;
        [w orderFrontRegardless];
        const uint32_t W = 480 * w.backingScaleFactor, H = 270 * w.backingScaleFactor;

        const char* iext[] = {VK_KHR_SURFACE_EXTENSION_NAME, VK_EXT_METAL_SURFACE_EXTENSION_NAME,
                              VK_KHR_PORTABILITY_ENUMERATION_EXTENSION_NAME,
                              VK_EXT_SWAPCHAIN_COLOR_SPACE_EXTENSION_NAME,
                              VK_KHR_GET_PHYSICAL_DEVICE_PROPERTIES_2_EXTENSION_NAME};
        VkApplicationInfo app{VK_STRUCTURE_TYPE_APPLICATION_INFO};
        app.apiVersion = VK_API_VERSION_1_2;
        VkInstanceCreateInfo ici{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};
        ici.flags = VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR;
        ici.pApplicationInfo = &app;
        ici.enabledExtensionCount = 5;
        ici.ppEnabledExtensionNames = iext;
        VkInstance inst;
        VK(vkCreateInstance(&ici, nullptr, &inst));
        uint32_t n = 1;
        VkPhysicalDevice gpu;
        vkEnumeratePhysicalDevices(inst, &n, &gpu);
        VkMetalSurfaceCreateInfoEXT sci{VK_STRUCTURE_TYPE_METAL_SURFACE_CREATE_INFO_EXT};
        sci.pLayer = layer;
        VkSurfaceKHR surf;
        VK(vkCreateMetalSurfaceEXT(inst, &sci, nullptr, &surf));

        float prio = 1;
        VkDeviceQueueCreateInfo qci{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};
        qci.queueCount = 1;
        qci.pQueuePriorities = &prio;
        const char* dext[] = {VK_KHR_SWAPCHAIN_EXTENSION_NAME, "VK_KHR_portability_subset",
                              VK_EXT_HDR_METADATA_EXTENSION_NAME};
        VkDeviceCreateInfo dci{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};
        dci.queueCreateInfoCount = 1;
        dci.pQueueCreateInfos = &qci;
        dci.enabledExtensionCount = 3;
        dci.ppEnabledExtensionNames = dext;
        VkDevice dev;
        VK(vkCreateDevice(gpu, &dci, nullptr, &dev));
        VkQueue q;
        vkGetDeviceQueue(dev, 0, 0, &q);

        VkSwapchainCreateInfoKHR swi{VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR};
        swi.surface = surf;
        swi.minImageCount = 3;
        swi.imageFormat = VK_FORMAT_A2R10G10B10_UNORM_PACK32;
        swi.imageColorSpace = srgb ? VK_COLOR_SPACE_SRGB_NONLINEAR_KHR : VK_COLOR_SPACE_HDR10_ST2084_EXT;
        swi.imageExtent = {W, H};
        swi.imageArrayLayers = 1;
        swi.imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT;
        swi.preTransform = VK_SURFACE_TRANSFORM_IDENTITY_BIT_KHR;
        swi.compositeAlpha = postMul ? VK_COMPOSITE_ALPHA_POST_MULTIPLIED_BIT_KHR : VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR;
        swi.presentMode = VK_PRESENT_MODE_FIFO_KHR;
        swi.clipped = VK_TRUE;
        VkSwapchainKHR sc = VK_NULL_HANDLE;
        std::vector<VkImage> imgs;
        auto makeSwapchain = [&](VkColorSpaceKHR cs) {
            swi.imageColorSpace = cs;
            swi.oldSwapchain = sc;
            VkSwapchainKHR next;
            VK(vkCreateSwapchainKHR(dev, &swi, nullptr, &next));
            if (sc) vkDestroySwapchainKHR(dev, sc, nullptr);
            sc = next;
            uint32_t ni = 0;
            vkGetSwapchainImagesKHR(dev, sc, &ni, nullptr);
            imgs.resize(ni);
            vkGetSwapchainImagesKHR(dev, sc, &ni, imgs.data());
        };
        makeSwapchain(srgbFirst ? VK_COLOR_SPACE_SRGB_NONLINEAR_KHR : swi.imageColorSpace);
        if (meta) {
            auto setMeta = (PFN_vkSetHdrMetadataEXT)vkGetDeviceProcAddr(dev, "vkSetHdrMetadataEXT");
            VkHdrMetadataEXT md{VK_STRUCTURE_TYPE_HDR_METADATA_EXT};
            md.displayPrimaryRed = {0.708f, 0.292f};
            md.displayPrimaryGreen = {0.170f, 0.797f};
            md.displayPrimaryBlue = {0.131f, 0.046f};
            md.whitePoint = {0.3127f, 0.3290f};
            md.maxLuminance = 1000;
            md.minLuminance = 0.0001f;
            md.maxContentLightLevel = 1000;
            md.maxFrameAverageLightLevel = 400;
            setMeta(dev, 1, &sc, &md);
        }

        VkCommandPoolCreateInfo pci{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};
        pci.flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
        VkCommandPool pool;
        VK(vkCreateCommandPool(dev, &pci, nullptr, &pool));
        VkCommandBufferAllocateInfo cai{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};
        cai.commandPool = pool;
        cai.commandBufferCount = 1;
        VkCommandBuffer cb;
        VK(vkAllocateCommandBuffers(dev, &cai, &cb));
        VkSemaphoreCreateInfo semi{VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO};
        VkSemaphore acq, done;
        vkCreateSemaphore(dev, &semi, nullptr, &acq);
        vkCreateSemaphore(dev, &semi, nullptr, &done);
        VkFenceCreateInfo fci{VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};
        VkFence fence;
        vkCreateFence(dev, &fci, nullptr, &fence);

        auto barrier = [&](VkImage img, VkImageLayout from, VkImageLayout to) {
            VkImageMemoryBarrier b{VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER};
            b.oldLayout = from;
            b.newLayout = to;
            b.srcQueueFamilyIndex = b.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
            b.image = img;
            b.subresourceRange = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
            b.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
            vkCmdPipelineBarrier(cb, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,
                                 0, 0, nullptr, 0, nullptr, 1, &b);
        };
        setvbuf(stdout, nullptr, _IOLBF, 0);
        NSDate* start = [NSDate date];
        double lastPrint = -1;
        int frames = 0;
        while (-[start timeIntervalSinceNow] < seconds) {
            @autoreleasepool {
                while (NSEvent* ev = [NSApp nextEventMatchingMask:NSEventMaskAny untilDate:nil
                                                           inMode:NSDefaultRunLoopMode dequeue:YES])
                    [NSApp sendEvent:ev];
                if (srgbFirst && frames++ == srgbFirst) {
                    vkDeviceWaitIdle(dev);
                    makeSwapchain(VK_COLOR_SPACE_HDR10_ST2084_EXT);
                }
                uint32_t idx;
                VK(vkAcquireNextImageKHR(dev, sc, UINT64_MAX, acq, VK_NULL_HANDLE, &idx));
                VkCommandBufferBeginInfo bi{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};
                vkBeginCommandBuffer(cb, &bi);
                barrier(imgs[idx], VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);
                VkClearColorValue c{};
                c.float32[0] = c.float32[1] = c.float32[2] = (float)value;
                c.float32[3] = (float)alpha;
                VkImageSubresourceRange rr{VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
                vkCmdClearColorImage(cb, imgs[idx], VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, &c, 1, &rr);
                barrier(imgs[idx], VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_PRESENT_SRC_KHR);
                vkEndCommandBuffer(cb);
                VkPipelineStageFlags ws = VK_PIPELINE_STAGE_ALL_COMMANDS_BIT;
                VkSubmitInfo si{VK_STRUCTURE_TYPE_SUBMIT_INFO};
                si.waitSemaphoreCount = 1;
                si.pWaitSemaphores = &acq;
                si.pWaitDstStageMask = &ws;
                si.commandBufferCount = 1;
                si.pCommandBuffers = &cb;
                si.signalSemaphoreCount = 1;
                si.pSignalSemaphores = &done;
                VK(vkQueueSubmit(q, 1, &si, fence));
                VkPresentInfoKHR pi{VK_STRUCTURE_TYPE_PRESENT_INFO_KHR};
                pi.waitSemaphoreCount = 1;
                pi.pWaitSemaphores = &done;
                pi.swapchainCount = 1;
                pi.pSwapchains = &sc;
                pi.pImageIndices = &idx;
                vkQueuePresentKHR(q, &pi);
                vkWaitForFences(dev, 1, &fence, VK_TRUE, UINT64_MAX);
                vkResetFences(dev, 1, &fence);
                const double t = -[start timeIntervalSinceNow];
                if (t - lastPrint >= 0.25) {
                    printf("%.3f edr=%.3f occlusionVisible=%d colorspace=%s\n", t,
                           w.screen.maximumExtendedDynamicRangeColorComponentValue,
                           (w.occlusionState & NSWindowOcclusionStateVisible) != 0,
                           [(__bridge NSString*)CGColorSpaceGetName(layer.colorspace) UTF8String]);
                    lastPrint = t;
                }
            }
        }
        vkDeviceWaitIdle(dev);
        [w orderOut:nil];
    }
    return 0;
}
