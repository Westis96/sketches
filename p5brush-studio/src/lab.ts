/**
 * The Pencil lab is a panel for trying Apple Pencil features before they become
 * part of the app. It is shown in builds made with VITE_PENCIL_LAB=1 (the lab
 * artifact) and can be opened in any build with `#lab` in the URL.
 */
export const PENCIL_LAB: boolean =
  import.meta.env.VITE_PENCIL_LAB === '1' ||
  (typeof location !== 'undefined' && /(^|[#?&])lab(=|&|$)/.test(location.hash + location.search));
