'use client';

import { useEffect, useRef } from 'react';
import { useExtractionStore } from '@/stores/extraction-store';
import { usePoseStore } from '@/stores/pose-store';

/**
 * Headless: when frame extraction completes (or frames are cached),
 * trigger pose detection.
 */
export function PoseTrigger() {
    const videoHash = useExtractionStore((s) => {
        if (s.state.status === 'complete' || s.state.status === 'cached') {
            return s.state.videoHash;
        }
        return null;
    });

    const startPoseDetection = usePoseStore((s) => s.startPoseDetection);
    const lastTriggeredHashRef = useRef<string | null>(null);

    useEffect(() => {
        if (!videoHash) {
            lastTriggeredHashRef.current = null;
            return;
        }
        if (lastTriggeredHashRef.current === videoHash) return;

        lastTriggeredHashRef.current = videoHash;
        void startPoseDetection(videoHash);
    }, [videoHash, startPoseDetection]);

    return null;
}