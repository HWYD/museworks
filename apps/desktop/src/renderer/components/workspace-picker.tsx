import { FolderOpen, RefreshCw, Sparkles } from 'lucide-react';

import type { Workspace } from '@museworks/contracts';

import { Alert, AlertDescription } from '@/renderer/components/ui/alert';
import { Button } from '@/renderer/components/ui/button';
import { Separator } from '@/renderer/components/ui/separator';
import { Skeleton } from '@/renderer/components/ui/skeleton';
import { workspaceErrorMessage } from '@/renderer/lib/workspace-errors';

interface WorkspacePickerProps {
  recentWorkspaces: Workspace[];
  isLoading: boolean;
  isSelecting: boolean;
  errorCode: 'invalid-workspace' | 'workspace-storage-unavailable' | null;
  onPick: () => void;
  onActivate: (workspaceId: string) => void;
}

export function WorkspacePicker({
  recentWorkspaces,
  isLoading,
  isSelecting,
  errorCode,
  onPick,
  onActivate,
}: WorkspacePickerProps) {
  const message = workspaceErrorMessage(errorCode);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10">
      <section aria-live="polite" className="w-full max-w-[560px]">
        <div className="mb-7 flex items-center gap-2.5 text-lg font-bold text-foreground">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Sparkles className="size-[18px]" />
          </span>
          MuseWorks
        </div>
        <h1 className="text-[30px] leading-9 font-bold text-foreground">选择一个工作区开始创作</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          工作区会整理你的创作、参数和生成结果。
        </p>

        <div className="mt-7 rounded-xl border border-border bg-card p-6">
          {message ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <div>
            <h2 className="text-sm font-bold text-foreground">最近使用</h2>
            <div className="mt-4 space-y-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-[72px] w-full rounded-lg" />
                  <Skeleton className="h-[72px] w-full rounded-lg" />
                </>
              ) : recentWorkspaces.length > 0 ? (
                recentWorkspaces.map((workspace, index) => (
                  <button
                    key={workspace.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      index === 0
                        ? 'bg-primary/10 hover:bg-primary/15'
                        : 'border border-border hover:bg-accent'
                    }`}
                    onClick={() => onActivate(workspace.id)}
                    disabled={isSelecting}
                  >
                    <FolderOpen
                      className={`size-5 shrink-0 ${
                        index === 0 ? 'text-amber-500' : 'text-muted-foreground'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {workspace.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {workspace.rootPath}
                      </span>
                    </span>
                    {index === 0 ? (
                      <span className="shrink-0 text-xs text-primary">上次打开</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">还没有最近工作区。</p>
              )}
            </div>
          </div>

          <Separator className="my-5" />

          <div>
            <Button className="w-full" onClick={onPick} disabled={isLoading || isSelecting}>
              {isSelecting ? (
                <RefreshCw className="animate-spin" aria-hidden="true" />
              ) : (
                <FolderOpen aria-hidden="true" />
              )}
              选择本地文件夹
            </Button>
          </div>
        </div>
        <p className="mt-7 text-xs leading-normal text-muted-foreground">
          选择后会进入工作区内的 AI 生图工作台。
        </p>
      </section>
    </main>
  );
}
