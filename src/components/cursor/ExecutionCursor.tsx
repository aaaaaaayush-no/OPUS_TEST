/**
 * ExecutionCursor - Animated cursor that moves through code showing execution flow.
 * Shows a visual pointer with color changes based on operation type.
 */
import { useMemo } from 'react';
import { useCursorState, CURSOR_COLORS, CURSOR_LABELS, buildTrail } from './cursorState';
import { useExecutionStore } from '../../store/executionStore';

interface ExecutionCursorProps {
  showTrail?: boolean;
  trailLength?: number;
  showAnnotation?: boolean;
}

export default function ExecutionCursor({ 
  showTrail = true, 
  trailLength = 10,
  showAnnotation = true,
}: ExecutionCursorProps) {
  const { isActive, operationType, details, currentLine } = useCursorState();
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);

  const trail = useMemo(() => {
    if (!showTrail || currentStepIndex < 0) return [];
    return buildTrail(snapshots, currentStepIndex, trailLength);
  }, [snapshots, currentStepIndex, trailLength, showTrail]);

  if (!isActive || !details) return null;

  const cursorColor = CURSOR_COLORS[operationType];
  const label = CURSOR_LABELS[operationType];

  return (
    <div className="cf-animate-fadeIn" style={{ marginBottom: 8 }}>
      {/* Cursor indicator bar */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: `${cursorColor}10`,
          borderLeft: `3px solid ${cursorColor}`,
          borderRadius: '0 4px 4px 0',
          fontSize: 13,
        }}
      >
        {/* Animated cursor arrow */}
        <span 
          className="cf-cursor-pulse"
          style={{ 
            color: cursorColor,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ➤
        </span>

        <span style={{ fontWeight: 600, color: cursorColor }}>
          Line {currentLine}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>•</span>
        <span className="cf-badge" style={{ 
          background: `${cursorColor}15`,
          color: cursorColor,
          fontSize: 12,
        }}>
          {label}
        </span>

        {details.currentFunction !== 'global' && (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              in <span style={{ fontFamily: 'var(--font-code)', fontWeight: 500 }}>{details.currentFunction}()</span>
            </span>
          </>
        )}

        {/* Step counter */}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
          Step {details.step + 1} / {snapshots.length}
        </span>
      </div>

      {/* Trail visualization */}
      {showTrail && trail.length > 1 && (
        <div style={{ 
          display: 'flex', 
          gap: 2, 
          padding: '4px 12px',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Trail:</span>
          {trail.map((point, i) => {
            const opacity = 0.3 + (0.7 * i / trail.length);
            const isCurrent = i === trail.length - 1;
            return (
              <div
                key={point.step}
                style={{
                  width: isCurrent ? 10 : 6,
                  height: isCurrent ? 10 : 6,
                  borderRadius: '50%',
                  background: CURSOR_COLORS[point.operationType],
                  opacity,
                  transition: 'all 0.3s ease',
                  border: isCurrent ? '2px solid white' : 'none',
                  boxShadow: isCurrent ? `0 0 4px ${CURSOR_COLORS[point.operationType]}` : 'none',
                }}
                title={`Step ${point.step + 1}: Line ${point.line} (${point.operationType})`}
              />
            );
          })}
        </div>
      )}

      {/* Annotation bubble */}
      {showAnnotation && details.currentFunction !== 'global' && (
        <div style={{
          margin: '2px 12px',
          padding: '4px 10px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-code)',
        }}>
          {operationType === 'function-call' && `Calling ${details.currentFunction}(${details.callStack.length > 0 ? details.callStack[details.callStack.length - 1].args.join(', ') : ''})`}
          {operationType === 'return' && `Returning from function`}
          {operationType === 'assignment' && `Variable assignment at line ${currentLine}`}
          {operationType === 'conditional' && `Evaluating condition`}
          {operationType === 'loop' && `Loop iteration at line ${currentLine}`}
          {operationType === 'error' && `Error: ${details.errorMessage}`}
          {operationType === 'normal' && `Executing line ${currentLine}`}
        </div>
      )}
    </div>
  );
}
