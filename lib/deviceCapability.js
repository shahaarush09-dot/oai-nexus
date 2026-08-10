"use client";

// Two-stage adaptive quality: a cheap synchronous device-signal heuristic
// decides what to render on FIRST mount (particle count, whether
// postprocessing exists at all), then a non-blocking post-mount FPS sample
// can downgrade high -> low reactively for desktop machines with weak GPUs
// the heuristic alone wouldn't catch. Neither stage blocks first paint.

// Known-weak GPU families. Matched against the unmasked WebGL renderer
// string, which is the only direct signal about the actual graphics
// hardware available from JS. Intentionally conservative — this catches
// integrated and mobile parts that reliably struggle with a multi-pass
// scene, not merely older discrete cards.
const WEAK_GPU =
  /(intel).*(hd graphics|uhd graphics|iris|gma)|mali|adreno [1-5]|powervr|videocore|swiftshader|llvmpipe|software/i;

// Iris Xe is the exception carved out of the Intel branch above. It is
// integrated, so it matches "iris", but it is a generation ahead of the
// HD/UHD/older-Iris parts and measurably holds 60fps on this scene. Note
// the renderer string spells it "Iris(R) Xe", not "Iris Xe" — a naive
// `iris(?! xe)` lookahead silently fails to exclude it, which is exactly
// the false positive this pattern exists to fix.
const IRIS_XE = /iris\W*(\(r\))?\W*xe/i;

function detectRenderer() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return { renderer: null, noWebGL: true };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    // Contexts are a limited resource; release this one immediately rather
    // than leaving it to GC, which can starve the real canvas.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { renderer: String(renderer || ""), noWebGL: false };
  } catch {
    return { renderer: null, noWebGL: false };
  }
}

// Memoized for the page's lifetime. This is NOT a micro-optimisation.
// There are five live call sites, and two of them call from a component
// BODY rather than an effect — so the result is recomputed on every
// render. Since this function now creates a WebGL context to read the
// unmasked renderer string, an unmemoized version spins up and destroys a
// context per render. Browsers cap concurrent WebGL contexts (Chrome at
// ~16) and evict the OLDEST when the cap is hit — which is the real scene
// canvas. That is a context-loss bug that would never appear on a fast
// machine with few re-renders and would be near-impossible to attribute
// on a slow one. The inputs (GPU, screen, cores) cannot change mid-session
// anyway, so caching costs nothing.
let cachedTier;

export function getInitialQualityTier() {
  if (typeof window === "undefined") return "high";
  if (cachedTier !== undefined) return cachedTier;
  cachedTier = computeInitialQualityTier();
  return cachedTier;
}

function computeInitialQualityTier() {

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reduceMotion) return "minimal";

  const lowCores = (navigator.hardwareConcurrency || 8) <= 4;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport = window.innerWidth < 768;

  // Two signals the original heuristic missed entirely, both of which can
  // make a machine that looks capable on paper perform badly here:
  //
  //  - PIXEL COUNT. The lab is fill-bound, so what matters is how many
  //    pixels each pass has to cover, not how many cores the CPU has. A
  //    4K panel is ~4x the fill of a 1080p one for identical scene
  //    content, and a 16-core laptop driving a 4K display was previously
  //    classified "high" purely on core count.
  //  - THE GPU ITSELF. Nothing in the old heuristic looked at the actual
  //    graphics hardware, so a powerful CPU paired with weak integrated
  //    graphics — an extremely common laptop configuration — was treated
  //    as a high-end machine.
  const pixels = window.screen
    ? window.screen.width * window.screen.height * (window.devicePixelRatio || 1)
    : 0;
  const hugeDisplay = pixels > 4_500_000; // beyond ~1440p at 1x
  const lowMemory = (navigator.deviceMemory || 8) <= 4;

  const { renderer, noWebGL } = detectRenderer();
  // Static detection is for GPUs known to struggle. Anything borderline is
  // left to the runtime frame-time monitor in LabScene, which measures the
  // machine actually in front of the user rather than guessing from a
  // string — a far better signal, just one that only exists after the
  // scene is already running.
  const weakGpu = renderer
    ? WEAK_GPU.test(renderer) && !IRIS_XE.test(renderer)
    : false;

  if (noWebGL) return "minimal";

  const tier =
    lowCores || coarsePointer || narrowViewport || weakGpu || (hugeDisplay && lowMemory)
      ? "low"
      : "high";

  console.info(`[deviceCapability] initial tier: ${tier}`, {
    lowCores,
    coarsePointer,
    narrowViewport,
    weakGpu,
    hugeDisplay,
    lowMemory,
    pixels,
    renderer,
    hardwareConcurrency: navigator.hardwareConcurrency,
  });
  return tier;
}

// Samples FPS via requestAnimationFrame for `sampleMs`, then calls
// onResult('low' | 'high', fps). Returns a cancel function.
//
// Measurement only starts after `warmupMs` has elapsed post-mount — this is
// the fix for a real bug, not just tuning: sampling from t=0 measures
// one-time WebGL shader-compilation and buffer-upload cost (routinely
// 100ms+, sometimes much more with postprocessing shaders in the mix) as if
// it were steady-state frame time, which tanks the average and triggers a
// false-positive downgrade on essentially any device, not just slow ones.
// Warming up first means the sample reflects actual sustained performance.
export function sampleFps(sampleMs, onResult, warmupMs = 800) {
  if (typeof window === "undefined") return () => {};
  let frames = 0;
  let start = null;
  let warmupStart = null;
  let warmedUp = false;
  let rafId;
  let cancelled = false;

  function tick(t) {
    if (cancelled) return;

    // Browsers throttle requestAnimationFrame hard in a backgrounded or
    // non-composited tab — often to a frame or two per second. Sampling
    // through that measures the throttle, not the hardware, and reports
    // something like 2fps on a machine that is perfectly capable. That
    // then permanently downgrades quality for the whole session.
    // Anyone who opens the page in a background tab and switches to it
    // later would get the degraded experience for no reason. Restart the
    // measurement instead of trusting it.
    if (typeof document !== "undefined" && document.hidden) {
      warmedUp = false;
      warmupStart = null;
      frames = 0;
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (!warmedUp) {
      if (warmupStart === null) warmupStart = t;
      if (t - warmupStart >= warmupMs) {
        warmedUp = true;
        start = t;
      }
      rafId = requestAnimationFrame(tick);
      return;
    }

    frames++;
    const elapsed = t - start;
    if (elapsed >= sampleMs) {
      const fps = (frames / elapsed) * 1000;
      const result = fps >= 45 ? "high" : "low";
      console.info(`[deviceCapability] FPS sample: ${fps.toFixed(1)}fps -> ${result}`);
      onResult(result, fps);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}
