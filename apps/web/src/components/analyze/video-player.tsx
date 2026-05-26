'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { getVideo } from '@/lib/storage';

interface VideoPlayerProps {
    videoHash: string;
    /**
     * Called on every frame tick with the current playback time (seconds).
     * The overlay uses this to pick which pose frame to draw.
     */
    onTimeUpdate?: (currentTimeSec: number) => void;
    /**
     * Render-prop for overlay content positioned exactly over the video.
     * Receives the displayed video dimensions so the overlay can scale.
     */
    overlay?: (dims: { displayWidth: number; displayHeight: number }) => React.ReactNode;
}

export function VideoPlayer({ videoHash, onTimeUpdate, overlay }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [displayDims, setDisplayDims] = useState({ displayWidth: 0, displayHeight: 0 });

    // Load video Blob from storage → object URL
    useEffect(() => {
        let url: string | null = null;
        let cancelled = false;

        (async () => {
            const record = await getVideo(videoHash);
            if (!record || cancelled) return;
            url = URL.createObjectURL(record.blob);
            setObjectUrl(url);
        })();

        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [videoHash]);

    // Track displayed video size (for overlay scaling) — updates on resize too
    const updateDims = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        setDisplayDims({
            displayWidth: v.clientWidth,
            displayHeight: v.clientHeight,
        });
    }, []);

    useEffect(() => {
        updateDims();
        window.addEventListener('resize', updateDims);
        return () => window.removeEventListener('resize', updateDims);
    }, [updateDims, objectUrl]);

    return (
        <div className="space-y-3">
            <div className="relative inline-block">
                {objectUrl && (
                    <video
                        ref={videoRef}
                        src={objectUrl}
                        className="block max-h-[70vh] w-auto rounded-lg"
                        onLoadedMetadata={updateDims}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        playsInline
                    />
                )}

                {/* Overlay layer — absolutely positioned over the video */}
                {overlay && displayDims.displayWidth > 0 && (
                    <div className="pointer-events-none absolute inset-0">
                        {overlay(displayDims)}
                    </div>
                )}
            </div>

            <PlayerControls
                videoRef={videoRef}
                isPlaying={isPlaying}
                onTimeUpdate={onTimeUpdate}
            />
        </div>
    );
}

function PlayerControls({
    videoRef,
    isPlaying,
    onTimeUpdate,
}: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    onTimeUpdate?: (t: number) => void;
}) {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const rafRef = useRef<number | null>(null);

    // Drive time updates via requestVideoFrameCallback if available,
    // else fall back to requestAnimationFrame. This keeps the overlay
    // in sync with actual rendered video frames.
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const tick = () => {
            setCurrentTime(v.currentTime);
            onTimeUpdate?.(v.currentTime);
            rafRef.current = requestAnimationFrame(tick);
        };

        if (isPlaying) {
            rafRef.current = requestAnimationFrame(tick);
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying, videoRef, onTimeUpdate]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onMeta = () => setDuration(v.duration);
        v.addEventListener('loadedmetadata', onMeta);
        return () => v.removeEventListener('loadedmetadata', onMeta);
    }, [videoRef]);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) void v.play();
        else v.pause();
    };

    const seek = (t: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = t;
        setCurrentTime(t);
        onTimeUpdate?.(t);
    };

    const stepFrame = (dir: 1 | -1) => {
        const v = videoRef.current;
        if (!v) return;
        v.pause();
        // Approximate one frame step. We don't know exact fps here,
        // so use a small delta — refined later if needed.
        const delta = (1 / 30) * dir;
        seek(Math.max(0, Math.min(v.duration, v.currentTime + delta)));
    };

    return (
        <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => stepFrame(-1)}>
                <ChevronLeft size={16} />
            </Button>

            <Button size="icon" onClick={togglePlay}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>

            <Button size="icon" variant="outline" onClick={() => stepFrame(1)}>
                <ChevronRight size={16} />
            </Button>

            <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-1"
            />

            <span className="w-20 text-right font-mono text-xs text-muted-foreground">
                {currentTime.toFixed(2)}s
            </span>
        </div>
    );
}