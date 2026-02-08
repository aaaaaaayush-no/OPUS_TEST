import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useExecutionStore } from '../store/executionStore';

export default function CodeEditor() {
  const code = useExecutionStore((s) => s.code);
  const setCode = useExecutionStore((s) => s.setCode);
  const currentSnapshot = useExecutionStore((s) => {
    const { snapshots, currentStepIndex } = s;
    if (currentStepIndex >= 0 && currentStepIndex < snapshots.length) {
      return snapshots[currentStepIndex];
    }
    return null;
  });
  const breakpoints = useExecutionStore((s) => s.breakpoints);
  const toggleBreakpoint = useExecutionStore((s) => s.toggleBreakpoint);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Click on gutter to toggle breakpoints
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
          e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) toggleBreakpoint(line);
      }
    });
  }, [toggleBreakpoint]);

  // Update decorations whenever snapshot or breakpoints change
  useEffect(() => {
    const editorInstance = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editorInstance || !monacoInstance) return;

    const newDecorations: { range: InstanceType<typeof monacoInstance.Range>; options: Record<string, unknown> }[] = [];

    if (currentSnapshot && currentSnapshot.currentLine > 0) {
      newDecorations.push({
        range: new monacoInstance.Range(currentSnapshot.currentLine, 1, currentSnapshot.currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'bg-yellow-500/20',
          glyphMarginClassName: 'codicon-debug-stackframe',
        },
      });
    }

    for (const bp of breakpoints) {
      newDecorations.push({
        range: new monacoInstance.Range(bp.line, 1, bp.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'bg-red-500 rounded-full w-3 h-3 inline-block ml-1',
          glyphMarginHoverMessage: { value: 'Breakpoint' },
        },
      });
    }

    decorationsRef.current = editorInstance.deltaDecorations(
      decorationsRef.current,
      newDecorations as Parameters<typeof editorInstance.deltaDecorations>[1],
    );
  }, [currentSnapshot, breakpoints]);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-800 text-gray-300 px-4 py-2 text-sm font-medium border-b border-gray-700 flex items-center gap-2">
        <span className="text-blue-400">📄</span> main.js
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={code}
          onChange={(val) => setCode(val ?? '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            fontSize: 14,
            lineNumbers: 'on',
            glyphMargin: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderLineHighlight: 'all',
            folding: true,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
