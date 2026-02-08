/**
 * Type definitions for tree-based visualizations:
 * AST viewer, Call Tree, and Control Flow Graph.
 */

/** Generic tree node used across all tree visualizations */
export interface TreeNode {
  id: string;
  type: string;
  label: string;
  children: TreeNode[];
  metadata: {
    lineNumber?: number;
    column?: number;
    depth: number;
    isExecuting?: boolean;
    executionCount?: number;
    nodeCategory?: NodeCategory;
    /** Extra data specific to the visualization type */
    extra?: Record<string, unknown>;
  };
}

/** Categories for color-coding AST nodes */
export type NodeCategory =
  | 'declaration'
  | 'expression'
  | 'statement'
  | 'literal'
  | 'operator'
  | 'control'
  | 'function'
  | 'program';

/** Call tree node representing a function invocation */
export interface CallTreeNode {
  id: string;
  functionName: string;
  args: unknown[];
  returnValue?: unknown;
  children: CallTreeNode[];
  depth: number;
  callIndex: number;
  lineNumber?: number;
  isBaseCase?: boolean;
  isDuplicate?: boolean;
}

/** Control Flow Graph node */
export interface CFGNode {
  id: string;
  type: 'start' | 'end' | 'statement' | 'condition' | 'loop' | 'functionCall' | 'return' | 'input' | 'output' | 'annotation' | 'trycatch';
  label: string;
  lineNumber?: number;
  wasExecuted?: boolean;
  /** Source code text for the node */
  code?: string;
  /** Number of times this node was executed */
  executionCount?: number;
  /** Whether this node is currently being executed */
  isExecuting?: boolean;
}

/** Control Flow Graph edge */
export interface CFGEdge {
  source: string;
  target: string;
  label?: string;
  type: 'normal' | 'true' | 'false' | 'loop-back' | 'function-call' | 'return' | 'exception' | 'async';
  wasExecuted?: boolean;
}

/** Complete Control Flow Graph */
export interface ControlFlowGraph {
  nodes: CFGNode[];
  edges: CFGEdge[];
}
