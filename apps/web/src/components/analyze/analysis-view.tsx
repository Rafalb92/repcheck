'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { computeAllAngles, computeFrameAngles } from '@/lib/metrics/joint-angles';
import type { PoseFrame, Keypoint, FrameAngles, Rep } from '@repcheck/shared';
import { getAnalysis, getFramesForVideo } from '@/lib/storage';
import { findClosestPoseFrame } from '@/lib/pose/find-pose-frame';
import { VideoPlayer, type VideoPlayerHandle } from './video-player';
import { SkeletonOverlay } from './skeleton-overlay';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { segmentReps } from '@/lib/metrics/rep-segmentation';
import { AngleChart } from './angle-chart';
import { RepList } from './rep-list';

interface AnalysisViewProps {
    videoHash: string;
}

export function AnalysisView({ videoHash }: AnalysisViewProps) {
    const [poseFrames, setPoseFrames] = useState<PoseFrame[]>([]);
    const [sourceDims, setSourceDims] = useState({ width: 0, height: 0 });
    const [currentPose, setCurrentPose] = useState<PoseFrame | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const playerRef = useRef<VideoPlayerHandle>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const analysis = await getAnalysis(videoHash);
            const frames = await getFramesForVideo(videoHash);
            if (cancelled) return;
            setPoseFrames(analysis?.poseFrames ?? []);
            if (frames.length > 0) {
                setSourceDims({ width: frames[0].width, height: frames[0].height });
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [videoHash]);

    // During playback, sync pose by time
    const handleTimeUpdate = useCallback(
        (timeSec: number) => {
            const pose = findClosestPoseFrame(poseFrames, timeSec);
            setCurrentPose(pose);
            if (pose) {
                const idx = poseFrames.indexOf(pose);
                if (idx >= 0) setCurrentIndex(idx);
            }
        },
        [poseFrames],
    );

    // Step to a specific pose index
    const goToPose = useCallback(
        (index: number) => {
            const clamped = Math.max(0, Math.min(poseFrames.length - 1, index));
            const pose = poseFrames[clamped];
            if (!pose) return;
            setCurrentIndex(clamped);
            setCurrentPose(pose);
            playerRef.current?.pause();
            playerRef.current?.seekTo(pose.timestamp);
        },
        [poseFrames],
    );

    const currentAngles: FrameAngles | null = currentPose
        ? computeFrameAngles(currentPose)
        : null;

    
    // Compute angles + reps when pose data loads
    const allAngles = poseFrames.length > 0 ? computeAllAngles(poseFrames) : [];

    // Estimate fps from timestamps (more reliable than stored video fps,
    // because we extracted at a different rate)
    const estimatedFps =
        allAngles.length >= 2
            ? 1 / (allAngles[1].timestamp - allAngles[0].timestamp)
            : 12;

    const segmentation =
        allAngles.length > 0
            ? segmentReps(allAngles, estimatedFps)
            : { jointName: '', repCount: 0, reps: [] };

    // Handler: seek video to a specific rep's bottom
    const seekToRep = (rep: Rep) => {
        playerRef.current?.pause();
        playerRef.current?.seekTo(rep.bottomTime);
    };

    // Handler: seek video from chart click
    const seekToTime = (timeSec: number) => {
        playerRef.current?.seekTo(timeSec);
    };

    const currentTime = currentPose?.timestamp ?? 0;


    if (loading) return <p className="text-sm text-muted-foreground">Loading analysis…</p>;
    if (poseFrames.length === 0)
        return <p className="text-sm text-muted-foreground">No pose data available.</p>;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row">
                <div className="flex-1 space-y-4">
                    <VideoPlayer
                        ref={playerRef}
                        videoHash={videoHash}
                        onTimeUpdate={handleTimeUpdate}
                        overlay={({ displayWidth, displayHeight }) => (
                            <SkeletonOverlay
                                poseFrame={currentPose}
                                sourceWidth={sourceDims.width}
                                sourceHeight={sourceDims.height}
                                displayWidth={displayWidth}
                                displayHeight={displayHeight}
                                frameAngles={currentAngles}
                                showAngles={true}
                            />
                        )}
                    />

                    {/* Pose stepper (existing) */}
                    <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" onClick={() => goToPose(currentIndex - 1)}>
                            <ChevronLeft size={16} />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => goToPose(currentIndex + 1)}>
                            <ChevronRight size={16} />
                        </Button>
                        <span className="font-mono text-sm text-muted-foreground">
                            Pose {currentIndex + 1} / {poseFrames.length}
                            {currentPose && ` · ${currentPose.timestamp.toFixed(2)}s`}
                        </span>
                    </div>

                    {/* Chart — full width below player */}
                    <AngleChart
                        frameAngles={allAngles}
                        segmentation={segmentation}
                        currentTime={currentTime}
                        onSeek={seekToTime}
                    />
                </div>

                <div className="space-y-4 lg:w-72">
                    <RepList segmentation={segmentation} onSeekToRep={seekToRep} />
                    <KeypointDebugPanel pose={currentPose} angles={currentAngles} />
                </div>
            </div>
        </div>
    );
}

function KeypointDebugPanel({ pose, angles }: { pose: PoseFrame | null; angles: FrameAngles | null }) {
    if (!pose) return null;

    return (
        <div className="w-full shrink-0 space-y-4 rounded-lg border p-3 lg:w-72">
            {/* Angles section */}
            {angles && angles.angles.length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold">Joint angles</h3>
                    <div className="space-y-1">
                        {angles.angles.map((a) => {
                            const hue = a.confidence * 120;
                            return (
                                <div
                                    key={a.name}
                                    className="flex items-center justify-between gap-2 text-xs"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <span
                                            className="inline-block h-2 w-2 rounded-full"
                                            style={{ backgroundColor: `hsl(${hue}, 90%, 50%)` }}
                                        />
                                        {a.name}
                                    </span>
                                    <span className="font-mono text-muted-foreground">
                                        {Math.round(a.degrees)}° · {a.confidence.toFixed(2)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Keypoints section */}
            <div>
                <h3 className="mb-2 text-sm font-semibold">
                    Keypoints · frame #{pose.frameIndex}
                </h3>
                <div className="space-y-1">
                    {pose.keypoints.map((kp) => (
                        <KeypointRow key={kp.name} kp={kp} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function KeypointRow({ kp }: { kp: Keypoint }) {
    const hue = kp.score * 120;
    return (
        <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5">
                <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: `hsl(${hue}, 90%, 50%)` }}
                />
                {kp.name}
            </span>
            <span className="font-mono text-muted-foreground">
                {kp.score.toFixed(2)} · {Math.round(kp.x)},{Math.round(kp.y)}
            </span>
        </div>
    );
}