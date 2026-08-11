import type {
  Artifact,
  CreativeRun,
  CreativeTask,
  GenerationOptions,
  RunStep,
} from '@museworks/contracts';
import { workspaceIdSchema } from '@museworks/contracts';

export type MockCreativeSceneId = 'complete' | 'generating' | 'failed' | 'empty';

export interface MockCreativeScene {
  id: MockCreativeSceneId;
  task: CreativeTask;
  run: CreativeRun;
  artifacts: Artifact[];
}

const taskIds = {
  complete: '2ea0fc3c-c1ce-48ab-a51a-f15ee5a40239',
  generating: 'd57eceee-0278-49dd-a18e-83afc64934bf',
  failed: '5ec915a5-e5cf-4cd8-bffe-b60e8d0e5920',
  empty: '6a90f0bb-a18f-45bc-b3a6-6c99ceba9a1d',
} as const;

const runIds = {
  complete: '09e2146a-42da-4b20-9b29-7cd73d43873f',
  generating: '8aaedac8-5c1e-499b-80cc-2df280a6ad0a',
  failed: '4e37718d-87b2-4ed2-9e95-4d6713a9e422',
  empty: '45e640c4-a98b-4e21-bdf6-20959825eb0b',
  submitted: '2b2f26ce-ae50-4656-a34c-18e966a876ca',
} as const;

const artifactIds = [
  'd11d47dc-a575-4489-a47e-6e13d7348a0f',
  'ee2f1bc9-472a-4a4d-9b23-d256383015bf',
  '7c1685bc-b271-49aa-bd55-1fe20d77c60f',
  '98e8bc32-75fe-49f0-85b5-2c7825d94486',
] as const;

function steps(
  statuses: RunStep['status'][],
  summaries: Array<string | undefined> = [],
): RunStep[] {
  const definitions = [
    ['understand', '理解需求'],
    ['direction', '整理视觉方案'],
    ['generate', '生成候选图'],
    ['organize', '整理结果'],
  ] as const;

  return definitions.map(([id, label], index) => ({
    id,
    label,
    status: statuses[index] ?? 'pending',
    ...(summaries[index] ? { summary: summaries[index] } : {}),
  }));
}

function mockArtifacts(taskId: string, runId: string, count: number): Artifact[] {
  return artifactIds.slice(0, count).map((id, index) => ({
    id,
    taskId,
    runId,
    type: 'image',
    uri: `mock://artifacts/${taskId}/${index + 1}`,
  }));
}

export function createMockCreativeScenes(workspaceId: string): MockCreativeScene[] {
  const validWorkspaceId = workspaceIdSchema.parse(workspaceId);
  const completeTask: CreativeTask = {
    id: taskIds.complete,
    workspaceId: validWorkspaceId,
    title: '夏日冰咖啡宣传图',
    direction: ['冰咖啡', '清爽夏日', '产品宣传'],
  };
  const generatingTask: CreativeTask = {
    id: taskIds.generating,
    workspaceId: validWorkspaceId,
    title: '小红书封面',
    direction: ['生活方式', '轻盈排版', '视觉焦点'],
  };
  const failedTask: CreativeTask = {
    id: taskIds.failed,
    workspaceId: validWorkspaceId,
    title: '商品换背景',
    direction: ['产品主体', '清爽背景', '电商展示'],
  };
  const emptyTask: CreativeTask = {
    id: taskIds.empty,
    workspaceId: validWorkspaceId,
    title: '新建创作',
  };

  return [
    {
      id: 'complete',
      task: completeTask,
      run: {
        id: runIds.complete,
        taskId: completeTask.id,
        instruction: '为夏日冰咖啡制作清爽自然的产品宣传图',
        status: 'completed',
        steps: steps(
          ['completed', 'completed', 'completed', 'completed'],
          ['已提取主体和关键信息', '已确定风格、场景和构图', '已生成 4 张候选图', '已整理创作结果'],
        ),
      },
      artifacts: mockArtifacts(completeTask.id, runIds.complete, 4),
    },
    {
      id: 'generating',
      task: generatingTask,
      run: {
        id: runIds.generating,
        taskId: generatingTask.id,
        instruction: '制作一张简洁有吸引力的小红书封面',
        status: 'running',
        steps: steps(
          ['completed', 'completed', 'running', 'pending'],
          ['已提取主体和关键信息', '已确定风格、场景和构图', '正在生成候选图'],
        ),
      },
      artifacts: [],
    },
    {
      id: 'failed',
      task: failedTask,
      run: {
        id: runIds.failed,
        taskId: failedTask.id,
        instruction: '将商品放入适合夏日的干净背景中',
        status: 'failed',
        steps: steps(
          ['completed', 'completed', 'failed', 'pending'],
          ['已提取主体和关键信息', '已确定风格、场景和构图', '暂时无法生成候选图片'],
        ),
      },
      artifacts: [],
    },
    {
      id: 'empty',
      task: emptyTask,
      run: {
        id: runIds.empty,
        taskId: emptyTask.id,
        instruction: '等待创作描述',
        status: 'idle',
        steps: steps(['pending', 'pending', 'pending', 'pending']),
      },
      artifacts: [],
    },
  ];
}

export function createSubmittedMockScene(
  task: CreativeTask,
  instruction: string,
  options: GenerationOptions,
  status: 'running' | 'completed',
): MockCreativeScene {
  const run: CreativeRun = {
    id: runIds.submitted,
    taskId: task.id,
    instruction,
    status,
    steps:
      status === 'running'
        ? steps(
            ['completed', 'completed', 'running', 'pending'],
            ['已提取主体和关键信息', '已确定风格、场景和构图', '正在生成候选图'],
          )
        : steps(
            ['completed', 'completed', 'completed', 'completed'],
            [
              '已提取主体和关键信息',
              '已确定风格、场景和构图',
              `已生成 ${options.candidateCount} 张候选图`,
              '已整理创作结果',
            ],
          ),
  };

  return {
    id: 'empty',
    task,
    run,
    artifacts: status === 'completed' ? mockArtifacts(task.id, run.id, options.candidateCount) : [],
  };
}
