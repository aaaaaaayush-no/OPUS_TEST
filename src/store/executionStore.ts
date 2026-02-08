/**
 * Zustand store for managing execution state, time-travel debugging,
 * breakpoints, and execution controls.
 */
import { create } from 'zustand';
import type { ExecutionState, Breakpoint, ExecutionStatus } from '../engine/types';
import { Interpreter } from '../engine/interpreter';

interface ExecutionStore {
  // State
  code: string;
  snapshots: ExecutionState[];
  currentStepIndex: number;
  status: ExecutionStatus;
  breakpoints: Breakpoint[];
  executionSpeed: number; // ms between steps in auto-play
  error: string | null;

  // Derived
  currentSnapshot: ExecutionState | null;

  // Actions
  setCode: (code: string) => void;
  runCode: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStep: (step: number) => void;
  reset: () => void;
  toggleBreakpoint: (line: number) => void;
  setExecutionSpeed: (speed: number) => void;
  autoPlay: () => void;
  pause: () => void;
}

const DEFAULT_CODE = `// Welcome to Code Visualizer!
// Write JavaScript code and click "Run" to see it execute step by step.

function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

let result = factorial(5);
console.log("Factorial of 5 is:", result);
`;

let autoPlayTimer: ReturnType<typeof setInterval> | null = null;

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  code: DEFAULT_CODE,
  snapshots: [],
  currentStepIndex: -1,
  status: 'idle',
  breakpoints: [],
  executionSpeed: 500,
  error: null,

  get currentSnapshot() {
    const { snapshots, currentStepIndex } = get();
    if (currentStepIndex >= 0 && currentStepIndex < snapshots.length) {
      return snapshots[currentStepIndex];
    }
    return null;
  },

  setCode: (code: string) => {
    set({ code, status: 'idle', snapshots: [], currentStepIndex: -1, error: null });
  },

  runCode: () => {
    const { code } = get();
    const interpreter = new Interpreter();

    try {
      interpreter.parse(code);
      const snapshots = interpreter.run();
      set({
        snapshots,
        currentStepIndex: 0,
        status: 'paused',
        error: null,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        status: 'error',
        snapshots: [],
        currentStepIndex: -1,
      });
    }
  },

  stepForward: () => {
    const { currentStepIndex, snapshots, breakpoints } = get();
    if (currentStepIndex < snapshots.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const nextSnapshot = snapshots[nextIndex];
      const isBreakpoint = breakpoints.some((bp) => bp.line === nextSnapshot?.currentLine);
      set({
        currentStepIndex: nextIndex,
        status: nextIndex === snapshots.length - 1 ? 'finished' : isBreakpoint ? 'paused' : 'stepping',
      });
    } else {
      set({ status: 'finished' });
    }
  },

  stepBackward: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1, status: 'paused' });
    }
  },

  jumpToStep: (step: number) => {
    const { snapshots } = get();
    if (step >= 0 && step < snapshots.length) {
      set({
        currentStepIndex: step,
        status: step === snapshots.length - 1 ? 'finished' : 'paused',
      });
    }
  },

  reset: () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
    set({ snapshots: [], currentStepIndex: -1, status: 'idle', error: null });
  },

  toggleBreakpoint: (line: number) => {
    const { breakpoints } = get();
    const exists = breakpoints.findIndex((bp) => bp.line === line);
    if (exists >= 0) {
      set({ breakpoints: breakpoints.filter((_, i) => i !== exists) });
    } else {
      set({ breakpoints: [...breakpoints, { line }] });
    }
  },

  setExecutionSpeed: (speed: number) => {
    set({ executionSpeed: speed });
  },

  autoPlay: () => {
    if (autoPlayTimer) clearInterval(autoPlayTimer);
    set({ status: 'running' });

    autoPlayTimer = setInterval(() => {
      const { currentStepIndex, snapshots, breakpoints, status } = get();
      if (status !== 'running') {
        if (autoPlayTimer) clearInterval(autoPlayTimer);
        autoPlayTimer = null;
        return;
      }

      if (currentStepIndex < snapshots.length - 1) {
        const nextIndex = currentStepIndex + 1;
        const nextSnapshot = snapshots[nextIndex];
        const isBreakpoint = breakpoints.some((bp) => bp.line === nextSnapshot?.currentLine);

        if (isBreakpoint) {
          set({ currentStepIndex: nextIndex, status: 'paused' });
          if (autoPlayTimer) clearInterval(autoPlayTimer);
          autoPlayTimer = null;
        } else {
          set({ currentStepIndex: nextIndex });
        }
      } else {
        set({ status: 'finished' });
        if (autoPlayTimer) clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
    }, get().executionSpeed);
  },

  pause: () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
    set({ status: 'paused' });
  },
}));
