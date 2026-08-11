import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  workspace: ReactNode;
  runPanel: ReactNode;
}

export function AppShell({ sidebar, workspace, runPanel }: AppShellProps) {
  return (
    <div className="grid h-screen min-h-[720px] min-w-[1080px] grid-cols-[272px_minmax(480px,1fr)_320px] overflow-hidden bg-background">
      {sidebar}
      {workspace}
      {runPanel}
    </div>
  );
}
