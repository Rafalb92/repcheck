'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PoseFrame } from '@repcheck/shared';
import { getAnalysis, getFramesForVideo } from '@/lib/storage';
import { findClosestPoseFrame } from '@/lib/pose/find-pose-frame';
import { VideoPlayer } from './video-player';
import { SkeletonOverlay } from './skeleton-overlay';

interface AnalysisViewProps {
    videoHash: string;
}

export function AnalysisView({ videoHash }: AnalysisViewProps) {
    const [poseFrames, setPoseFrames] = useState<PoseFrame[]>([]);
    const [sourceDims, setSourceDims] = useState({ width: 0, height: 0 });
    const [currentPose, setCurrentPose] = useState<PoseFrame | null>(null);
    const [loading, setLoading] = useState(true);

    // Load pose frames + source dimensions from storage
    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);

            const analysis = await getAnalysis(videoHash);
            const frames = await getFramesForVideo(videoHash);

            if (cancelled) return;

            setPoseFrames(analysis?.poseFrames ?? []);

            // Source coordinate space = extracted frame dimensions (now correct: 640×N)
            if (frames.length > 0) {
                setSourceDims({ width: frames[0].width, height: frames[0].height });
            }

            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [videoHash]);

    // On each playback tick, pick the matching pose
    const handleTimeUpdate = useCallback(
        (timeSec: number) => {
            const pose = findClosestPoseFrame(poseFrames, timeSec);
            setCurrentPose(pose);
        },
        [poseFrames],
    );

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading analysis…</p>;
    }

    if (poseFrames.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No pose data available for this video.
            </p>
        );
    }

    return (
        <VideoPlayer
            videoHash={videoHash}
            onTimeUpdate={handleTimeUpdate}
            overlay={({ displayWidth, displayHeight }) => (
                <SkeletonOverlay
                    poseFrame={currentPose}
                    sourceWidth={sourceDims.width}
                    sourceHeight={sourceDims.height}
                    displayWidth={displayWidth}
                    displayHeight={displayHeight}
                />
            )}
        />
    );
}