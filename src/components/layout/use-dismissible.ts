'use client';

import { useEffect, useState } from 'react';

/**
 * Becomes true a beat after a surface opens.
 *
 * iOS synthesizes the rest of the opening tap onto whatever just appeared under
 * the finger — a drawer overlay, a close button, a menu item. Ignoring dismiss
 * until that tap has finished is what makes the control stay open.
 */
export function useDismissible(open: boolean, delayMs = 400): boolean {
  const [dismissible, setDismissible] = useState(false);

  useEffect(() => {
    if (!open) {
      setDismissible(false);
      return;
    }

    const id = window.setTimeout(() => setDismissible(true), delayMs);
    return () => window.clearTimeout(id);
  }, [open, delayMs]);

  return dismissible;
}
