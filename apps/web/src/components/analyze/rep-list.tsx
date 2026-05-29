'use client';

import type { Rep, RepSegmentation } from '@repcheck/shared';
import { Button } from '@/components/ui/button';

interface RepListProps {
    segmentation: RepSegmentation;
    onSeekToRep?: (rep: Rep) => void;
}

export function RepList({ segmentation, onSeekToRep }: RepListProps) {
    if (segmentation.repCount === 0) {
        return null;
    }

    // Aggregate stats
    const avgROM =
        segmentation.reps.reduce((sum, r) => sum + r.rangeOfMotion, 0) /
        segmentation.repCount;
    const avgEcc =
        segmentation.reps.reduce((sum, r) => sum + r.eccentricDuration, 0) /
        segmentation.repCount;
    const avgCon =
        segmentation.reps.reduce((sum, r) => sum + r.concentricDuration, 0) /
        segmentation.repCount;

    return (
        <div className="space-y-3 rounded-lg border p-3">
            <div>
                <h3 className="text-sm font-semibold">
                    Reps · {segmentation.repCount} detected
                </h3>
                <p className="text-xs text-muted-foreground">
                    Avg ROM: {Math.round(avgROM)}° · Avg tempo: {avgEcc.toFixed(1)}s ↓ /{' '}
                    {avgCon.toFixed(1)}s ↑
                </p>
            </div>

            <div className="space-y-1">
                {segmentation.reps.map((rep) => (
                    <button
                        key={rep.index}
                        onClick={() => onSeekToRep?.(rep)}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                    >
                        <span className="font-mono font-semibold">
                            Rep {rep.index + 1}
                        </span>
                        <span className="font-mono text-muted-foreground">
                            {rep.topAngle}°→{rep.bottomAngle}° · ROM {rep.rangeOfMotion}° ·{' '}
                            {rep.eccentricDuration}s↓ / {rep.concentricDuration}s↑
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}