'use client';

import { Loader2, AlertCircle, CheckCircle2, Activity } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePoseStore } from '@/stores/pose-store';

export function PoseStatus() {
    const state = usePoseStore((s) => s.state);

    switch (state.status) {
        case 'idle':
            return null;

        case 'checking_cache':
            return (
                <Card>
                    <CardContent className="flex items-center gap-3 py-4">
                        <Loader2 className="animate-spin text-muted-foreground" size={18} />
                        <span className="text-sm">Checking for cached poses…</span>
                    </CardContent>
                </Card>
            );

        case 'cached':
            return (
                <Alert>
                    <Activity size={16} />
                    <AlertTitle>Poses ready</AlertTitle>
                    <AlertDescription>
                        {state.poseFrameCount} poses detected (from cache).
                    </AlertDescription>
                </Alert>
            );

        case 'running':
            return (
                <Card>
                    <CardContent className="flex flex-col gap-3 py-4">
                        <div className="flex items-center gap-3">
                            <Loader2 className="animate-spin text-muted-foreground shrink-0" size={18} />
                            <span className="text-sm">{state.progress.message}</span>
                        </div>
                        {state.progress.ratio !== null ? (
                            <Progress value={state.progress.ratio * 100} />
                        ) : (
                            <Progress value={0} className="animate-pulse" />
                        )}
                    </CardContent>
                </Card>
            );

        case 'complete':
            return (
                <Alert>
                    <CheckCircle2 size={16} className="text-green-600" />
                    <AlertTitle>Pose detection complete</AlertTitle>
                    <AlertDescription>
                        Detected poses in {state.poseFrameCount} frames.
                    </AlertDescription>
                </Alert>
            );

        case 'error':
            return (
                <Alert variant="destructive">
                    <AlertCircle size={16} />
                    <AlertTitle>Pose detection failed</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                </Alert>
            );
    }
}