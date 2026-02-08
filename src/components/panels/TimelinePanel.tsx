import { useExecutionStore } from '../../store/executionStore';

export default function TimelinePanel() {
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const jumpToStep = useExecutionStore((s) => s.jumpToStep);

  if (snapshots.length === 0) {
    return (
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
        Run code to see execution timeline
      </div>
    );
  }

  // Group snapshots by line for a compact view
  const lineChanges = snapshots.reduce(
    (acc, snap, idx) => {
      const key = snap.currentLine;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(idx);
      return acc;
    },
    new Map<number, number[]>(),
  );

  return (
    <div className="cf-panel-content cf-scrollbar" style={{ overflow: 'auto' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Click any step to jump to that execution state (time-travel)
      </div>

      {/* Compact timeline bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 16 }}>
        {snapshots.map((snap, i) => (
          <button
            key={i}
            onClick={() => jumpToStep(i)}
            style={{
              width: 10,
              height: 20,
              borderRadius: 2,
              border: i === currentStepIndex ? '2px solid var(--accent-blue)' : '1px solid var(--border-light)',
              background: i === currentStepIndex
                ? 'var(--accent-blue)'
                : snap.errorState
                  ? 'var(--accent-error-light)'
                  : snap.callStack.length > 0
                    ? 'var(--accent-purple-light)'
                    : 'var(--bg-secondary)',
              cursor: 'pointer',
              padding: 0,
            }}
            title={`Step ${i + 1}: Line ${snap.currentLine}${
              snap.callStack.length > 0
                ? ` (in ${snap.callStack[snap.callStack.length - 1].functionName})`
                : ''
            }`}
          />
        ))}
      </div>

      {/* Line execution counts */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Lines Executed
      </div>
      <div>
        {Array.from(lineChanges.entries())
          .sort(([a], [b]) => a - b)
          .filter(([line]) => line > 0)
          .map(([line, steps]) => (
            <div
              key={line}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 8px',
                borderRadius: 3,
                cursor: 'pointer',
              }}
              onClick={() => jumpToStep(steps[steps.length - 1])}
            >
              <span style={{ color: 'var(--text-muted)', width: 40, textAlign: 'right', fontSize: 12 }}>L{line}</span>
              <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    background: 'var(--accent-blue)',
                    height: '100%',
                    borderRadius: 4,
                    width: `${Math.min(100, (steps.length / snapshots.length) * 100 * 5)}%`,
                  }}
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, width: 24, textAlign: 'right' }}>{steps.length}×</span>
            </div>
          ))}
      </div>
    </div>
  );
}
