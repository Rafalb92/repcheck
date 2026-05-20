'use client';

import { Loader2, AlertCircle, CheckCircle2, FileVideo } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUploadStore } from '@/stores/upload-store';

export function UploadStatus() {
  const state = useUploadStore((s) => s.state);
  const reset = useUploadStore((s) => s.reset);

  switch (state.status) {
    case 'idle':
      return null;

    case 'validating':
      return (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="animate-spin text-muted-foreground" size={18} />
            <span className="text-sm">Validating {state.filename}…</span>
          </CardContent>
        </Card>
      );

    case 'hashing':
      return (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="animate-spin text-muted-foreground" size={18} />
            <span className="text-sm">Hashing {state.filename}…</span>
          </CardContent>
        </Card>
      );

    case 'storing':
      return (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="animate-spin text-muted-foreground" size={18} />
            <span className="text-sm">Saving {state.filename}…</span>
          </CardContent>
        </Card>
      );

    case 'invalid':
      return (
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertTitle>Invalid file</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{state.reason}</span>
            <Button size="sm" variant="outline" onClick={reset} className="w-fit">
              Try another
            </Button>
          </AlertDescription>
        </Alert>
      );

    case 'duplicate':
      return (
        <Alert>
          <FileVideo size={16} />
          <AlertTitle>Already uploaded</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>This video is already in your library. Loaded existing.</span>
            <div className="flex gap-2">
              <Button size="sm">Continue</Button>
              <Button size="sm" variant="outline" onClick={reset}>
                Pick another
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );

    case 'ready': {
      const { record } = state;
      return (
        <Alert>
          <CheckCircle2 size={16} className="text-green-600" />
          <AlertTitle>Video ready</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span className="text-muted-foreground">
              {record.filename} &middot; {record.durationSec.toFixed(1)}s &middot; {record.width}x
              {record.height}
            </span>
            <div className="flex gap-2">
              <Button size="sm">Continue to analysis</Button>
              <Button size="sm" variant="outline" onClick={reset}>
                Pick another
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    case 'error':
      return (
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{state.message}</span>
            <Button size="sm" variant="outline" onClick={reset} className="w-fit">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
  }
}
