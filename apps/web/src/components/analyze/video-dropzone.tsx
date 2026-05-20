'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUploadStore } from '@/stores/upload-store';
import { DEFAULT_VALIDATION } from '@/stores/upload-store';
import { formatBytes } from '@/lib/utils';

const BUSY_STATUSES = new Set(['validating', 'hashing', 'storing']);

export function VideoDropzone() {
  const state = useUploadStore((s) => s.state);
  const upload = useUploadStore((s) => s.upload);

  const disabled = BUSY_STATUSES.has(state.status);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) void upload(accepted[0]);
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': [],
      'video/webm': [],
      'video/quicktime': [],
    },
    multiple: false,
    disabled,
  });

  const acceptedLabels = DEFAULT_VALIDATION.acceptedMimeTypes
    .map((t) => t.split('/')[1].toUpperCase())
    .join(', ');

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-colors',
        isDragReject
          ? 'border-destructive bg-destructive/5 text-destructive'
          : isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input {...getInputProps()} />

      <Upload
        size={48}
        className={cn(
          'shrink-0',
          isDragReject ? 'text-destructive' : isDragActive ? 'text-primary' : 'text-muted-foreground',
        )}
      />

      {isDragReject ? (
        <p className="font-medium">Unsupported file type</p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="font-medium">
              {isDragActive ? 'Drop to upload' : 'Drop a video or click to pick'}
            </p>
            <p className="text-sm text-muted-foreground">
              {acceptedLabels} &middot; Max {formatBytes(DEFAULT_VALIDATION.maxSizeBytes)} &middot;{' '}
              Max {DEFAULT_VALIDATION.maxDurationSec}s
            </p>
          </div>
        </>
      )}
    </div>
  );
}
