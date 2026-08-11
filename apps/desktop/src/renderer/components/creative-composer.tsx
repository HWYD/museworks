import { Sparkles } from 'lucide-react';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';

import type { CreativeRun, GenerationOptions } from '@museworks/contracts';

import { Button } from '@/renderer/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/renderer/components/ui/select';
import { cn } from '@/renderer/lib/utils';

interface CreativeComposerProps {
  run: CreativeRun;
  onSubmit: (instruction: string, options: GenerationOptions) => void;
}

function editorAttributes(isBusy: boolean) {
  return {
    'aria-label': '创作描述',
    'aria-multiline': 'true',
    'aria-readonly': String(isBusy),
    class: cn(
      'tiptap-prompt-editor min-h-5 max-h-44 overflow-y-auto whitespace-pre-wrap font-sans text-[15px] leading-5 text-muted-foreground outline-none',
      isBusy && 'cursor-not-allowed opacity-60',
    ),
    role: 'textbox',
  };
}

export function CreativeComposer({ run, onSubmit }: CreativeComposerProps) {
  const [instruction, setInstruction] = useState('');
  const [options, setOptions] = useState<GenerationOptions>({
    aspectRatio: '1:1',
    candidateCount: 4,
  });
  const isBusy = run.status === 'running';
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        listItem: false,
        orderedList: false,
        strike: false,
      }),
      Placeholder.configure({ placeholder: '描述你想创建的画面……' }),
    ],
    immediatelyRender: false,
    editorProps: {
      attributes: editorAttributes(isBusy),
    },
    onUpdate: ({ editor: updatedEditor }) => {
      setInstruction(updatedEditor.getText());
    },
  });
  const canSubmit = instruction.trim().length > 0 && !isBusy;

  useEffect(() => {
    editor?.setOptions({
      editable: !isBusy,
      editorProps: { attributes: editorAttributes(isBusy) },
    });
  }, [editor, isBusy]);

  function submit() {
    const nextInstruction = editor?.getText().trim() ?? instruction.trim();

    if (nextInstruction && !isBusy) {
      onSubmit(nextInstruction, options);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      aria-label="创作编辑器"
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3.5 rounded-xl border border-[#e4e4e7] bg-card p-4 transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"
    >
      <EditorContent editor={editor} onKeyDown={handleKeyDown} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Select value={options.aspectRatio} disabled>
            <SelectTrigger
              aria-label="画面比例"
              className="h-9 w-30 rounded-lg border-[#e4e4e7] bg-card px-3 text-sm font-semibold shadow-none disabled:opacity-100 [&_svg]:opacity-100"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1">1:1</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(options.candidateCount)}
            onValueChange={(value) =>
              setOptions((current) => ({ ...current, candidateCount: Number(value) as 1 | 2 | 4 }))
            }
            disabled={isBusy}
          >
            <SelectTrigger
              aria-label="候选数量"
              className="h-9 w-30 rounded-lg border-[#e4e4e7] bg-card px-3 text-sm font-semibold shadow-none [&_svg]:opacity-100"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 张</SelectItem>
              <SelectItem value="2">2 张</SelectItem>
              <SelectItem value="4">4 张</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-[#5b3df5] px-4 py-2 font-semibold text-white shadow-none has-[>svg]:px-4 hover:bg-[#4e32df] disabled:opacity-[0.45]"
        >
          <Sparkles aria-hidden="true" />
          生成
        </Button>
      </div>
    </form>
  );
}
