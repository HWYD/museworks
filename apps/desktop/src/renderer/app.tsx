import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  GenerationOptions,
  WorkspaceErrorCode,
  WorkspaceSnapshot,
} from '@museworks/contracts';

import { AgentRunPanel } from '@/renderer/components/agent-run-panel';
import { AppShell } from '@/renderer/components/app-shell';
import { CreativeWorkspace } from '@/renderer/components/creative-workspace';
import { WorkspacePicker } from '@/renderer/components/workspace-picker';
import { WorkspaceSidebar } from '@/renderer/components/workspace-sidebar';
import { TooltipProvider } from '@/renderer/components/ui/tooltip';
import {
  createMockCreativeScenes,
  createSubmittedMockScene,
  type MockCreativeScene,
  type MockCreativeSceneId,
} from '@/renderer/mocks/creative-workspace';

export function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<WorkspaceErrorCode | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<MockCreativeSceneId>('complete');
  const [submittedScene, setSubmittedScene] = useState<MockCreativeScene | null>(null);
  const completionTimer = useRef<number | undefined>(undefined);

  function clearPendingMockCompletion() {
    if (completionTimer.current !== undefined) {
      window.clearTimeout(completionTimer.current);
      completionTimer.current = undefined;
    }
  }

  useEffect(() => {
    let isCurrent = true;

    window.museworks.workspace
      .load()
      .then((result) => {
        if (isCurrent) {
          if (result.status === 'loaded') {
            setSnapshot(result.snapshot);
            setWorkspaceError(null);
          } else {
            setSnapshot({ currentWorkspace: null, recentWorkspaces: [] });
            setWorkspaceError(result.code);
          }
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSnapshot({ currentWorkspace: null, recentWorkspaces: [] });
          setWorkspaceError('workspace-storage-unavailable');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
      clearPendingMockCompletion();
    };
  }, []);

  const currentWorkspace = snapshot?.currentWorkspace ?? null;
  const scenes = useMemo(
    () => (currentWorkspace ? createMockCreativeScenes(currentWorkspace.id) : []),
    [currentWorkspace?.id],
  );
  const activeScene =
    submittedScene ?? scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0];

  async function applyWorkspaceSelection(
    select: () => ReturnType<typeof window.museworks.workspace.pick>,
  ) {
    setIsSelecting(true);
    setWorkspaceError(null);

    try {
      const result = await select();
      if (result.status === 'selected') {
        clearPendingMockCompletion();
        setSnapshot(result.snapshot);
        setActiveSceneId('complete');
        setSubmittedScene(null);
      } else if (result.status === 'error') {
        setWorkspaceError(result.code);
      }
    } catch {
      setWorkspaceError('workspace-storage-unavailable');
    } finally {
      setIsSelecting(false);
    }
  }

  function handlePickWorkspace() {
    void applyWorkspaceSelection(() => window.museworks.workspace.pick());
  }

  function handleActivateWorkspace(workspaceId: string) {
    void applyWorkspaceSelection(() => window.museworks.workspace.activate(workspaceId));
  }

  function handleSelectScene(sceneId: string) {
    clearPendingMockCompletion();
    setActiveSceneId(sceneId as MockCreativeSceneId);
    setSubmittedScene(null);
  }

  function handleCreateTask() {
    clearPendingMockCompletion();
    setActiveSceneId('empty');
    setSubmittedScene(null);
  }

  function handleSubmit(instruction: string, options: GenerationOptions) {
    if (!activeScene) {
      return;
    }

    clearPendingMockCompletion();

    setActiveSceneId('empty');
    setSubmittedScene(createSubmittedMockScene(activeScene.task, instruction, options, 'running'));
    completionTimer.current = window.setTimeout(() => {
      completionTimer.current = undefined;
      setSubmittedScene(
        createSubmittedMockScene(activeScene.task, instruction, options, 'completed'),
      );
    }, 800);
  }

  function handleCancel() {
    clearPendingMockCompletion();
    setActiveSceneId('empty');
    setSubmittedScene(null);
  }

  function handleRetry() {
    if (!activeScene || activeScene.run.status !== 'failed') {
      return;
    }

    handleSubmit(activeScene.run.instruction, { aspectRatio: '1:1', candidateCount: 4 });
  }

  const picker = (
    <WorkspacePicker
      recentWorkspaces={snapshot?.recentWorkspaces ?? []}
      isLoading={isLoading}
      isSelecting={isSelecting}
      errorCode={workspaceError}
      onPick={handlePickWorkspace}
      onActivate={handleActivateWorkspace}
    />
  );

  if (isLoading || !snapshot?.currentWorkspace || !activeScene) {
    return <TooltipProvider>{picker}</TooltipProvider>;
  }

  return (
    <TooltipProvider>
      <AppShell
        sidebar={
          <WorkspaceSidebar
            workspace={snapshot.currentWorkspace}
            recentWorkspaces={snapshot.recentWorkspaces}
            tasks={scenes
              .filter((scene) => scene.id !== 'empty')
              .map((scene) => ({ id: scene.id, task: scene.task }))}
            activeTaskId={activeSceneId}
            isSelecting={isSelecting}
            onActivateWorkspace={handleActivateWorkspace}
            onPickWorkspace={handlePickWorkspace}
            onCreateTask={handleCreateTask}
            onSelectTask={handleSelectScene}
          />
        }
        workspace={
          <CreativeWorkspace
            task={activeScene.task}
            run={activeScene.run}
            artifacts={activeScene.artifacts}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onRetry={handleRetry}
            workspaceError={workspaceError}
          />
        }
        runPanel={<AgentRunPanel run={activeScene.run} />}
      />
    </TooltipProvider>
  );
}
