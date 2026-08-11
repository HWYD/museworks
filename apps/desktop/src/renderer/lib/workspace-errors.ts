import type { WorkspaceErrorCode } from '@museworks/contracts';

export function workspaceErrorMessage(errorCode: WorkspaceErrorCode | null): string | null {
  switch (errorCode) {
    case 'invalid-workspace':
      return '所选文件夹当前不可用，请选择其他工作区。';
    case 'workspace-storage-unavailable':
      return '暂时无法保存工作区记录，请稍后重试。';
    default:
      return null;
  }
}
