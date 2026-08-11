import { AlertCircle } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

import type {
  Artifact,
  CreativeRun,
  CreativeTask,
  GenerationOptions,
  WorkspaceErrorCode,
} from '@museworks/contracts';

import { ArtifactGallery } from '@/renderer/components/artifact-gallery';
import { CreativeComposer } from '@/renderer/components/creative-composer';
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert';
import { cn } from '@/renderer/lib/utils';
import { workspaceErrorMessage } from '@/renderer/lib/workspace-errors';

interface CreativeWorkspaceProps {
  task: CreativeTask;
  run: CreativeRun;
  artifacts: Artifact[];
  onSubmit: (instruction: string, options: GenerationOptions) => void;
  onCancel: () => void;
  onRetry: () => void;
  workspaceError: WorkspaceErrorCode | null;
}

export function CreativeWorkspace({
  task,
  run,
  artifacts,
  onSubmit,
  onCancel,
  onRetry,
  workspaceError,
}: CreativeWorkspaceProps) {
  const errorMessage = workspaceErrorMessage(workspaceError);
  const isEmpty = run.status === 'idle';
  const composerContainerRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const composerBottomOffset = composerHeight + 24;

  useLayoutEffect(() => {
    const composerContainer = composerContainerRef.current;
    const scrollViewport = scrollViewportRef.current;

    if (!composerContainer || !scrollViewport) {
      return;
    }

    const updateLayoutMeasurements = () => {
      setComposerHeight(Math.ceil(composerContainer.getBoundingClientRect().height));
      setScrollbarWidth(Math.max(0, scrollViewport.offsetWidth - scrollViewport.clientWidth));
    };

    updateLayoutMeasurements();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(updateLayoutMeasurements);
    resizeObserver.observe(composerContainer);
    resizeObserver.observe(scrollViewport);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <main className="relative min-h-0 min-w-0 overflow-hidden bg-background">
      <div
        ref={scrollViewportRef}
        className="absolute inset-0 overflow-y-auto"
        style={{ scrollPaddingBottom: composerBottomOffset }}
      >
        <div
          className={cn(
            'mx-auto w-full max-w-[1024px] px-8 pt-8',
            isEmpty && 'flex min-h-full flex-col gap-6',
          )}
          style={{ paddingBottom: composerBottomOffset }}
        >
          {errorMessage ? (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>工作区操作未完成</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <header className="flex shrink-0 flex-col gap-[18px]">
            <h1 className="break-words text-[28px] leading-normal font-bold text-foreground">
              {task.title}
            </h1>
            {task.direction?.length || isEmpty ? (
              <section aria-labelledby="creative-direction-heading">
                <h2
                  id="creative-direction-heading"
                  className="text-[17px] leading-normal font-bold text-foreground"
                >
                  创作方向
                </h2>
                <p
                  className={cn(
                    'mt-2 rounded-[10px] border border-[#e4e4e7] bg-card px-4 py-[14px] text-[15px] leading-normal break-words',
                    task.direction?.length ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {task.direction?.length ? task.direction.join(' / ') : '选择或输入本次创作方向'}
                </p>
              </section>
            ) : null}
          </header>
          <div className={cn(isEmpty ? 'flex min-h-0 flex-1 flex-col' : 'mt-6 pb-6')}>
            <ArtifactGallery
              run={run}
              artifacts={artifacts}
              onCancel={onCancel}
              onRetry={onRetry}
            />
          </div>
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-background"
        style={{ right: scrollbarWidth }}
      >
        <div
          ref={composerContainerRef}
          className="pointer-events-auto mx-auto w-full max-w-[1024px] px-8 pb-4"
        >
          <CreativeComposer key={`${task.workspaceId}:${run.id}`} run={run} onSubmit={onSubmit} />
        </div>
      </div>
    </main>
  );
}
