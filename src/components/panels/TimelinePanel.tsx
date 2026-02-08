import { useExecutionStore } from '../../store/executionStore';

export default function TimelinePanel() {
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const jumpToStep = useExecutionStore((s) => s.jumpToStep);

  if (snapshots.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
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
    <div className="p-3 text-sm overflow-auto h-full">
      <div className="mb-3 text-xs text-gray-400">
        Click any step to jump to that execution state (time-travel)
      </div>

      {/* Compact timeline bar */}
      <div className="flex flex-wrap gap-0.5 mb-4">
        {snapshots.map((snap, i) => (
          <button
            key={i}
            onClick={() => jumpToStep(i)}
            className={`w-3 h-6 rounded-sm transition-all ${
              i === currentStepIndex
                ? 'bg-blue-500 ring-1 ring-blue-300'
                : snap.errorState
                  ? 'bg-red-500/60 hover:bg-red-500'
                  : snap.callStack.length > 0
                    ? 'bg-purple-500/40 hover:bg-purple-500/70'
                    : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title={`Step ${i + 1}: Line ${snap.currentLine}${
              snap.callStack.length > 0
                ? ` (in ${snap.callStack[snap.callStack.length - 1].functionName})`
                : ''
            }`}
          />
        ))}
      </div>

      {/* Line execution counts */}
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
        Lines Executed
      </h3>
      <div className="space-y-0.5">
        {Array.from(lineChanges.entries())
          .sort(([a], [b]) => a - b)
          .filter(([line]) => line > 0)
          .map(([line, steps]) => (
            <div
              key={line}
              className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-gray-800 cursor-pointer"
              onClick={() => jumpToStep(steps[steps.length - 1])}
            >
              <span className="text-gray-500 w-10 text-right text-xs">L{line}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (steps.length / snapshots.length) * 100 * 5)}%`,
                  }}
                />
              </div>
              <span className="text-gray-500 text-xs w-6 text-right">{steps.length}×</span>
            </div>
          ))}
      </div>
    </div>
  );
}
