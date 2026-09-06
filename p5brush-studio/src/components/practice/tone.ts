/** Colour class for a step's result: skipped (hatched), pending (hint), then by score band. */
export const resultTone = (r: number | null | undefined) =>
  r === null ? 'bg-[repeating-linear-gradient(45deg,#d9d5cd_0_3px,#eeeae2_3px_6px)]'
  : r === undefined ? 'bg-[var(--hint)]'
  : r >= 85 ? 'bg-[var(--success)]' : r >= 70 ? 'bg-[var(--lvl)]' : r >= 50 ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]';
