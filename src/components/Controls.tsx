import { useExecutionStore } from '../store/executionStore';

export default function Controls() {
  const status = useExecutionStore((s) => s.status);
  const runCode = useExecutionStore((s) => s.runCode);
  const stepForward = useExecutionStore((s) => s.stepForward);
  const stepBackward = useExecutionStore((s) => s.stepBackward);
  const autoPlay = useExecutionStore((s) => s.autoPlay);
  const pause = useExecutionStore((s) => s.pause);
  const reset = useExecutionStore((s) => s.reset);
  const executionSpeed = useExecutionStore((s) => s.executionSpeed);
  const setExecutionSpeed = useExecutionStore((s) => s.setExecutionSpeed);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const totalSteps = useExecutionStore((s) => s.snapshots.length);
  const error = useExecutionStore((s) => s.error);

  const canStepForward = currentStepIndex < totalSteps - 1 && status !== 'idle';
  const canStepBackward = currentStepIndex > 0;
  const isRunning = status === 'running';

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-3">
      {/* Run / Reset */}
      <div className="flex items-center gap-1">
        {status === 'idle' || status === 'error' ? (
          <button
            onClick={runCode}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-colors"
            title="Run code (parse and execute)"
          >
            ▶ Run
          </button>
        ) : (
          <button
            onClick={reset}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-colors"
            title="Reset execution"
          >
            ⏹ Reset
          </button>
        )}
      </div>

      {/* Step Controls */}
      <div className="flex items-center gap-1 border-l border-gray-600 pl-3">
        <button
          onClick={stepBackward}
          disabled={!canStepBackward}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-sm transition-colors"
          title="Step backward"
        >
          ⏪
        </button>

        {isRunning ? (
          <button
            onClick={pause}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
            title="Pause auto-play"
          >
            ⏸
          </button>
        ) : (
          <button
            onClick={autoPlay}
            disabled={!canStepForward}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
            title="Auto-play through steps"
          >
            ▶▶
          </button>
        )}

        <button
          onClick={stepForward}
          disabled={!canStepForward}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-sm transition-colors"
          title="Step forward"
        >
          ⏩
        </button>
      </div>

      {/* Speed Control */}
      <div className="flex items-center gap-2 border-l border-gray-600 pl-3">
        <label className="text-gray-400 text-xs">Speed:</label>
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={2050 - executionSpeed}
          onChange={(e) => setExecutionSpeed(2050 - Number(e.target.value))}
          className="w-20 accent-blue-500"
          title={`${executionSpeed}ms per step`}
        />
        <span className="text-gray-500 text-xs w-12">{executionSpeed}ms</span>
      </div>

      {/* Step Counter */}
      {status !== 'idle' && (
        <div className="border-l border-gray-600 pl-3 flex items-center gap-2">
          <span className="text-gray-400 text-xs">
            Step {currentStepIndex + 1} / {totalSteps}
          </span>
          <input
            type="range"
            min={0}
            max={totalSteps - 1}
            value={currentStepIndex}
            onChange={(e) => useExecutionStore.getState().jumpToStep(Number(e.target.value))}
            className="w-32 accent-blue-500"
            title="Jump to step (time-travel)"
          />
        </div>
      )}

      {/* Status indicator */}
      <div className="ml-auto flex items-center gap-2">
        {error && (
          <span className="text-red-400 text-xs max-w-xs truncate" title={error}>
            ⚠ {error}
          </span>
        )}
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            status === 'running'
              ? 'bg-green-400 animate-pulse'
              : status === 'paused' || status === 'stepping'
                ? 'bg-yellow-400'
                : status === 'finished'
                  ? 'bg-blue-400'
                  : status === 'error'
                    ? 'bg-red-400'
                    : 'bg-gray-500'
          }`}
        />
        <span className="text-gray-400 text-xs capitalize">{status}</span>
      </div>
    </div>
  );
}
