import { CheckCircle2, Circle, CircleDot, CircleX } from 'lucide-react';

import type { CreativeRun, RunStep } from '@museworks/contracts';

interface AgentRunPanelProps {
  run: CreativeRun;
}

function statusIcon(status: RunStep['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-5 text-green-600" aria-hidden="true" />;
    case 'running':
      return <CircleDot className="size-5 text-primary" aria-hidden="true" />;
    case 'failed':
      return <CircleX className="size-5 text-destructive" aria-hidden="true" />;
    default:
      return <Circle className="size-5 text-muted-foreground" aria-hidden="true" />;
  }
}

function RunStepItem({ step }: { step: RunStep }) {
  return (
    <li className="flex gap-3" aria-label={`${step.label}: ${step.status}`}>
      <div className="pt-0.5">{statusIcon(step.status)}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{step.label}</p>
        {step.summary ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.summary}</p>
        ) : null}
      </div>
    </li>
  );
}

export function AgentRunPanel({ run }: AgentRunPanelProps) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-border bg-card px-6 py-7">
      <h2 className="text-lg font-semibold text-foreground">当前运行</h2>
      <ol className="mt-8 space-y-8">
        {run.steps.map((step) => (
          <RunStepItem key={step.id} step={step} />
        ))}
      </ol>
    </aside>
  );
}
