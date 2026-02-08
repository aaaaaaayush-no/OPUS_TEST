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
      <div className="p-4 text-gray-500 text-sm">
        Run code to see call stack
      </div>
    );
  }

  const { callStack } = currentSnapshot;

  if (callStack.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-blue-400">📚</span>
          <span>Call stack is empty (global scope)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 text-sm overflow-auto h-full">
      <div className="space-y-2">
        {[...callStack].reverse().map((frame, i) => (
          <div
            key={i}
            className={`border rounded p-3 ${
              i === 0
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-blue-300 font-medium">
                {frame.functionName}()
              </span>
              <span className="text-gray-500 text-xs">
                line {frame.sourceLocation.line}
              </span>
            </div>

            {/* Arguments */}
            {frame.arguments.length > 0 && (
              <div className="mt-1 text-xs">
                <span className="text-gray-500">args: </span>
                {frame.arguments.map((arg, j) => (
                  <span key={j} className="text-gray-400">
                    {j > 0 && ', '}
                    <span className="text-purple-300">{arg.name}</span>
                    <span className="text-gray-600">=</span>
                    <span className="text-green-300">{String(arg.value)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Return value */}
            {frame.returnValue !== undefined && (
              <div className="mt-1 text-xs">
                <span className="text-gray-500">return: </span>
                <span className="text-yellow-300">{String(frame.returnValue)}</span>
              </div>
            )}

            {/* Stack depth indicator */}
            {i === 0 && (
              <div className="mt-1 text-xs text-gray-500">
                ← current frame (depth: {callStack.length})
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
