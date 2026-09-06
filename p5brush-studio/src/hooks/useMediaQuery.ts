import { useEffect, useState } from 'react';

/** Live media-query match (false during SSR or where matchMedia is missing). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Phone-width layout: below Tailwind's `sm` breakpoint. */
export const PHONE_QUERY = '(max-width: 639px)';
/** Short viewport (a phone in landscape): chrome moves to the sides. */
export const SHORT_QUERY = '(max-height: 500px) and (min-width: 640px)';
/** Touch-first input: bigger targets, keyboard hints hidden. */
export const COARSE_QUERY = '(pointer: coarse)';
