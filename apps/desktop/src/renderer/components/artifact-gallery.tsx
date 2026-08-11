import { AlertCircle, ImageIcon, ImagePlus } from 'lucide-react';

import type { Artifact, CreativeRun } from '@museworks/contracts';

import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert';
import { Button } from '@/renderer/components/ui/button';
import { Skeleton } from '@/renderer/components/ui/skeleton';

interface ArtifactGalleryProps {
  run: CreativeRun;
  artifacts: Artifact[];
  onCancel: () => void;
  onRetry: () => void;
}

export function ArtifactGallery({ run, artifacts, onCancel, onRetry }: ArtifactGalleryProps) {
  if (run.status === 'idle') {
    return (
      <section
        aria-labelledby="artifact-gallery-heading"
        className="flex min-h-64 flex-1 flex-col gap-4"
      >
        <h2
          id="artifact-gallery-heading"
          className="text-[17px] leading-normal font-bold text-foreground"
        >
          生成结果
        </h2>
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-[#e4e4e7] bg-[#fcfcfd] px-6 text-center">
          <ImagePlus className="size-8 text-[#5b3df5]" aria-hidden="true" />
          <h3 className="text-base leading-normal font-bold text-foreground">从一句描述开始创作</h3>
          <p className="text-[13px] leading-normal text-muted-foreground">
            填写提示词后，将在这里看到候选图。
          </p>
        </div>
      </section>
    );
  }

  if (run.status === 'running') {
    return (
      <section aria-labelledby="artifact-gallery-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="artifact-gallery-heading"
            className="text-[17px] leading-normal font-bold text-foreground"
          >
            生成结果
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            取消生成
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              data-testid="artifact-loading"
              className="aspect-[4/3] overflow-hidden border border-border bg-muted/50 p-4"
            >
              <Skeleton className="h-full w-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (run.status === 'failed') {
    return (
      <section aria-labelledby="artifact-gallery-heading">
        <Alert variant="destructive" className="mb-3">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>本次创作未能完成</AlertTitle>
          <AlertDescription>
            <p>请调整创作描述后再次生成。</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              重新生成
            </Button>
          </AlertDescription>
        </Alert>
        <h2 id="artifact-gallery-heading" className="sr-only">
          生成结果
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              data-testid="artifact-error"
              className="flex aspect-[4/3] items-center justify-center border border-destructive/30 bg-destructive/5 text-destructive"
            >
              <AlertCircle className="size-5" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="artifact-gallery-heading">
      <h2
        id="artifact-gallery-heading"
        className="mb-3 text-[17px] leading-normal font-bold text-foreground"
      >
        生成结果 · {artifacts.length}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {artifacts.map((artifact, index) => (
          <figure
            key={artifact.id}
            role="img"
            aria-label={`候选图 ${index + 1}`}
            className="flex aspect-[4/3] flex-col justify-between border border-border bg-muted/55 p-4"
          >
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            <figcaption className="text-sm font-medium text-foreground">
              候选图 {index + 1}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
