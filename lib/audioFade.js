// Simple volume-ramp fades for the ambient audio signal — no Web Audio API
// needed here, since there's no audio-reactive visualization to drive (the
// content is spoken narration, not music). Pure volume interpolation over a
// setInterval is plenty smooth for a fade this short.
//
// Ramps `audio.volume` from `from` to `to` over `duration` ms. Returns the
// interval ID so the caller can cancel it (e.g. a rapid second toggle
// shouldn't leave two ramps fighting over the same audio element's volume).
export function rampVolume(audio, from, to, duration, onComplete) {
  const steps = 30;
  const stepTime = duration / steps;
  let currentStep = 0;
  audio.volume = from;
  const interval = setInterval(() => {
    currentStep++;
    const t = currentStep / steps;
    audio.volume = from + (to - from) * t;
    if (currentStep >= steps) {
      clearInterval(interval);
      audio.volume = to;
      if (onComplete) onComplete();
    }
  }, stepTime);
  return interval;
}
