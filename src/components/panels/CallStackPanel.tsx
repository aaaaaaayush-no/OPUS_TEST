import { useExecutionStore } from '../../store/executionStore';

export default function CallStackPanel() {
  const currentSnapshot = useExecutionStore((s) => {
    const { snapshots, currentStepIndex } = s;
    if (currentStepIndex >= 0 && currentStepIndex < snapshots.length) {
      return snapshots[currentStepIndex];
    }
    return null;
  });

  if (!currentSnapshot) {
    return (
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
        Run code to see call stack
      </div>
    );
  }

  const { callStack } = currentSnapshot;

  if (callStack.length === 0) {
    return (
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span>📚</span>
          <span>Call stack is empty (global scope)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cf-panel-content cf-scrollbar" style={{ overflow: 'auto' }}>
      <table className="cf-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Function</th>
            <th>Line</th>
            <th>Arguments</th>
            <th>Return</th>
          </tr>
        </thead>
        <tbody>
          {[...callStack].reverse().map((frame, i) => (
            <tr
              key={i}
              style={i === 0 ? { borderLeft: '3px solid var(--accent-blue)', background: 'var(--accent-blue-light)' } : {}}
            >
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i}</td>
              <td style={{ fontFamily: 'var(--font-code)', fontWeight: 600, color: 'var(--accent-blue)' }}>
                {frame.functionName}()
              </td>
              <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {frame.sourceLocation.line}
              </td>
              <td style={{ fontFamily: 'var(--font-code)', fontSize: 12 }}>
                {frame.arguments.map((arg, j) => (
                  <span key={j}>
                    {j > 0 && ', '}
                    <span style={{ color: 'var(--accent-purple)' }}>{arg.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>=</span>
                    <span className="cf-val-number">{String(arg.value)}</span>
                  </span>
                ))}
              </td>
              <td style={{ fontFamily: 'var(--font-code)', fontSize: 12 }}>
                {frame.returnValue !== undefined && (
                  <span className="cf-val-number">{String(frame.returnValue)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Depth: {callStack.length} frame{callStack.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
