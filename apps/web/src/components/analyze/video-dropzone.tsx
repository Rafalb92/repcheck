'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileVideo,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

import { DEFAULT_VALIDATION, useUploadStore } from '@/stores/upload-store';

const BUSY_STATUSES = new Set(['validating', 'hashing', 'storing']);

export function VideoDropzone() {
  const state = useUploadStore((s) => s.state);
  const upload = useUploadStore((s) => s.upload);
  const reset = useUploadStore((s) => s.reset);

  const disabled = BUSY_STATUSES.has(state.status);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      if (!file || disabled) {
        return;
      }

      void upload(file);
    },
    [upload, disabled],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        'video/mp4': ['.mp4'],
        'video/webm': ['.webm'],
        'video/quicktime': ['.mov'],
      },
      multiple: false,
      disabled,
      maxSize: DEFAULT_VALIDATION.maxSizeBytes,
    });

  const acceptedLabels = DEFAULT_VALIDATION.acceptedMimeTypes
    .map((type) => type.split('/')[1]?.toUpperCase())
    .join(', ');

  return (
    <section className='space-y-4'>
      <div
        {...getRootProps()}
        className={cn(
          'flex min-h-64 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          isDragReject
            ? 'border-destructive bg-destructive/5 text-destructive'
            : isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
      >
        <input {...getInputProps()} />

        <UploadIcon
          stateStatus={state.status}
          isDragActive={isDragActive}
          isDragReject={isDragReject}
        />

        <div className='space-y-1'>
          <p className='font-medium'>
            {getTitle({
              status: state.status,
              isDragActive,
              isDragReject,
            })}
          </p>

          <p className='text-sm text-muted-foreground'>
            {acceptedLabels} &middot; Max{' '}
            {formatBytes(DEFAULT_VALIDATION.maxSizeBytes)} &middot; Max{' '}
            {DEFAULT_VALIDATION.maxDurationSec}s
          </p>
        </div>
      </div>

      <UploadStatePanel onReset={reset} />
    </section>
  );
}

function UploadIcon({
  stateStatus,
  isDragActive,
  isDragReject,
}: {
  stateStatus: ReturnType<typeof useUploadStore.getState>['state']['status'];
  isDragActive: boolean;
  isDragReject: boolean;
}) {
  if (BUSY_STATUSES.has(stateStatus)) {
    return (
      <Loader2
        size={48}
        className='shrink-0 animate-spin text-muted-foreground'
      />
    );
  }

  if (stateStatus === 'ready' || stateStatus === 'duplicate') {
    return <CheckCircle2 size={48} className='shrink-0 text-green-600' />;
  }

  if (stateStatus === 'invalid' || stateStatus === 'error' || isDragReject) {
    return <AlertCircle size={48} className='shrink-0 text-destructive' />;
  }

  return (
    <Upload
      size={48}
      className={cn(
        'shrink-0',
        isDragActive ? 'text-primary' : 'text-muted-foreground',
      )}
    />
  );
}

function getTitle({
  status,
  isDragActive,
  isDragReject,
}: {
  status: ReturnType<typeof useUploadStore.getState>['state']['status'];
  isDragActive: boolean;
  isDragReject: boolean;
}) {
  if (isDragReject) {
    return 'Unsupported file type';
  }

  switch (status) {
    case 'validating':
      return 'Validating video...';

    case 'hashing':
      return 'Preparing video...';

    case 'storing':
      return 'Saving video locally...';

    case 'ready':
      return 'Video uploaded';

    case 'duplicate':
      return 'Video already uploaded';

    case 'invalid':
      return 'Video rejected';

    case 'error':
      return 'Upload failed';

    default:
      return isDragActive ? 'Drop to upload' : 'Drop a video or click to pick';
  }
}

function UploadStatePanel({ onReset }: { onReset: () => void }) {
  const state = useUploadStore((s) => s.state);

  switch (state.status) {
    case 'idle':
      return null;

    case 'validating':
      return (
        <UploadProgressCard
          title='Checking video'
          description={`Validating ${state.filename}`}
          progress={null}
        />
      );

    case 'hashing':
      return (
        <UploadProgressCard
          title='Preparing video'
          description={`Calculating file hash for ${state.filename}`}
          progress={state.progress}
        />
      );

    case 'storing':
      return (
        <UploadProgressCard
          title='Saving video'
          description={`Saving ${state.filename} in local storage`}
          progress={null}
        />
      );

    case 'ready':
      return (
        <Alert>
          <FileVideo size={16} />
          <AlertTitle>Video ready</AlertTitle>
          <AlertDescription className='flex flex-col gap-3'>
            <span>
              {state.record.filename} has been saved locally. Frame extraction
              should start automatically.
            </span>

            <Button
              type='button'
              size='sm'
              variant='outline'
              className='w-fit'
              onClick={onReset}
            >
              <RotateCcw size={16} />
              Choose another video
            </Button>
          </AlertDescription>
        </Alert>
      );

    case 'duplicate':
      return (
        <Alert>
          <FileVideo size={16} />
          <AlertTitle>Duplicate video</AlertTitle>
          <AlertDescription className='flex flex-col gap-3'>
            <span>
              {state.record.filename} is already stored locally. Cached frames
              will be reused if extraction was completed before.
            </span>

            <Button
              type='button'
              size='sm'
              variant='outline'
              className='w-fit'
              onClick={onReset}
            >
              <RotateCcw size={16} />
              Choose another video
            </Button>
          </AlertDescription>
        </Alert>
      );

    case 'invalid':
      return (
        <Alert variant='destructive'>
          <AlertCircle size={16} />
          <AlertTitle>Invalid video</AlertTitle>
          <AlertDescription className='flex flex-col gap-3'>
            <span>
              {state.filename}: {state.reason}
            </span>

            <Button
              type='button'
              size='sm'
              variant='outline'
              className='w-fit'
              onClick={onReset}
            >
              Try another video
            </Button>
          </AlertDescription>
        </Alert>
      );

    case 'error':
      return (
        <Alert variant='destructive'>
          <AlertCircle size={16} />
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription className='flex flex-col gap-3'>
            <span>{state.message}</span>

            <Button
              type='button'
              size='sm'
              variant='outline'
              className='w-fit'
              onClick={onReset}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
  }
}

function UploadProgressCard({
  title,
  description,
  progress,
}: {
  title: string;
  description: string;
  progress: number | null;
}) {
  return (
    <Card>
      <CardContent className='flex flex-col gap-3 py-4'>
        <div className='flex items-center gap-3'>
          <Loader2
            size={18}
            className='shrink-0 animate-spin text-muted-foreground'
          />

          <div className='space-y-0.5'>
            <p className='text-sm font-medium'>{title}</p>
            <p className='text-xs text-muted-foreground'>{description}</p>
          </div>
        </div>

        {progress === null ? (
          <Progress value={0} className='animate-pulse' />
        ) : (
          <Progress value={progress * 100} />
        )}
      </CardContent>
    </Card>
  );
}
