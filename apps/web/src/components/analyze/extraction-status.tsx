'use client';

import { Loader2, AlertCircle, CheckCircle2, FileVideo } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useExtractionStore } from '@/stores/extraction-store';
import { useUploadStore } from '@/stores/upload-store';

const PHASE_LABELS: Record<string, string> = {
  loading_ffmpeg: 'Loading FFmpeg',
  probing: 'Reading metadata',
  extracting: 'Extracting frames',
  storing: 'Saving frames',
  done: 'Done',
};

export function ExtractionStatus() {
  const state = useExtractionStore((s) => s.state);
  const resetExtraction = useExtractionStore((s) => s.reset);
  const resetUpload = useUploadStore((s) => s.reset);

  function handleRetry() {
    resetExtraction();
    resetUpload();
  }

  switch (state.status) {
    case 'idle':
      return null;

    case 'checking_cache':
      return (
        <Card>
          <CardContent className='flex items-center gap-3 py-4'>
            <Loader2 className='animate-spin text-muted-foreground' size={18} />
            <span className='text-sm'>Checking for cached frames…</span>
          </CardContent>
        </Card>
      );

    case 'cached':
      return (
        <Alert>
          <FileVideo size={16} />
          <AlertTitle>Frames ready</AlertTitle>
          <AlertDescription className='flex flex-col gap-3'>
            <span>
              {state.frameCount} frames already extracted (from cache).
            </span>
            <Button size='sm' className='w-fit' onClick={() => {}}>
              Continue to analysis
            </Button>
          </AlertDescription>
        </Alert>
      );

    case 'running': {
      const { progress } = state;
      const phaseLabel = PHASE_LABELS[progress.phase] ?? progress.phase;
      const isDeterminate = progress.ratio !== null;

      return (
        <Card>
          <CardContent className='flex flex-col gap-3 py-4'>
            <div className='flex items-center gap-3'>
              <Loader2
                className='animate-spin text-muted-foreground shrink-0'
                size={18}
              />
              <span className='text-sm'>{progress.message}</span>
            </div>

            {progress.ratio !== null ? (
              <Progress value={progress.ratio * 100} />
            ) : (
              <Progress value={0} className='animate-pulse' />
            )}

            <p className='text-xs text-muted-foreground'>{phaseLabel}</p>
          </CardContent>
        </Card>
      );
    }

    case 'complete':
      return (
        <Alert>
          <CheckCircle2 size={16} className='text-green-600' />
          <AlertTitle>Extraction complete</AlertTitle>
          <AlertDescription className='flex flex-col gap-3'>
            <span>Extracted {state.frameCount} frames.</span>
            <Button size='sm' className='w-fit' onClick={() => {}}>
              Continue to analysis
            </Button>
          </AlertDescription>
        </Alert>
      );

    case 'error':
      return (
        <Alert variant='destructive'>
          <AlertCircle size={16} />
          <AlertTitle>Extraction failed</AlertTitle>
          <AlertDescription className='flex flex-col gap-3'>
            <span>{state.message}</span>
            <Button
              size='sm'
              variant='outline'
              onClick={handleRetry}
              className='w-fit'
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
  }
}
