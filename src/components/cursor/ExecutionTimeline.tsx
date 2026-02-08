/**
 * ExecutionTimeline - Visual timeline bar showing execution progress
 * with markers for function calls, loops, and errors.
 */
import { useMemo } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { inferOperationType, CURSOR_COLORS } from './cursorState';

export default function ExecutionTimeline() {
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const jumpToStep = useExecutionStore((s) => s.jumpToStep);
  const status = useExecutionStore((s) => s.status);

  const markers = useMemo(() => {
    if (snapshots.length === 0) return [];
    const result: { step: number; type: string; color: string; position: number }[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const opType = inferOperationType(snapshots[i], snapshots[i - 1]);
      if (opType === 'function-call' || opType === 'error' || opType === 'loop') {
        result.push({
          step: i,
          type: opType,
          color: CURSOR_COLORS[opType],
          position: (i / (snapshots.length - 1)) * 100,
        });
      }
    }
    return result;
  }, [snapshots]);

  if (status === 'idle' || snapshots.length === 0) return null;

  const progressPct = snapshots.length > 1 
    ? (currentStepIndex / (snapshots.length - 1)) * 100 
    : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const step = Math.round(pct * (snapshots.length - 1));
    jumpToStep(Math.max(0, Math.min(step, snapshots.length - 1)));
  };

  return (
    <div style={{ padding: '8px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>Execution Timeline</span>
        <span>Step {currentStepIndex + 1} / {snapshots.length}</span>
      </div>
      <div
        className="cf-timeline"
        onClick={handleClick}
        role="slider"
        aria-valuenow={currentStepIndex}
        aria-valuemin={0}
        aria-valuemax={snapshots.length - 1}
        aria-label="Execution timeline"
        tabIndex={0}
      >
        {/* Progress fill */}
        <div
          className="cf-timeline-progress"
          style={{ width: `${progressPct}%` }}
        />

        {/* Event markers */}
        {markers.map((m, i) => (
          <div
            key={i}
            className="cf-timeline-marker"
            style={{
              left: `${m.position}%`,
              background: m.color,
            }}
            title={`Step ${m.step + 1}: ${m.type}`}
          />
        ))}

        {/* Current position handle */}
        <div
          style={{
            position: 'absolute',
            left: `${progressPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'white',
            border: '2px solid var(--accent-blue)',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
}
