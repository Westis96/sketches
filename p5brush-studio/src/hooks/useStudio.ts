import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Studio, StudioState } from '@/engine/Studio';

export const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const studio = useContext(StudioContext);
  if (!studio) throw new Error('useStudio must be used inside <StudioContext.Provider>');
  return studio;
}

/** Subscribes to a slice of the studio state. */
export function useStudioState<T>(selector: (s: StudioState) => T): T {
  const studio = useStudio();
  return useSyncExternalStore(studio.subscribe, () => selector(studio.getState()), () => selector(studio.getState()));
}
