import { Check, ChevronDown, FolderOpen, ImageIcon, Plus, Settings, Sparkles } from 'lucide-react';

import type { CreativeTask, Workspace } from '@museworks/contracts';

import { Button } from '@/renderer/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/renderer/components/ui/dropdown-menu';
import { Separator } from '@/renderer/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/renderer/components/ui/tooltip';
import { cn } from '@/renderer/lib/utils';

interface WorkspaceSidebarProps {
  workspace: Workspace;
  recentWorkspaces: Workspace[];
  tasks: Array<{ id: string; task: CreativeTask }>;
  activeTaskId: string;
  isSelecting: boolean;
  onActivateWorkspace: (workspaceId: string) => void;
  onPickWorkspace: () => void;
  onCreateTask: () => void;
  onSelectTask: (taskId: string) => void;
}

export function WorkspaceSidebar({
  workspace,
  recentWorkspaces,
  tasks,
  activeTaskId,
  isSelecting,
  onActivateWorkspace,
  onPickWorkspace,
  onCreateTask,
  onSelectTask,
}: WorkspaceSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-card px-4 py-5">
      <div className="mb-6">
        <div className="mb-5 text-xl font-semibold text-foreground">MuseWorks</div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between px-2 py-2 text-left hover:bg-control-hover hover:text-control-text"
              disabled={isSelecting}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 truncate text-sm font-semibold">
                  <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {workspace.name}
                </span>
                <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                  {workspace.rootPath}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" alignOffset={8} className="w-64 p-3">
            <DropdownMenuLabel className="px-0 py-0 text-[13px] leading-normal font-bold text-control-muted">
              最近工作区
            </DropdownMenuLabel>
            {recentWorkspaces.map((recentWorkspace) => {
              const isCurrentWorkspace = recentWorkspace.id === workspace.id;

              return (
                <DropdownMenuItem
                  key={recentWorkspace.id}
                  aria-current={isCurrentWorkspace || undefined}
                  disabled={isSelecting}
                  onSelect={() => onActivateWorkspace(recentWorkspace.id)}
                  className="rounded-lg px-3 py-2.5 text-sm text-control-text"
                >
                  <FolderOpen aria-hidden="true" />
                  <span className="min-w-0 truncate">{recentWorkspace.name}</span>
                  {isCurrentWorkspace ? (
                    <Check className="ml-auto text-control-muted" aria-hidden="true" />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="mx-0 my-1" />
            <DropdownMenuItem
              className="rounded-lg px-2.5 py-2 text-[13px] text-control-text"
              disabled={isSelecting}
              onSelect={onPickWorkspace}
            >
              <FolderOpen aria-hidden="true" />
              打开其他工作区
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button variant="outline" className="mb-7 w-full justify-start" onClick={onCreateTask}>
        <Plus aria-hidden="true" />
        新建创作
      </Button>

      <section aria-labelledby="recent-tasks-heading" className="min-h-0 flex-1 overflow-y-auto">
        <h2 id="recent-tasks-heading" className="mb-2 text-xs font-medium text-muted-foreground">
          最近创作
        </h2>
        <nav className="space-y-1" aria-label="最近创作">
          {tasks.map(({ id, task }) => (
            <Button
              key={id}
              variant="ghost"
              className={cn(
                'w-full justify-start rounded-md border border-transparent px-2.5 text-left text-foreground hover:bg-accent/80',
                id === activeTaskId &&
                  'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
              )}
              aria-pressed={id === activeTaskId}
              data-active={id === activeTaskId || undefined}
              onClick={() => onSelectTask(id)}
            >
              {id === 'complete' ? (
                <Sparkles aria-hidden="true" />
              ) : (
                <ImageIcon aria-hidden="true" />
              )}
              <span className="truncate">{task.title}</span>
            </Button>
          ))}
        </nav>
      </section>

      <Separator className="my-4" />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex w-fit">
            <Button variant="ghost" className="justify-start px-2.5" disabled>
              <Settings aria-hidden="true" />
              设置
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>设置将在后续版本提供。</TooltipContent>
      </Tooltip>
    </aside>
  );
}
