'use client';

import { VideoDropzone } from '@/components/analyze/video-dropzone';
import { ExtractionTrigger } from '@/components/analyze/extraction-trigger';
import { ExtractionStatus } from '@/components/analyze/extraction-status';

export default function AnalyzePage() {
  return (
    <main className='container mx-auto max-w-4xl space-y-6 py-8'>
      <header>
        <h1 className='text-3xl font-bold'>Analyze video</h1>
        <p className='text-muted-foreground'>
          Drop a lifting video to analyze technique, bar path, and rep velocity.
        </p>
      </header>

      <VideoDropzone />

      <ExtractionTrigger />
      <ExtractionStatus />
    </main>
  );
}
