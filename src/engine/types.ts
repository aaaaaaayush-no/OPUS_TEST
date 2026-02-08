/** Core type definitions for the code visualizer execution engine */

export interface SourceLocation {
  line: number;
  column: number;
}

export interface Variable {
  name: string;
  value: unknown;
  type: string;
  reference?: string;
  isNew: boolean;
  scope: 'local' | 'closure' | 'global';
}

export interface StackFrame {
  functionName: string;
  arguments: Variable[];
  localVariables: Map<string, Variable>;
  returnValue?: unknown;
  sourceLocation: SourceLocation;
}

export interface ConsoleOutput {
  type: 'log' | 'warn' | 'error' | 'info';
  args: unknown[];
  timestamp: number;
}

export interface ErrorInfo {
  message: string;
  line: number;
  column: number;
  stack?: string;
}

export interface ExecutionState {
  step: number;
  currentLine: number;
  currentColumn: number;
  callStack: StackFrame[];
  output: ConsoleOutput[];
  errorState: ErrorInfo | null;
  globalVariables: Map<string, Variable>;
}

export interface Breakpoint {
  line: number;
  condition?: string;
}

export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'stepping' | 'finished' | 'error';
