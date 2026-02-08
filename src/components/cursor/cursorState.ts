/**
 * Cursor state management - extends the execution store with cursor-specific state.
 */
import { useExecutionStore } from '../../store/executionStore';
import type { ExecutionState, StackFrame, Variable } from '../../engine/types';

/** Classify the operation type for a given execution step */
export type CursorOperationType = 
  | 'assignment' 
  | 'function-call' 
  | 'conditional' 
  | 'return' 
  | 'error' 
  | 'loop'
  | 'normal';

export interface CursorTrailPoint {
  step: number;
  line: number;
  operationType: CursorOperationType;
}

/** Color for each operation type */
export const CURSOR_COLORS: Record<CursorOperationType, string> = {
  'assignment': '#2563EB',
  'function-call': '#059669',
  'conditional': '#7C3AED',
  'return': '#EA580C',
  'error': '#DC2626',
  'loop': '#7C3AED',
  'normal': '#2563EB',
};

/** Label for each operation type */
export const CURSOR_LABELS: Record<CursorOperationType, string> = {
  'assignment': 'Variable Assignment',
  'function-call': 'Function Call',
  'conditional': 'Conditional',
  'return': 'Return Statement',
  'error': 'Error',
  'loop': 'Loop',
  'normal': 'Statement',
};

/** Infer cursor operation type from execution state transitions */
export function inferOperationType(
  current: ExecutionState | null,
  previous: ExecutionState | null,
): CursorOperationType {
  if (!current) return 'normal';
  
  if (current.errorState) return 'error';

  // Check if a new function was pushed onto the stack
  if (previous && current.callStack.length > previous.callStack.length) {
    return 'function-call';
  }

  // Check for return (stack shrunk)
  if (previous && current.callStack.length < previous.callStack.length) {
    return 'return';
  }

  // Check if the same line is repeated (loop)
  if (previous && current.currentLine === previous.currentLine && current.step !== previous.step) {
    return 'loop';
  }

  // Check for variable changes (assignment)
  if (previous) {
    const prevVars = previous.globalVariables;
    const currVars = current.globalVariables;
    if (currVars.size !== prevVars.size) return 'assignment';
    for (const [key, val] of currVars) {
      const prevVal = prevVars.get(key);
      if (!prevVal || prevVal.value !== val.value) return 'assignment';
    }
    // Check locals in top stack frame
    const currFrame = current.callStack[current.callStack.length - 1];
    const prevFrame = previous.callStack[previous.callStack.length - 1];
    if (currFrame && prevFrame && currFrame.functionName === prevFrame.functionName) {
      if (currFrame.localVariables.size !== prevFrame.localVariables.size) return 'assignment';
      for (const [key, val] of currFrame.localVariables) {
        const prevVal = prevFrame.localVariables.get(key);
        if (!prevVal || prevVal.value !== val.value) return 'assignment';
      }
    }
  }

  return 'normal';
}

/** Build trail from execution history */
export function buildTrail(snapshots: ExecutionState[], currentIndex: number, maxLength: number): CursorTrailPoint[] {
  const trail: CursorTrailPoint[] = [];
  const start = Math.max(0, currentIndex - maxLength);
  
  for (let i = start; i <= currentIndex; i++) {
    const current = snapshots[i];
    const previous = i > 0 ? snapshots[i - 1] : null;
    trail.push({
      step: current.step,
      line: current.currentLine,
      operationType: inferOperationType(current, previous),
    });
  }
  
  return trail;
}

/** Get popup details for the current execution step */
export function getStepDetails(snapshots: ExecutionState[], stepIndex: number) {
  const current = snapshots[stepIndex];
  if (!current) return null;

  const previous = stepIndex > 0 ? snapshots[stepIndex - 1] : null;
  const operationType = inferOperationType(current, previous);

  // Gather all variables (global + locals)
  const variables: { name: string; value: unknown; type: string; scope: string; changed: boolean }[] = [];
  
  for (const [, v] of current.globalVariables) {
    const prevVal = previous?.globalVariables.get(v.name);
    variables.push({
      name: v.name,
      value: v.value,
      type: v.type,
      scope: 'global',
      changed: !prevVal || prevVal.value !== v.value,
    });
  }

  const topFrame = current.callStack[current.callStack.length - 1];
  if (topFrame) {
    for (const [, v] of topFrame.localVariables) {
      const prevFrame = previous && previous.callStack.length > 0
        ? previous.callStack[previous.callStack.length - 1]
        : undefined;
      const prevVal = prevFrame?.localVariables.get(v.name);
      variables.push({
        name: v.name,
        value: v.value,
        type: v.type,
        scope: 'local',
        changed: !prevVal || prevVal.value !== v.value,
      });
    }
  }

  return {
    step: current.step,
    line: current.currentLine,
    column: current.currentColumn,
    operationType,
    operationLabel: CURSOR_LABELS[operationType],
    cursorColor: CURSOR_COLORS[operationType],
    callStack: current.callStack.map((f: StackFrame) => ({
      name: f.functionName,
      args: f.arguments.map((a: Variable) => `${a.name}=${JSON.stringify(a.value)}`),
      returnValue: f.returnValue,
    })),
    currentFunction: topFrame?.functionName ?? 'global',
    variables,
    hasError: !!current.errorState,
    errorMessage: current.errorState?.message,
  };
}

/** Calculate execution counts per line */
export function getLineExecutionCounts(snapshots: ExecutionState[], upToIndex: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (let i = 0; i <= upToIndex && i < snapshots.length; i++) {
    const line = snapshots[i].currentLine;
    counts.set(line, (counts.get(line) || 0) + 1);
  }
  return counts;
}

/** Hook to get cursor-related state from the execution store */
export function useCursorState() {
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const status = useExecutionStore((s) => s.status);

  const current = currentStepIndex >= 0 && currentStepIndex < snapshots.length
    ? snapshots[currentStepIndex]
    : null;
  const previous = currentStepIndex > 0
    ? snapshots[currentStepIndex - 1]
    : null;

  const operationType = inferOperationType(current, previous);
  const details = currentStepIndex >= 0 ? getStepDetails(snapshots, currentStepIndex) : null;
  const lineExecutionCounts = currentStepIndex >= 0 ? getLineExecutionCounts(snapshots, currentStepIndex) : new Map();

  return {
    current,
    previous,
    operationType,
    details,
    lineExecutionCounts,
    isActive: status !== 'idle' && current !== null,
    currentLine: current?.currentLine ?? 0,
    totalSteps: snapshots.length,
    currentStep: currentStepIndex,
  };
}
