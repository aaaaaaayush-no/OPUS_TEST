/**
 * CursorControlPanel - Dedicated control panel for cursor navigation.
 * Provides play/pause, speed, trail settings, and jump-to navigation.
 */
import { useState } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useCursorState } from './cursorState';

interface CursorControlPanelProps {
  showTrail: boolean;
  setShowTrail: (v: boolean) => void;
  showWindows: boolean;
  setShowWindows: (v: boolean) => void;
  showAnnotations: boolean;
  setShowAnnotations: (v: boolean) => void;
  trailLength: number;
  setTrailLength: (v: number) => void;
}

export default function CursorControlPanel({
  showTrail,
  setShowTrail,
  showWindows,
  setShowWindows,
  showAnnotations,
  setShowAnnotations,
  trailLength,
  setTrailLength,
}: CursorControlPanelProps) {
  const status = useExecutionStore((s) => s.status);
  const snapshots = useExecutionStore((s) => s.snapshots);
  const jumpToStep = useExecutionStore((s) => s.jumpToStep);
  const { totalSteps } = useCursorState();
  const [jumpLine, setJumpLine] = useState('');

  const isActive = status !== 'idle' && totalSteps > 0;

  const handleJumpToLine = () => {
    const line = parseInt(jumpLine, 10);
    if (isNaN(line) || line < 1) return;
    // Find the next step that lands on this line
    const idx = snapshots.findIndex((s) => s.currentLine === line);
    if (idx >= 0) {
      jumpToStep(idx);
      setJumpLine('');
    }
  };

  const jumpToNextType = (type: string) => {
    const currentIdx = useExecutionStore.getState().currentStepIndex;
    for (let i = currentIdx + 1; i < snapshots.length; i++) {
      const curr = snapshots[i];
      const prev = i > 0 ? snapshots[i - 1] : null;
      
      let match = false;
      if (type === 'function' && prev && curr.callStack.length > prev.callStack.length) match = true;
      if (type === 'variable' && prev) {
        if (curr.globalVariables.size !== prev.globalVariables.size) match = true;
      }
      if (type === 'error' && curr.errorState) match = true;
      if (type === 'loop' && prev && curr.currentLine === prev.currentLine) match = true;

      if (match) {
        jumpToStep(i);
        return;
      }
    }
  };

  return (
    <div className="cf-panel" style={{ margin: 0 }}>
      <div className="cf-panel-header">
        🎯 Cursor Controls
      </div>
      <div className="cf-panel-content" style={{ padding: 12 }}>
        {/* Display toggles */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Display
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
            <input type="checkbox" checked={showTrail} onChange={(e) => setShowTrail(e.target.checked)} />
            Trail
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
            <input type="checkbox" checked={showWindows} onChange={(e) => setShowWindows(e.target.checked)} />
            Detail Windows
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
            <input type="checkbox" checked={showAnnotations} onChange={(e) => setShowAnnotations(e.target.checked)} />
            Annotations
          </label>
        </div>

        {/* Trail length */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Trail Length: {trailLength} steps
          </div>
          <input
            type="range"
            className="cf-slider"
            min={3}
            max={30}
            value={trailLength}
            onChange={(e) => setTrailLength(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Jump navigation */}
        {isActive && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Jump To
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="cf-btn cf-btn-sm" onClick={() => jumpToNextType('function')}>
                → Next Function Call
              </button>
              <button className="cf-btn cf-btn-sm" onClick={() => jumpToNextType('variable')}>
                → Next Variable Change
              </button>
              <button className="cf-btn cf-btn-sm" onClick={() => jumpToNextType('loop')}>
                → Next Loop Iteration
              </button>
              <button className="cf-btn cf-btn-sm" onClick={() => jumpToNextType('error')}>
                → Next Error
              </button>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Line #"
                  value={jumpLine}
                  onChange={(e) => setJumpLine(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJumpToLine()}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                    outline: 'none',
                  }}
                />
                <button className="cf-btn cf-btn-sm cf-btn-primary" onClick={handleJumpToLine}>
                  Go
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
