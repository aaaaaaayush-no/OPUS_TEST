import { useState, useCallback } from 'react';
import CodeEditor from './components/CodeEditor';
import Controls from './components/Controls';
import VariablesPanel from './components/panels/VariablesPanel';
import CallStackPanel from './components/panels/CallStackPanel';
import ConsolePanel from './components/panels/ConsolePanel';
import TimelinePanel from './components/panels/TimelinePanel';
import ASTPanel from './components/panels/ASTPanel';
import CallTreePanel from './components/panels/CallTreePanel';
import CFGPanel from './components/panels/CFGPanel';
import ExecutionCursor from './components/cursor/ExecutionCursor';
import PopupWindow from './components/cursor/PopupWindow';
import CursorControlPanel from './components/cursor/CursorControlPanel';
import ExecutionTimeline from './components/cursor/ExecutionTimeline';
import ResizableSplitter from './components/ResizableSplitter';
import { useExecutionStore } from './store/executionStore';

type PanelTab = 'variables' | 'callstack' | 'console' | 'timeline' | 'ast' | 'calltree' | 'cfg';

export default function App() {
  const [activeTab, setActiveTab] = useState<PanelTab>('variables');
  const [showPopup, setShowPopup] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [trailLength, setTrailLength] = useState(10);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);

  const handleSplitterResize = useCallback((percent: number) => {
    setLeftPanelWidth(percent);
  }, []);

  const status = useExecutionStore((s) => s.status);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const totalSteps = useExecutionStore((s) => s.snapshots.length);
  const currentSnapshot = useExecutionStore((s) => {
    const { snapshots, currentStepIndex: idx } = s;
    return idx >= 0 && idx < snapshots.length ? snapshots[idx] : null;
  });
  const error = useExecutionStore((s) => s.error);

  const tabs: { id: PanelTab; label: string; icon: string }[] = [
    { id: 'variables', label: 'Variables', icon: '📊' },
    { id: 'callstack', label: 'Call Stack', icon: '📚' },
    { id: 'console', label: 'Console', icon: '💻' },
    { id: 'timeline', label: 'Timeline', icon: '⏱️' },
    { id: 'ast', label: 'AST', icon: '🌳' },
    { id: 'calltree', label: 'Call Tree', icon: '🔀' },
    { id: 'cfg', label: 'CFG', icon: '📐' },
  ];

  const currentFunction = currentSnapshot?.callStack.length
    ? currentSnapshot.callStack[currentSnapshot.callStack.length - 1].functionName
    : 'global';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Menu Bar */}
      <div className="cf-menubar">
        <div className="cf-menubar-title">
          <span style={{ color: 'var(--accent-blue)' }}>📊</span>
          CodeFlow Visualizer
        </div>
        <button className="cf-menu-item">File</button>
        <button className="cf-menu-item">Edit</button>
        <button className="cf-menu-item">View</button>
        <button className="cf-menu-item">Run</button>
        <button className="cf-menu-item">Help</button>
      </div>

      {/* Toolbar / Controls */}
      <Controls />

      {/* Execution Timeline */}
      <ExecutionTimeline />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Left Panel - Code Editor */}
        <div style={{ width: `${leftPanelWidth}%`, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <ExecutionCursor showTrail={showTrail} trailLength={trailLength} showAnnotation={showAnnotations} />
          <CodeEditor />
        </div>

        {/* Resizable Splitter */}
        <ResizableSplitter onResize={handleSplitterResize} />

        {/* Right Panel */}
        <div style={{ width: `${100 - leftPanelWidth}%`, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          {/* Panel Tabs */}
          <div className="cf-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cf-tab ${activeTab === tab.id ? 'cf-tab-active' : ''}`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'variables' && <VariablesPanel />}
            {activeTab === 'callstack' && <CallStackPanel />}
            {activeTab === 'console' && <ConsolePanel />}
            {activeTab === 'timeline' && <TimelinePanel />}
            {activeTab === 'ast' && <ASTPanel />}
            {activeTab === 'calltree' && <CallTreePanel />}
            {activeTab === 'cfg' && <CFGPanel />}
          </div>

          {/* Cursor Control Panel */}
          <div style={{ borderTop: '1px solid var(--border-light)' }}>
            <CursorControlPanel
              showTrail={showTrail}
              setShowTrail={setShowTrail}
              showWindows={showPopup}
              setShowWindows={setShowPopup}
              showAnnotations={showAnnotations}
              setShowAnnotations={setShowAnnotations}
              trailLength={trailLength}
              setTrailLength={setTrailLength}
            />
          </div>
        </div>
      </div>

      {/* Popup Window */}
      <PopupWindow visible={showPopup && status !== 'idle'} onClose={() => setShowPopup(false)} />

      {/* Status Bar */}
      <div className="cf-statusbar">
        <span
          className={`cf-status-indicator ${
            status === 'running'
              ? 'cf-status-running'
              : status === 'paused' || status === 'stepping'
                ? 'cf-status-paused'
                : status === 'finished'
                  ? 'cf-status-finished'
                  : status === 'error'
                    ? 'cf-status-error'
                    : 'cf-status-idle'
          }`}
        />
        <span style={{ textTransform: 'capitalize' }}>{status}</span>
        <span className="cf-statusbar-separator">|</span>
        {status !== 'idle' && (
          <>
            <span>⏱️ Step: {currentStepIndex + 1}/{totalSteps}</span>
            <span className="cf-statusbar-separator">|</span>
            <span>Line: {currentSnapshot?.currentLine ?? '-'} Col: {currentSnapshot?.currentColumn ?? '-'}</span>
            <span className="cf-statusbar-separator">|</span>
            <span>{currentFunction}()</span>
          </>
        )}
        {error && (
          <>
            <span className="cf-statusbar-separator">|</span>
            <span style={{ color: 'var(--accent-error)' }}>⚠ {error}</span>
          </>
        )}
        <span style={{ marginLeft: 'auto' }}>JavaScript • ES2022</span>
        <span className="cf-statusbar-separator">|</span>
        <span>CodeFlow Visualizer v1.0.0</span>
      </div>
    </div>
  );
}
