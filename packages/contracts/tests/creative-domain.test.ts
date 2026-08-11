import { describe, expect, it } from 'vitest';

import {
  artifactSchema,
  creativeRunSchema,
  creativeTaskSchema,
  generationOptionsSchema,
  workspaceSchema,
} from '../src/index.js';

const workspaceId = '9f5f4e2e-08cb-41bc-99ff-e5a347bfebc7';
const taskId = '2ea0fc3c-c1ce-48ab-a51a-f15ee5a40239';
const runId = '09e2146a-42da-4b20-9b29-7cd73d43873f';

describe('creative domain contracts', () => {
  it('accepts the v0.1 Workspace, task, run, artifact, and generation data', () => {
    expect(
      workspaceSchema.parse({
        id: workspaceId,
        name: 'summer-coffee',
        rootPath: 'D:\\MuseWorks\\summer-coffee',
      }),
    ).toMatchObject({ name: 'summer-coffee' });
    expect(
      creativeTaskSchema.parse({
        id: taskId,
        workspaceId,
        title: '夏日冰咖啡宣传图',
        direction: ['冰咖啡', '清爽夏日', '产品宣传'],
      }),
    ).toMatchObject({ workspaceId });
    expect(
      creativeRunSchema.parse({
        id: runId,
        taskId,
        instruction: '制作一张清爽的冰咖啡产品宣传图',
        status: 'running',
        steps: [
          { id: 'understand', label: '理解需求', status: 'completed', summary: '已提取主体' },
          { id: 'generate', label: '生成候选图', status: 'running' },
        ],
      }),
    ).toMatchObject({ status: 'running' });
    expect(
      artifactSchema.parse({
        id: 'd11d47dc-a575-4489-a47e-6e13d7348a0f',
        taskId,
        runId,
        type: 'image',
        uri: 'mock://artifacts/summer-coffee-1',
      }),
    ).toMatchObject({ type: 'image' });
    expect(generationOptionsSchema.parse({ aspectRatio: '1:1', candidateCount: 4 })).toEqual({
      aspectRatio: '1:1',
      candidateCount: 4,
    });
  });

  it('rejects unsupported runtime details and invalid generation values', () => {
    expect(() =>
      creativeTaskSchema.parse({ id: taskId, workspaceId, title: '任务', modelId: 'future-model' }),
    ).toThrow();
    expect(() =>
      creativeRunSchema.parse({
        id: runId,
        taskId,
        instruction: '测试',
        status: 'streaming',
        steps: [],
      }),
    ).toThrow();
    expect(() =>
      generationOptionsSchema.parse({ aspectRatio: '16:9', candidateCount: 3 }),
    ).toThrow();
  });
});
