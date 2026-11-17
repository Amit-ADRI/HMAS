'use client';

import { useEffect } from 'react';

// Refresh operational screens periodically and whenever the user returns to the tab.
export function useAutoRefresh(refresh, intervalMs = 30000) {
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh, intervalMs]);
}
