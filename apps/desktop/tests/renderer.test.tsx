// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkspaceSelectionResult, WorkspaceSnapshot } from '@museworks/contracts';

import { App } from '../src/renderer/app.js';
import { createMockCreativeScenes } from '../src/renderer/mocks/creative-workspace.js';

const workspace = {
  id: '9f5f4e2e-08cb-41bc-99ff-e5a347bfebc7',
  name: 'summer-coffee',
  rootPath: 'D:\\MuseWorks\\summer-coffee',
};
const alternateWorkspace = {
  id: '5f0e4a25-a028-4b89-8b5f-255f558786b9',
  name: 'product-shoots',
  rootPath: 'D:\\MuseWorks\\product-shoots',
};

function installBridge(snapshot: WorkspaceSnapshot) {
  const getInfo = vi
    .fn()
    .mockResolvedValue({ appVersion: '0.1.0', platform: 'win32', arch: 'x64' });
  const load = vi.fn().mockResolvedValue({ status: 'loaded', snapshot });
  const pick = vi.fn().mockResolvedValue({ status: 'cancelled' });
  const activate = vi.fn().mockResolvedValue({ status: 'cancelled' });

  window.museworks = {
    app: { getInfo },
    workspace: { load, pick, activate },
  };

  return { activate, getInfo, load, pick };
}

afterEach(() => {
  document.body.innerHTML = '';
});

const emptyClientRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  toJSON: () => ({}),
  top: 0,
  width: 0,
  x: 0,
  y: 0,
};
const rangeGetBoundingClientRect = Object.getOwnPropertyDescriptor(
  Range.prototype,
  'getBoundingClientRect',
);
const rangeGetClientRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');

beforeAll(() => {
  Object.defineProperties(Range.prototype, {
    getBoundingClientRect: {
      configurable: true,
      value: () => emptyClientRect,
    },
    getClientRects: {
      configurable: true,
      value: () => [emptyClientRect],
    },
  });
});

afterAll(() => {
  if (rangeGetBoundingClientRect) {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', rangeGetBoundingClientRect);
  } else {
    delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
  }

  if (rangeGetClientRects) {
    Object.defineProperty(Range.prototype, 'getClientRects', rangeGetClientRects);
  } else {
    delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
  }
});

async function enterCreativeInstruction(
  instruction: string,
  modifier: 'ctrlKey' | 'metaKey' = 'ctrlKey',
) {
  const editor = screen.getByRole('textbox', { name: '创作描述' });
  editor.focus();
  editor.innerHTML = `<p>${instruction}</p>`;
  fireEvent.input(editor, { data: instruction, inputType: 'insertText' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '生成' })).toHaveProperty('disabled', false),
  );
  fireEvent.keyDown(editor, { key: 'Enter', [modifier]: true });
}

describe('creative workspace renderer', () => {
  it('loads the Tailwind base style without viewport overflow', () => {
    const rendererEntry = readFileSync(resolve('src/renderer/main.tsx'), 'utf8');
    const globalStyles = readFileSync(resolve('src/renderer/global.css'), 'utf8');
    const selectComponent = readFileSync(resolve('src/renderer/components/ui/select.tsx'), 'utf8');
    const dropdownMenuComponent = readFileSync(
      resolve('src/renderer/components/ui/dropdown-menu.tsx'),
      'utf8',
    );
    const buttonComponent = readFileSync(resolve('src/renderer/components/ui/button.tsx'), 'utf8');

    expect(rendererEntry).toContain("import './global.css';");
    expect(globalStyles).toContain("@import 'tailwindcss';");
    expect(globalStyles).toContain('--control-surface: #ffffff;');
    expect(globalStyles).toContain('--control-border: #e4e4e7;');
    expect(globalStyles).toContain('--control-hover: #f4f4f5;');
    expect(globalStyles).not.toContain('--overlay-surface');
    expect(globalStyles).toMatch(/body[\s\S]*overflow: hidden;/);
    expect(selectComponent).toContain('border-control-border');
    expect(selectComponent).toContain('bg-control-surface');
    expect(selectComponent).toContain('focus:bg-control-hover');
    expect(dropdownMenuComponent).toContain('border-control-border');
    expect(dropdownMenuComponent).toContain('bg-control-surface');
    expect(dropdownMenuComponent).toContain('data-[highlighted]:bg-control-hover');
    expect(buttonComponent).toContain('rounded-lg text-sm font-semibold');
    expect(buttonComponent).toContain(
      'border-control-border bg-card text-control-text shadow-none',
    );
    expect(buttonComponent).toContain('has-[>svg]:px-4');
  });

  it('shows the Workspace Picker, keeps it open after cancellation, and enters the workspace after selection', async () => {
    const bridge = installBridge({ currentWorkspace: null, recentWorkspaces: [workspace] });
    bridge.pick.mockResolvedValueOnce({ status: 'cancelled' }).mockResolvedValueOnce({
      status: 'selected',
      snapshot: { currentWorkspace: workspace, recentWorkspaces: [workspace] },
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: '选择一个工作区开始创作' })).toBeTruthy();
    expect(screen.getByText('工作区会整理你的创作、参数和生成结果。')).toBeTruthy();
    const openWorkspaceButton = screen.getByRole('button', { name: '选择本地文件夹' });
    const pickerHelpText = screen.getByText('选择后会进入工作区内的 AI 生图工作台。');

    expect(screen.queryByRole('button', { name: '新建工作区' })).toBeNull();
    expect(openWorkspaceButton.className).toContain('rounded-lg');
    expect(openWorkspaceButton.className).toContain('bg-primary');
    expect(openWorkspaceButton.className).toContain('text-primary-foreground');
    expect(openWorkspaceButton.className).not.toContain('border-control-border');
    expect(openWorkspaceButton.className).toContain('px-4');
    expect(openWorkspaceButton.className).toContain('font-semibold');
    expect(pickerHelpText.previousElementSibling?.className).toContain('rounded-xl');
    expect(pickerHelpText.parentElement?.className).not.toContain('rounded-xl');

    fireEvent.click(openWorkspaceButton);
    await waitFor(() => expect(bridge.pick).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: '选择一个工作区开始创作' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '选择本地文件夹' }));
    expect(await screen.findByText('summer-coffee')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '夏日冰咖啡宣传图' })).toBeTruthy();
  });

  it('keeps the Workspace Picker actionable when workspace storage cannot be loaded', async () => {
    const bridge = installBridge({ currentWorkspace: null, recentWorkspaces: [] });
    bridge.load.mockResolvedValueOnce({
      status: 'error',
      code: 'workspace-storage-unavailable',
    });

    render(<App />);

    expect(await screen.findByText('暂时无法保存工作区记录，请稍后重试。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '选择本地文件夹' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('keeps a Workspace selection failure visible in the creative workspace', async () => {
    const bridge = installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    bridge.pick.mockResolvedValueOnce({ status: 'error', code: 'invalid-workspace' });
    render(<App />);
    await screen.findByRole('heading', { name: '夏日冰咖啡宣传图' });

    fireEvent.pointerDown(screen.getByRole('button', { name: /summer-coffee/ }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: '打开其他工作区' }));

    expect(await screen.findByText('所选文件夹当前不可用，请选择其他工作区。')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '夏日冰咖啡宣传图' })).toBeTruthy();
  });

  it('disables Workspace selection controls until the current selection resolves', async () => {
    const bridge = installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    let finishSelection!: (result: WorkspaceSelectionResult) => void;
    bridge.pick.mockImplementationOnce(
      () =>
        new Promise<WorkspaceSelectionResult>((resolve) => {
          finishSelection = resolve;
        }),
    );
    render(<App />);
    await screen.findByRole('heading', { name: '夏日冰咖啡宣传图' });

    fireEvent.pointerDown(screen.getByRole('button', { name: /summer-coffee/ }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: '打开其他工作区' }));
    await waitFor(() => expect(bridge.pick).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: /summer-coffee/ })).toHaveProperty('disabled', true);

    finishSelection({ status: 'cancelled' });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /summer-coffee/ })).toHaveProperty(
        'disabled',
        false,
      ),
    );
  });

  it('rejects mock scenes without a valid Workspace id', () => {
    expect(() => createMockCreativeScenes('')).toThrow();
  });

  it('uses a full-width TipTap Composer and designed Workspace navigation states', async () => {
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    render(<App />);

    const composer = await screen.findByRole('form', { name: '创作编辑器' });
    const editor = screen.getByRole('textbox', { name: '创作描述' });
    const createTaskButton = screen.getByRole('button', { name: '新建创作' });
    const workspaceSwitcher = screen.getByRole('button', { name: /summer-coffee/ });
    const activeTask = screen.getByRole('button', { name: '夏日冰咖啡宣传图' });
    const currentRunHeading = screen.getByRole('heading', { name: '当前运行' });
    const creativeDirectionHeading = screen.getByRole('heading', { name: '创作方向' });
    const artifactGalleryHeading = screen.getByRole('heading', { name: '生成结果 · 4' });
    const settingsButton = screen.getByRole('button', { name: '设置' });
    const creativeWorkspace = screen.getByRole('main');
    const scrollViewport = creativeWorkspace.querySelector('.overflow-y-auto');

    expect(screen.queryByRole('button', { name: '打开工作区' })).toBeNull();
    expect(createTaskButton.className).toContain('justify-start');
    expect(createTaskButton.className).toContain('border-control-border');
    expect(createTaskButton.className).toContain('bg-card');
    expect(createTaskButton.className).toContain('shadow-none');
    expect(workspaceSwitcher.className).toContain('hover:bg-control-hover');
    expect(workspaceSwitcher.className).toContain('hover:text-control-text');
    expect(activeTask.className).toContain('bg-primary/10');
    expect(activeTask.className).toContain('text-primary');
    expect(creativeDirectionHeading.className).toContain('text-[17px]');
    expect(artifactGalleryHeading.className).toContain('text-[17px]');
    expect(settingsButton.parentElement?.className).toContain('inline-flex');
    expect(settingsButton.parentElement?.className).toContain('w-fit');
    expect(settingsButton.className).not.toContain('w-full');
    expect(editor.tagName).toBe('DIV');
    expect(editor.getAttribute('contenteditable')).toBe('true');
    expect(composer.querySelector('textarea')).toBeNull();
    expect(editor.className).toContain('min-h-5');
    expect(editor.getAttribute('aria-readonly')).toBe('false');
    expect(composer.className).not.toContain('max-w-[676px]');
    expect(composer.className).toContain('rounded-xl');
    expect(composer.className).toContain('gap-3.5');
    expect(composer.className).toContain('p-4');
    expect(screen.getByLabelText('画面比例').className).toContain('h-9');
    expect(screen.getByLabelText('画面比例').className).toContain('w-30');
    expect(screen.getByLabelText('候选数量').className).toContain('h-9');
    expect(screen.getByRole('button', { name: '生成' }).className).toContain('bg-[#5b3df5]');
    expect(
      screen.getByRole('button', { name: '生成' }).querySelector('.lucide-sparkles'),
    ).toBeTruthy();
    expect(composer.querySelector('.border-t')).toBeNull();
    expect(creativeWorkspace.className).toContain('relative');
    expect(scrollViewport?.className).not.toContain('max-w-[960px]');
    expect(scrollViewport?.className).toContain('absolute');
    expect(scrollViewport?.className).toContain('inset-0');
    expect(scrollViewport?.firstElementChild?.className).toContain('max-w-[1024px]');
    expect(scrollViewport?.firstElementChild?.className).toContain('pt-8');
    expect(composer.parentElement?.className).toContain('max-w-[1024px]');
    expect(composer.parentElement?.parentElement?.className).toContain('absolute');
    expect(composer.parentElement?.parentElement?.className).toContain('bottom-0');
    expect(currentRunHeading.parentElement?.querySelector('ol')?.className).toContain('space-y-8');

    fireEvent.pointerDown(screen.getByRole('button', { name: /summer-coffee/ }), {
      button: 0,
      ctrlKey: false,
    });
    const workspaceMenu = await screen.findByRole('menu');
    const selectedWorkspace = screen.getByRole('menuitem', { name: 'summer-coffee' });

    expect(workspaceMenu.className).toContain('rounded-[10px]');
    expect(workspaceMenu.className).toContain('border-control-border');
    expect(workspaceMenu.className).toContain('bg-control-surface');
    expect(workspaceMenu.className).toContain('shadow-none');
    expect(selectedWorkspace.className).not.toContain('bg-control-selected');
    expect(selectedWorkspace.getAttribute('aria-current')).toBe('true');
    expect(selectedWorkspace.querySelector('.lucide-check')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: '新建工作区' })).toBeNull();

    fireEvent.keyDown(workspaceMenu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('reserves the measured Composer height in the full-height scroll viewport', async () => {
    let onResize: ResizeObserverCallback | undefined;

    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback;
      }

      disconnect() {}

      observe() {}

      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    render(<App />);

    const composer = await screen.findByRole('form', { name: '创作编辑器' });
    const composerContainer = composer.parentElement;
    const composerOverlay = composerContainer?.parentElement as HTMLDivElement;
    const creativeWorkspace = screen.getByRole('main');
    const scrollViewport = creativeWorkspace.querySelector('.overflow-y-auto') as HTMLDivElement;
    Object.defineProperties(scrollViewport, {
      clientWidth: { configurable: true, value: 943 },
      offsetWidth: { configurable: true, value: 960 },
    });
    const composerContainerRect = vi
      .spyOn(composerContainer as HTMLDivElement, 'getBoundingClientRect')
      .mockReturnValue({ ...emptyClientRect, height: 132 });

    onResize?.([], {} as ResizeObserver);

    await waitFor(() => {
      expect(scrollViewport.style.scrollPaddingBottom).toBe('156px');
      expect((scrollViewport.firstElementChild as HTMLElement).style.paddingBottom).toBe('156px');
      expect(composerOverlay.style.right).toBe('17px');
    });
    expect(composerOverlay.className).toContain('bg-background');
    expect(composerOverlay.className).not.toContain('pt-6');
    expect(composerContainer?.className).toContain('pb-4');

    composerContainerRect.mockRestore();
    vi.unstubAllGlobals();
  });

  it('renders independent Empty, Generating, Complete, and Error mock scenarios', async () => {
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });

    render(<App />);

    expect(await screen.findByText('生成结果 · 4')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /候选图/ })).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: '新建创作' }));
    const emptyStateTitle = await screen.findByText('从一句描述开始创作');
    expect(screen.getByRole('heading', { name: '新建创作' })).toBeTruthy();
    expect(screen.getByText('选择或输入本次创作方向')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '生成结果' })).toBeTruthy();
    expect(screen.getByText('填写提示词后，将在这里看到候选图。')).toBeTruthy();
    expect(emptyStateTitle.previousElementSibling?.getAttribute('class')).toContain(
      'lucide-image-plus',
    );
    expect(emptyStateTitle.parentElement?.className).toContain('rounded-xl');
    expect(emptyStateTitle.parentElement?.className).not.toContain('border-dashed');

    fireEvent.click(screen.getByRole('button', { name: '小红书封面' }));
    expect(await screen.findByText('正在生成候选图')).toBeTruthy();
    expect(screen.getAllByTestId('artifact-loading')).toHaveLength(4);
    const runningEditor = screen.getByRole('textbox', { name: '创作描述' });
    await waitFor(() => expect(runningEditor.getAttribute('aria-readonly')).toBe('true'));
    expect(runningEditor.getAttribute('contenteditable')).toBe('false');
    expect(runningEditor.className).toContain('cursor-not-allowed');

    fireEvent.click(screen.getByRole('button', { name: '商品换背景' }));
    expect(await screen.findByText('本次创作未能完成')).toBeTruthy();
    expect(screen.getAllByTestId('artifact-error')).toHaveLength(4);
  });

  it('cancels a generating mock run and retries a failed mock run', async () => {
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    render(<App />);
    await screen.findByText('生成结果 · 4');

    fireEvent.click(screen.getByRole('button', { name: '小红书封面' }));
    fireEvent.click(await screen.findByRole('button', { name: '取消生成' }));
    expect(await screen.findByText('从一句描述开始创作')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '商品换背景' }));
    fireEvent.click(await screen.findByRole('button', { name: '重新生成' }));
    expect(await screen.findByText('正在生成候选图')).toBeTruthy();
  });

  it('uses Ctrl or Cmd Enter to start a mock run from the TipTap editor', async () => {
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });

    render(<App />);
    await screen.findByRole('heading', { name: '夏日冰咖啡宣传图' });
    fireEvent.click(screen.getByRole('button', { name: '新建创作' }));
    await enterCreativeInstruction('制作一张夏日冰咖啡海报');

    expect(await screen.findByText('正在生成候选图')).toBeTruthy();
  });

  it('clears the Composer when a new CreativeTask is opened', async () => {
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    render(<App />);

    const editor = await screen.findByRole('textbox', { name: '创作描述' });
    editor.focus();
    editor.innerHTML = '<p>上一项创作的提示词</p>';
    fireEvent.input(editor, { data: '上一项创作的提示词', inputType: 'insertText' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '生成' })).toHaveProperty('disabled', false),
    );

    fireEvent.click(screen.getByRole('button', { name: '新建创作' }));

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: '创作描述' }).textContent).toBe(''),
    );
    expect(screen.getByRole('button', { name: '生成' })).toHaveProperty('disabled', true);
  });

  it('uses Cmd Enter to start a mock run from the TipTap editor', async () => {
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });

    render(<App />);
    await screen.findByRole('heading', { name: '夏日冰咖啡宣传图' });
    fireEvent.click(screen.getByRole('button', { name: '新建创作' }));
    await enterCreativeInstruction('制作一张夏日冰咖啡海报', 'metaKey');

    expect(await screen.findByText('正在生成候选图')).toBeTruthy();
  });

  it('keeps the task selected after an earlier mock run would have completed', async () => {
    installBridge({ currentWorkspace: workspace, recentWorkspaces: [workspace] });
    render(<App />);
    await screen.findByRole('heading', { name: '夏日冰咖啡宣传图' });

    fireEvent.click(screen.getByRole('button', { name: '新建创作' }));
    await enterCreativeInstruction('制作一张夏日冰咖啡海报');
    expect(screen.getByText('正在生成候选图')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '商品换背景' }));
    expect(screen.getByText('本次创作未能完成')).toBeTruthy();

    await expect(screen.findByText('生成结果 · 4', {}, { timeout: 1000 })).rejects.toThrow();
    expect(screen.getByText('本次创作未能完成')).toBeTruthy();
  });

  it('does not let a pending mock run cross into a newly activated Workspace', async () => {
    const bridge = installBridge({
      currentWorkspace: workspace,
      recentWorkspaces: [workspace, alternateWorkspace],
    });
    bridge.activate.mockResolvedValueOnce({
      status: 'selected',
      snapshot: {
        currentWorkspace: alternateWorkspace,
        recentWorkspaces: [alternateWorkspace, workspace],
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: '夏日冰咖啡宣传图' });

    fireEvent.click(screen.getByRole('button', { name: '新建创作' }));
    await enterCreativeInstruction('制作一张夏日冰咖啡海报');
    expect(screen.getByText('正在生成候选图')).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole('button', { name: /summer-coffee/ }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'product-shoots' }));
    await waitFor(() => expect(bridge.activate).toHaveBeenCalledWith(alternateWorkspace.id));

    await expect(
      screen.findByRole('heading', { name: '新建创作' }, { timeout: 1000 }),
    ).rejects.toThrow();
    expect(screen.getByRole('button', { name: /product-shoots/ })).toBeTruthy();
  });

  it('does not carry an unsubmitted Composer draft into a newly activated Workspace', async () => {
    const bridge = installBridge({
      currentWorkspace: workspace,
      recentWorkspaces: [workspace, alternateWorkspace],
    });
    bridge.activate.mockResolvedValueOnce({
      status: 'selected',
      snapshot: {
        currentWorkspace: alternateWorkspace,
        recentWorkspaces: [alternateWorkspace, workspace],
      },
    });
    render(<App />);

    const editor = await screen.findByRole('textbox', { name: '创作描述' });
    editor.focus();
    editor.innerHTML = '<p>不应跨工作区保留的草稿</p>';
    fireEvent.input(editor, { data: '不应跨工作区保留的草稿', inputType: 'insertText' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '生成' })).toHaveProperty('disabled', false),
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: /summer-coffee/ }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'product-shoots' }));
    await waitFor(() => expect(bridge.activate).toHaveBeenCalledWith(alternateWorkspace.id));

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: '创作描述' }).textContent).toBe(''),
    );
    expect(screen.getByRole('button', { name: '生成' })).toHaveProperty('disabled', true);
  });
});
