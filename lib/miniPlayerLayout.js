// Shared geometry between HeroVideo (which docks the real <video> element)
// and MiniPlayer (which renders the surrounding bar chrome) so the two stay
// visually aligned without measuring each other's DOM at runtime.
//
// MINI_BAR_HEIGHT is set to fully cover the site's existing sticky nav
// header (~56-57px) once docked, so the mini player visually replaces it at
// the top of the viewport rather than the two overlapping.
export const MINI_BAR_HEIGHT = 60;
export const MINI_THUMB_SIZE = 42;
export const MINI_THUMB_LEFT = 12;
export const MINI_THUMB_TOP = (MINI_BAR_HEIGHT - MINI_THUMB_SIZE) / 2;
