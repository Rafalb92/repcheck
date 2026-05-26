'use client';

import {
    useEffect,
    useRef,
    useState,
    useCallback,
    useImperativeHandle,
    forwardRef,
} from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { getVideo } from '@/lib/storage';

export interface VideoPlayerHandle {
    seekTo: (timeSec: number) => void;
    pause: () => void;
}

interface VideoPlayerProps {
    videoHash: string;
    onTimeUpdate?: (currentTimeSec: number) => void;
    overlay?: (dims: { displayWidth: number; displayHeight: number }) => React.ReactNode;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
    function VideoPlayer({ videoHash, onTimeUpdate, overlay }, ref) {
        const videoRef = useRef<HTMLVideoElement>(null);
        const [objectUrl, setObjectUrl] = useState<string | null>(null);
        const [isPlaying, setIsPlaying] = useState(false);
        const [displayDims, setDisplayDims] = useState({ displayWidth: 0, displayHeight: 0 });

        useImperativeHandle(ref, () => ({
            seekTo: (timeSec: number) => {
                const v = videoRef.current;
                if (!v) return;
                v.currentTime = timeSec;
                onTimeUpdate?.(timeSec);
            },
            pause: () => videoRef.current?.pause(),
        }), [onTimeUpdate]);

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

        const updateDims = useCallback(() => {
            const v = videoRef.current;
            if (!v) return;
            setDisplayDims({ displayWidth: v.clientWidth, displayHeight: v.clientHeight });
        }, []);

        useEffect(() => {
            updateDims();
            window.addEventListener('resize', updateDims);
            return () => window.removeEventListener('resize', updateDims);
        }, [updateDims, objectUrl]);

        // RAF time sync while playing
        useEffect(() => {
            const v = videoRef.current;
            if (!v || !isPlaying) return;
            let raf: number;
            const tick = () => {
                onTimeUpdate?.(v.currentTime);
                raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
            return () => cancelAnimationFrame(raf);
        }, [isPlaying, onTimeUpdate]);

        const togglePlay = () => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) void v.play();
            else v.pause();
        };

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
                    {overlay && displayDims.displayWidth > 0 && (
                        <div className="pointer-events-none absolute inset-0">
                            {overlay(displayDims)}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button size="icon" onClick={togglePlay}>
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        Use Prev/Next pose buttons to step through detections
                    </span>
                </div>
            </div>
        );
    },
);