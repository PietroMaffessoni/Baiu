import { useMemo } from 'react';

import { colorOf, DEFAULT_LOOK, seasonFor, type BaiuColor, type Season } from '@/lib/look';
import { useOptionalStore } from '@/store/store';

export type ResolvedLook = { color: BaiuColor; season: Season | null };

/** Cor escolhida e enfeite da data de hoje, se a pessoa deixou ligado. */
export function useBaiuLook(): ResolvedLook {
  const store = useOptionalStore();
  const look = store?.state.baiu ?? DEFAULT_LOOK;
  const today = new Date().toDateString();
  return useMemo(
    () => ({ color: colorOf(look.color).id, season: look.seasonal ? seasonFor(new Date(today)) : null }),
    [look.color, look.seasonal, today],
  );
}
