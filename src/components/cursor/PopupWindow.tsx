/**
 * PopupWindow - Interactive floating detail window showing execution context.
 * Draggable, resizable, pinnable. Shows operation details, variables, call stack info.
 */
import { useState, useCallback, useRef } from 'react';
import { useCursorState, CURSOR_COLORS } from './cursorState';
import { useExecutionStore } from '../../store/executionStore';

interface PopupWindowProps {
  visible: boolean;
  onClose: () => void;
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) {
    if (value.length <= 5) return `[${value.map(formatValue).join(', ')}]`;
    return `[${value.slice(0, 3).map(formatValue).join(', ')}, ... +${value.length - 3}]`;
  }
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return '[Object]'; }
  }
  return String(value);
}

function getTypeClass(type: string): string {
  switch (type) {
    case 'number': return 'cf-val-number';
    case 'string': return 'cf-val-string';
    case 'boolean': return 'cf-val-boolean';
    case 'undefined':
    case 'null': return 'cf-val-null';
    case 'function': return 'cf-val-function';
    default: return 'cf-val-object';
  }
}

export default function PopupWindow({ visible, onClose }: PopupWindowProps) {
  const { details, operationType } = useCursorState();
  const [isPinned, setIsPinned] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const stepBackward = useExecutionStore((s) => s.stepBackward);
  const stepForward = useExecutionStore((s) => s.stepForward);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPosition({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position]);

  if (!visible || !details) return null;

  const cursorColor = CURSOR_COLORS[operationType];

  if (isMinimized) {
    return (
      <div
        className="cf-popup cf-animate-fadeIn"
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          minWidth: 'auto',
          maxWidth: 'auto',
          cursor: 'pointer',
        }}
        onClick={() => setIsMinimized(false)}
      >
        <div className="cf-popup-titlebar" style={{ borderBottom: 'none', padding: '4px 10px' }}>
          <span style={{ fontSize: 12, color: cursorColor, fontWeight: 600 }}>
            Line {details.line} • {details.operationLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cf-popup cf-animate-fadeIn"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
      }}
    >
      {/* Titlebar */}
      <div className="cf-popup-titlebar" onMouseDown={handleMouseDown}>
        <div className="cf-popup-title">
          <span style={{ color: cursorColor }}>⚡</span>
          Line {details.line}: {details.operationLabel}
        </div>
        <div className="cf-popup-controls">
          <button
            className="cf-popup-control-btn"
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? 'Unpin' : 'Pin'}
            style={isPinned ? { background: 'var(--accent-blue-light)', color: 'var(--accent-blue)' } : {}}
          >
            📌
          </button>
          <button
            className="cf-popup-control-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            –
          </button>
          <button
            className="cf-popup-control-btn"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="cf-popup-body">
        {/* Operation Info */}
        <div className="cf-popup-section">
          <div className="cf-popup-section-title">📊 Operation Details</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <div>• Type: <strong>{details.operationLabel}</strong></div>
            <div>• Function: <span style={{ fontFamily: 'var(--font-code)' }}>{details.currentFunction}()</span></div>
            <div>• Step: {details.step + 1}</div>
            {details.callStack.length > 0 && (
              <div>• Stack Depth: {details.callStack.length}</div>
            )}
          </div>
        </div>

        {/* Variables */}
        {details.variables.length > 0 && (
          <div className="cf-popup-section">
            <div className="cf-popup-section-title">📦 Variables</div>
            <table className="cf-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px' }}>Name</th>
                  <th style={{ padding: '4px 8px' }}>Value</th>
                  <th style={{ padding: '4px 8px' }}>Type</th>
                  <th style={{ padding: '4px 8px' }}>Scope</th>
                </tr>
              </thead>
              <tbody>
                {details.variables.map((v) => (
                  <tr key={`${v.name}-${v.scope}`}>
                    <td style={{ padding: '4px 8px', fontFamily: 'var(--font-code)', fontWeight: 500 }}>
                      {v.name}
                    </td>
                    <td 
                      style={{ padding: '4px 8px', fontFamily: 'var(--font-code)' }}
                      className={`${getTypeClass(v.type)} ${v.changed ? 'cf-value-changed' : ''}`}
                    >
                      {formatValue(v.value)}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <span className="cf-badge cf-badge-blue">{v.type}</span>
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <span className={`cf-badge ${v.scope === 'local' ? 'cf-badge-purple' : 'cf-badge-green'}`}>
                        {v.scope}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Call Stack */}
        {details.callStack.length > 0 && (
          <div className="cf-popup-section">
            <div className="cf-popup-section-title">📚 Call Stack</div>
            <div style={{ fontSize: 12 }}>
              {details.callStack.slice().reverse().map((frame: { name: string; args: string[]; returnValue: unknown }, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: '4px 8px',
                    borderLeft: i === 0 ? '3px solid var(--accent-blue)' : '3px solid var(--border-light)',
                    background: i === 0 ? 'var(--accent-blue-light)' : 'transparent',
                    marginBottom: 2,
                    borderRadius: '0 3px 3px 0',
                    fontFamily: 'var(--font-code)',
                  }}
                >
                  {frame.name}({frame.args.join(', ')})
                  {frame.returnValue !== undefined && (
                    <span style={{ color: 'var(--accent-green)', marginLeft: 8 }}>
                      → {formatValue(frame.returnValue)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {details.hasError && (
          <div className="cf-popup-section">
            <div className="cf-popup-section-title" style={{ color: 'var(--accent-error)' }}>
              ❌ Error
            </div>
            <div className="cf-popup-code" style={{ color: 'var(--accent-error)', borderColor: 'var(--accent-error)' }}>
              {details.errorMessage}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className="cf-btn cf-btn-sm"
            onClick={stepBackward}
          >
            ◀ Previous
          </button>
          <button
            className="cf-btn cf-btn-sm"
            onClick={stepForward}
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}
