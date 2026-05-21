'use client';

import { useEffect, useRef } from 'react';
import { useUploadStore } from '@/stores/upload-store';
import { useExtractionStore } from '@/stores/extraction-store';

export function ExtractionTrigger() {
  const videoHash = useUploadStore((s) => {
    if (s.state.status === 'ready' || s.state.status === 'duplicate') {
      return s.state.record.hash;
    }

    return null;
  });

  const startExtraction = useExtractionStore((s) => s.startExtraction);

  /**
   * Local guard only prevents unnecessary repeated effect calls
   * during normal renders.
   *
   * The real protection against duplicate extraction should live
   * inside extraction-store via extractionInFlight lock.
   */
  const lastTriggeredHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (!videoHash) {
      lastTriggeredHashRef.current = null;
      return;
    }

    if (lastTriggeredHashRef.current === videoHash) {
      return;
    }

    lastTriggeredHashRef.current = videoHash;

    void startExtraction(videoHash);
  }, [videoHash, startExtraction]);

  return null;
}
