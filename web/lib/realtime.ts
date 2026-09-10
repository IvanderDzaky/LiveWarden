'use client';

import { useEffect, useRef, useState } from 'react';

export type RealtimeState = 'connecting' | 'open' | 'retrying';
export const realtimeEventNames = ['stream.status', 'stream.viewer_count', 'stream.comment', 'stream.like', 'stream.gift', 'stream.alert'] as const;
export const realtimeStreamUrl = (streamId: string) => `/api/streams/${encodeURIComponent(streamId)}/live`;
export const realtimeUserUrl = '/api/live';

export function useRealtime(url: string, refresh: () => void) {
  const refreshRef = useRef(refresh);
  const [state, setState] = useState<RealtimeState>('connecting');
  refreshRef.current = refresh;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(), 150);
    };
    const source = new EventSource(url);
    source.onopen = () => { setState('open'); scheduleRefresh(); };
    source.onerror = () => { setState('retrying'); scheduleRefresh(); };
    source.addEventListener('stream.ready', scheduleRefresh);
    source.addEventListener('stream.resync', scheduleRefresh);
    for (const name of realtimeEventNames) source.addEventListener(name, scheduleRefresh);
    return () => { if (timer) clearTimeout(timer); source.close(); };
  }, [url]);

  return state;
}

export const useStreamRealtime = (streamId: string, refresh: () => void) => useRealtime(realtimeStreamUrl(streamId), refresh);
