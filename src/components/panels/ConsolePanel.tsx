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
      <div className="p-4 text-gray-500 text-sm font-mono">
        {'>'} Console output will appear here
      </div>
    );
  }

  const { output, errorState } = currentSnapshot;

  return (
    <div className="p-3 text-sm font-mono overflow-auto h-full">
      {output.length === 0 && !errorState && (
        <div className="text-gray-600">No output yet</div>
      )}

      {output.map((entry, i) => (
        <div
          key={i}
          className={`py-0.5 px-2 rounded ${
            entry.type === 'error'
              ? 'text-red-400 bg-red-500/10'
              : entry.type === 'warn'
                ? 'text-yellow-400 bg-yellow-500/10'
                : entry.type === 'info'
                  ? 'text-blue-400'
                  : 'text-gray-300'
          }`}
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
        <div className="mt-2 py-1 px-2 rounded bg-red-500/10 text-red-400">
          <div className="font-bold">Error on line {errorState.line}:</div>
          <div>{errorState.message}</div>
        </div>
      )}
    </div>
  );
}
