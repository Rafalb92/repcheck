'use client';

import { VideoDropzone } from '@/components/analyze/video-dropzone';
import { UploadStatus } from '@/components/analyze/upload-status';

export default function AnalyzePage() {
  return (
    <main className="container max-w-4xl mx-auto py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Analyze video</h1>
        <p className="text-muted-foreground">
          Drop a lifting video to analyze technique, bar path, and rep velocity.
        </p>
      </header>

      <VideoDropzone />
      <UploadStatus />
    </main>
  );
}
