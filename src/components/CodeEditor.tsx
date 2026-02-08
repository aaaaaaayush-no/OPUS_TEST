import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useExecutionStore } from '../store/executionStore';
import { useCursorState, CURSOR_COLORS } from './cursor/cursorState';

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
  const { operationType, lineExecutionCounts, isActive } = useCursorState();

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define classic light theme
    monaco.editor.defineTheme('classicLight', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '0000FF' },
        { token: 'string', foreground: 'A31515' },
        { token: 'number', foreground: '098658' },
        { token: 'comment', foreground: '008000' },
        { token: 'type', foreground: '267F99' },
        { token: 'identifier', foreground: '001080' },
        { token: 'delimiter', foreground: '000000' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#1F2937',
        'editor.lineHighlightBackground': '#F5F7FA',
        'editorLineNumber.foreground': '#9CA3AF',
        'editorLineNumber.activeForeground': '#1F2937',
        'editor.selectionBackground': '#ADD6FF',
        'editorGutter.background': '#F9FAFB',
        'editorCursor.foreground': '#2563EB',
      },
    });
    monaco.editor.setTheme('classicLight');

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

    // Current line highlight with cursor color
    if (currentSnapshot && currentSnapshot.currentLine > 0) {
      const cursorColor = CURSOR_COLORS[operationType];
      newDecorations.push({
        range: new monacoInstance.Range(currentSnapshot.currentLine, 1, currentSnapshot.currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'cf-editor-current-line',
          glyphMarginClassName: 'cf-gutter-current',
          overviewRuler: {
            color: cursorColor,
            position: 1,
          },
        },
      });
    }

    // Executed line indicators with counts
    if (isActive) {
      for (const [line, count] of lineExecutionCounts) {
        if (line === currentSnapshot?.currentLine) continue;
        newDecorations.push({
          range: new monacoInstance.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'cf-editor-executed-line',
            glyphMarginClassName: 'cf-gutter-executed',
            glyphMarginHoverMessage: { value: `Executed ${count}x` },
          },
        });
      }
    }

    // Breakpoints
    for (const bp of breakpoints) {
      newDecorations.push({
        range: new monacoInstance.Range(bp.line, 1, bp.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'cf-gutter-breakpoint',
          glyphMarginHoverMessage: { value: 'Breakpoint' },
        },
      });
    }

    decorationsRef.current = editorInstance.deltaDecorations(
      decorationsRef.current,
      newDecorations as Parameters<typeof editorInstance.deltaDecorations>[1],
    );
  }, [currentSnapshot, breakpoints, operationType, lineExecutionCounts, isActive]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="cf-panel-header">
        <span style={{ color: 'var(--accent-blue)' }}>📄</span> main.js
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={code}
          onChange={(val) => setCode(val ?? '')}
          onMount={handleEditorMount}
          theme="classicLight"
          options={{
            fontSize: 14,
            fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            lineNumbers: 'on',
            glyphMargin: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderLineHighlight: 'all',
            folding: true,
            wordWrap: 'on',
            lineHeight: 22,
            letterSpacing: 0.5,
          }}
        />
      </div>
    </div>
  );
}
