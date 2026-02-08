import { useExecutionStore } from '../../store/executionStore';

export default function ConsolePanel() {
  const currentSnapshot = useExecutionStore((s) => {
    const { snapshots, currentStepIndex } = s;
    if (currentStepIndex >= 0 && currentStepIndex < snapshots.length) {
      return snapshots[currentStepIndex];
    }
    return null;
  });

  if (!currentSnapshot) {
    return (
      <div className="cf-panel-content" style={{ fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
        {'>'} Console output will appear here
      </div>
    );
  }

  const { output, errorState } = currentSnapshot;

  return (
    <div className="cf-panel-content cf-scrollbar" style={{ fontFamily: 'var(--font-code)', overflow: 'auto' }}>
      {output.length === 0 && !errorState && (
        <div style={{ color: 'var(--text-muted)' }}>No output yet</div>
      )}

      {output.map((entry, i) => (
        <div
          key={i}
          style={{
            padding: '3px 8px',
            borderRadius: 3,
            marginBottom: 2,
            ...(entry.type === 'error'
              ? { color: 'var(--accent-error)', background: 'var(--accent-error-light)' }
              : entry.type === 'warn'
                ? { color: 'var(--accent-warning)', background: 'var(--accent-warning-light)' }
                : entry.type === 'info'
                  ? { color: 'var(--accent-blue)' }
                  : { color: 'var(--text-primary)' }),
          }}
        >
          {entry.args.map((arg, j) => (
            <span key={j}>
              {j > 0 && ' '}
              {typeof arg === 'object' ? JSON.stringify(arg) : String(arg)}
            </span>
          ))}
        </div>
      ))}

      {errorState && (
        <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 3, background: 'var(--accent-error-light)', color: 'var(--accent-error)', border: '1px solid var(--accent-error)' }}>
          <div style={{ fontWeight: 600 }}>Error on line {errorState.line}:</div>
          <div>{errorState.message}</div>
        </div>
      )}
    </div>
  );
}
