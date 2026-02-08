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

  const canStepForward = currentStepIndex < totalSteps - 1 && status !== 'idle';
  const canStepBackward = currentStepIndex > 0;
  const isRunning = status === 'running';

  return (
    <div className="cf-toolbar">
      {/* Run / Reset */}
      {status === 'idle' || status === 'error' ? (
        <button onClick={runCode} className="cf-btn cf-btn-success" title="Run code (parse and execute)">
          ▶ Run
        </button>
      ) : (
        <button onClick={reset} className="cf-btn" title="Reset execution">
          ⏹ Reset
        </button>
      )}

      <div className="cf-toolbar-separator" />

      {/* Step Controls */}
      <button
        onClick={stepBackward}
        disabled={!canStepBackward}
        className="cf-btn cf-btn-icon"
        title="Step backward"
      >
        ⏮
      </button>

      {isRunning ? (
        <button onClick={pause} className="cf-btn cf-btn-icon" title="Pause auto-play" style={{ borderColor: 'var(--accent-warning)', color: 'var(--accent-warning)' }}>
          ⏸
        </button>
      ) : (
        <button
          onClick={autoPlay}
          disabled={!canStepForward}
          className="cf-btn cf-btn-icon cf-btn-primary"
          title="Auto-play through steps"
        >
          ▶▶
        </button>
      )}

      <button
        onClick={stepForward}
        disabled={!canStepForward}
        className="cf-btn cf-btn-icon"
        title="Step forward"
      >
        ⏭
      </button>

      <div className="cf-toolbar-separator" />

      {/* Speed Control */}
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Speed:</span>
      <input
        type="range"
        className="cf-slider"
        min={50}
        max={2000}
        step={50}
        value={2050 - executionSpeed}
        onChange={(e) => setExecutionSpeed(2050 - Number(e.target.value))}
        style={{ width: 80 }}
        title={`${executionSpeed}ms per step`}
      />
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40 }}>{executionSpeed}ms</span>

      {/* Step Counter & Timeline Slider */}
      {status !== 'idle' && (
        <>
          <div className="cf-toolbar-separator" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Step {currentStepIndex + 1} / {totalSteps}
          </span>
          <input
            type="range"
            className="cf-slider"
            min={0}
            max={totalSteps - 1}
            value={currentStepIndex}
            onChange={(e) => useExecutionStore.getState().jumpToStep(Number(e.target.value))}
            style={{ width: 120 }}
            title="Jump to step (time-travel)"
          />
        </>
      )}
    </div>
  );
}
