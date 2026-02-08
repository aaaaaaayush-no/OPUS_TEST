/**
 * Utilities for extracting tree visualization data from Acorn AST,
 * execution snapshots, and code structure.
 */
import * as acorn from 'acorn';
import type { Node } from 'acorn';
import type {
  TreeNode,
  NodeCategory,
  CallTreeNode,
  CFGNode,
  CFGEdge,
  ControlFlowGraph,
} from './treeTypes';
import type { ExecutionState } from './types';

// ─── AST Node type helper ────────────────────────────────────────────────────
interface ASTNode extends Node {
  [key: string]: unknown;
}

// ─── Node category classification ────────────────────────────────────────────
function getNodeCategory(type: string): NodeCategory {
  const declarations = [
    'VariableDeclaration', 'VariableDeclarator', 'FunctionDeclaration',
    'ClassDeclaration',
  ];
  const expressions = [
    'CallExpression', 'MemberExpression', 'AssignmentExpression',
    'ConditionalExpression', 'ArrowFunctionExpression',
    'FunctionExpression', 'NewExpression', 'ArrayExpression',
    'ObjectExpression', 'TemplateLiteral', 'SpreadElement',
  ];
  const statements = [
    'ExpressionStatement', 'BlockStatement', 'ReturnStatement',
    'ThrowStatement', 'TryStatement', 'SwitchStatement', 'SwitchCase',
    'EmptyStatement',
  ];
  const literals = ['Literal'];
  const operators = ['BinaryExpression', 'LogicalExpression', 'UnaryExpression', 'UpdateExpression'];
  const control = [
    'IfStatement', 'WhileStatement', 'ForStatement', 'DoWhileStatement',
    'BreakStatement', 'ContinueStatement',
  ];

  if (type === 'Program') return 'program';
  if (declarations.includes(type)) return 'declaration';
  if (control.includes(type)) return 'control';
  if (operators.includes(type)) return 'operator';
  if (literals.includes(type)) return 'literal';
  if (statements.includes(type)) return 'statement';
  if (expressions.includes(type)) return 'expression';
  return 'statement';
}

// ─── AST label helpers ───────────────────────────────────────────────────────
function getNodeLabel(node: ASTNode): string {
  switch (node.type) {
    case 'Program':
      return 'Program';
    case 'VariableDeclaration':
      return `${(node as ASTNode & { kind: string }).kind}`;
    case 'VariableDeclarator': {
      const id = (node as ASTNode & { id: ASTNode }).id;
      return `${(id as ASTNode & { name: string }).name}`;
    }
    case 'FunctionDeclaration': {
      const fId = (node as ASTNode & { id: ASTNode | null }).id;
      return `function ${fId ? (fId as ASTNode & { name: string }).name : '<anon>'}`;
    }
    case 'Identifier':
      return (node as ASTNode & { name: string }).name;
    case 'Literal':
      return String((node as ASTNode & { value: unknown }).value);
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'AssignmentExpression':
      return (node as ASTNode & { operator: string }).operator;
    case 'CallExpression': {
      const callee = (node as ASTNode & { callee: ASTNode }).callee;
      if (callee.type === 'Identifier') return `${(callee as ASTNode & { name: string }).name}()`;
      if (callee.type === 'MemberExpression') {
        const obj = (callee as ASTNode & { object: ASTNode }).object;
        const prop = (callee as ASTNode & { property: ASTNode }).property;
        if (obj.type === 'Identifier' && prop.type === 'Identifier') {
          return `${(obj as ASTNode & { name: string }).name}.${(prop as ASTNode & { name: string }).name}()`;
        }
      }
      return 'call()';
    }
    case 'IfStatement':
      return 'if';
    case 'WhileStatement':
      return 'while';
    case 'ForStatement':
      return 'for';
    case 'ReturnStatement':
      return 'return';
    case 'BlockStatement':
      return 'block';
    case 'ExpressionStatement':
      return 'expr';
    case 'ArrowFunctionExpression':
      return '=>';
    case 'MemberExpression': {
      const mObj = (node as ASTNode & { object: ASTNode }).object;
      const mProp = (node as ASTNode & { property: ASTNode }).property;
      if (mObj.type === 'Identifier' && mProp.type === 'Identifier') {
        return `${(mObj as ASTNode & { name: string }).name}.${(mProp as ASTNode & { name: string }).name}`;
      }
      return 'member';
    }
    case 'ArrayExpression':
      return '[]';
    case 'ObjectExpression':
      return '{}';
    case 'UnaryExpression':
    case 'UpdateExpression':
      return (node as ASTNode & { operator: string }).operator;
    case 'ConditionalExpression':
      return '? :';
    case 'TemplateLiteral':
      return '``';
    case 'ThrowStatement':
      return 'throw';
    case 'TryStatement':
      return 'try/catch';
    case 'SwitchStatement':
      return 'switch';
    case 'BreakStatement':
      return 'break';
    case 'ContinueStatement':
      return 'continue';
    default:
      return node.type;
  }
}

// ─── Ordered child node keys per AST node type ───────────────────────────────
const CHILD_KEYS: Record<string, string[]> = {
  Program: ['body'],
  VariableDeclaration: ['declarations'],
  VariableDeclarator: ['id', 'init'],
  FunctionDeclaration: ['id', 'params', 'body'],
  FunctionExpression: ['id', 'params', 'body'],
  ArrowFunctionExpression: ['params', 'body'],
  ExpressionStatement: ['expression'],
  CallExpression: ['callee', 'arguments'],
  MemberExpression: ['object', 'property'],
  BinaryExpression: ['left', 'right'],
  LogicalExpression: ['left', 'right'],
  UnaryExpression: ['argument'],
  UpdateExpression: ['argument'],
  AssignmentExpression: ['left', 'right'],
  IfStatement: ['test', 'consequent', 'alternate'],
  WhileStatement: ['test', 'body'],
  ForStatement: ['init', 'test', 'update', 'body'],
  ReturnStatement: ['argument'],
  BlockStatement: ['body'],
  ArrayExpression: ['elements'],
  ObjectExpression: ['properties'],
  Property: ['key', 'value'],
  ConditionalExpression: ['test', 'consequent', 'alternate'],
  TemplateLiteral: ['quasis', 'expressions'],
  ThrowStatement: ['argument'],
  TryStatement: ['block', 'handler', 'finalizer'],
  CatchClause: ['param', 'body'],
  SwitchStatement: ['discriminant', 'cases'],
  SwitchCase: ['test', 'consequent'],
  NewExpression: ['callee', 'arguments'],
  SpreadElement: ['argument'],
};

// ─── Build AST tree ──────────────────────────────────────────────────────────
let nodeIdCounter = 0;

function buildASTTree(node: ASTNode, depth: number): TreeNode {
  const id = `ast-${nodeIdCounter++}`;
  const loc = node.loc as { start: { line: number; column: number } } | undefined;
  const children: TreeNode[] = [];

  const keys = CHILD_KEYS[node.type] || [];
  for (const key of keys) {
    const child = node[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          children.push(buildASTTree(item as ASTNode, depth + 1));
        }
      }
    } else if (typeof child === 'object' && 'type' in (child as object)) {
      children.push(buildASTTree(child as ASTNode, depth + 1));
    }
  }

  return {
    id,
    type: node.type,
    label: getNodeLabel(node),
    children,
    metadata: {
      lineNumber: loc?.start.line,
      column: loc?.start.column,
      depth,
      nodeCategory: getNodeCategory(node.type),
    },
  };
}

/**
 * Parse source code and return the AST as a TreeNode hierarchy.
 */
export function parseAST(source: string): TreeNode {
  nodeIdCounter = 0;
  const ast = acorn.parse(source, {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: true,
  }) as unknown as ASTNode;
  return buildASTTree(ast, 0);
}

/**
 * Mark AST nodes that correspond to the currently executing line.
 */
export function markExecutingNodes(
  tree: TreeNode,
  currentLine: number,
): TreeNode {
  const isExecuting = tree.metadata.lineNumber === currentLine;
  return {
    ...tree,
    children: tree.children.map((c) => markExecutingNodes(c, currentLine)),
    metadata: {
      ...tree.metadata,
      isExecuting,
    },
  };
}

// ─── Call Tree extraction ────────────────────────────────────────────────────

/**
 * Build a call tree from execution snapshots.
 * Tracks function enter/exit via call stack depth changes.
 */
export function buildCallTree(snapshots: ExecutionState[]): CallTreeNode | null {
  if (snapshots.length === 0) return null;

  let callIndex = 0;
  const root: CallTreeNode = {
    id: 'call-root',
    functionName: '<program>',
    args: [],
    children: [],
    depth: 0,
    callIndex: callIndex++,
  };

  // Stack to track parent context
  const parentStack: CallTreeNode[] = [root];
  let prevDepth = 0;

  for (const snap of snapshots) {
    const currentDepth = snap.callStack.length;

    if (currentDepth > prevDepth) {
      // New function call - find the new frame(s)
      for (let d = prevDepth; d < currentDepth; d++) {
        const frame = snap.callStack[d];
        if (!frame) continue;
        const node: CallTreeNode = {
          id: `call-${callIndex}`,
          functionName: frame.functionName,
          args: frame.arguments.map((a) => a.value),
          children: [],
          depth: d + 1,
          callIndex: callIndex++,
          lineNumber: frame.sourceLocation.line,
        };
        const parent = parentStack[parentStack.length - 1];
        parent.children.push(node);
        parentStack.push(node);
      }
    } else if (currentDepth < prevDepth) {
      // Function returned - pop the stack
      const popCount = prevDepth - currentDepth;
      for (let i = 0; i < popCount; i++) {
        parentStack.pop();
      }
    }

    // Update return values for completed calls
    if (currentDepth > 0) {
      const topFrame = snap.callStack[currentDepth - 1];
      const current = parentStack[parentStack.length - 1];
      if (current && topFrame?.returnValue !== undefined) {
        current.returnValue = topFrame.returnValue;
      }
    }

    prevDepth = currentDepth;
  }

  // Mark base cases (leaf nodes) and duplicates
  markCallTreeMetadata(root);
  return root;
}

function markCallTreeMetadata(node: CallTreeNode): void {
  if (node.children.length === 0 && node.functionName !== '<program>') {
    node.isBaseCase = true;
  }

  // Find duplicates (same function + same args)
  const seen = new Map<string, number>();
  for (const child of node.children) {
    const key = `${child.functionName}(${JSON.stringify(child.args)})`;
    const count = seen.get(key) || 0;
    if (count > 0) {
      child.isDuplicate = true;
    }
    seen.set(key, count + 1);
    markCallTreeMetadata(child);
  }
}

// ─── Control Flow Graph extraction ──────────────────────────────────────────

let cfgIdCounter = 0;

/**
 * Build a simplified Control Flow Graph from source code.
 */
export function buildCFG(source: string): ControlFlowGraph {
  cfgIdCounter = 0;
  const ast = acorn.parse(source, {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: true,
  }) as unknown as ASTNode;

  const nodes: CFGNode[] = [];
  const edges: CFGEdge[] = [];

  const startNode: CFGNode = {
    id: `cfg-${cfgIdCounter++}`,
    type: 'start',
    label: 'Start',
  };
  const endNode: CFGNode = {
    id: `cfg-${cfgIdCounter++}`,
    type: 'end',
    label: 'End',
  };
  nodes.push(startNode);
  nodes.push(endNode);

  const body = (ast as ASTNode & { body: ASTNode[] }).body;
  const lastNodeId = processCFGStatements(body, startNode.id, endNode.id, nodes, edges);

  // If no statements connected to end, connect the last node
  if (lastNodeId !== endNode.id && !edges.some((e) => e.target === endNode.id)) {
    edges.push({
      source: lastNodeId,
      target: endNode.id,
      type: 'normal',
    });
  }

  return { nodes, edges };
}

function processCFGStatements(
  stmts: ASTNode[],
  prevId: string,
  endId: string,
  nodes: CFGNode[],
  edges: CFGEdge[],
): string {
  let currentId = prevId;

  for (const stmt of stmts) {
    currentId = processCFGNode(stmt, currentId, endId, nodes, edges);
  }

  return currentId;
}

function getCFGNodeType(astType: string): CFGNode['type'] {
  switch (astType) {
    case 'IfStatement': return 'condition';
    case 'WhileStatement':
    case 'ForStatement':
    case 'DoWhileStatement': return 'loop';
    case 'ReturnStatement': return 'return';
    case 'CallExpression': return 'functionCall';
    case 'TryStatement': return 'trycatch';
    default: return 'statement';
  }
}

function getCFGLabel(node: ASTNode): string {
  const loc = node.loc as { start: { line: number } } | undefined;
  const prefix = loc ? `L${loc.start.line}: ` : '';
  switch (node.type) {
    case 'VariableDeclaration': {
      const decls = (node as ASTNode & { declarations: ASTNode[] }).declarations;
      const kind = (node as ASTNode & { kind: string }).kind;
      const names = decls.map((d) => {
        const id = (d as ASTNode & { id: ASTNode }).id;
        return (id as ASTNode & { name: string }).name;
      }).join(', ');
      return `${prefix}${kind} ${names}`;
    }
    case 'ExpressionStatement': {
      const expr = (node as ASTNode & { expression: ASTNode }).expression;
      if (expr.type === 'CallExpression') {
        const callee = (expr as ASTNode & { callee: ASTNode }).callee;
        if (callee.type === 'Identifier') {
          return `${prefix}${(callee as ASTNode & { name: string }).name}()`;
        }
        if (callee.type === 'MemberExpression') {
          const obj = (callee as ASTNode & { object: ASTNode }).object;
          const prop = (callee as ASTNode & { property: ASTNode }).property;
          if (obj.type === 'Identifier' && prop.type === 'Identifier') {
            return `${prefix}${(obj as ASTNode & { name: string }).name}.${(prop as ASTNode & { name: string }).name}()`;
          }
        }
        return `${prefix}call()`;
      }
      if (expr.type === 'AssignmentExpression') {
        const left = (expr as ASTNode & { left: ASTNode }).left;
        if (left.type === 'Identifier') {
          return `${prefix}${(left as ASTNode & { name: string }).name} ${(expr as ASTNode & { operator: string }).operator} ...`;
        }
      }
      return `${prefix}expression`;
    }
    case 'IfStatement':
      return `${prefix}if (...)`;
    case 'WhileStatement':
      return `${prefix}while (...)`;
    case 'ForStatement':
      return `${prefix}for (...)`;
    case 'ReturnStatement':
      return `${prefix}return`;
    case 'FunctionDeclaration': {
      const id = (node as ASTNode & { id: ASTNode | null }).id;
      return `${prefix}function ${id ? (id as ASTNode & { name: string }).name : '<anon>'}`;
    }
    case 'TryStatement':
      return `${prefix}try`;
    default:
      return `${prefix}${node.type}`;
  }
}

function processCFGNode(
  node: ASTNode,
  prevId: string,
  endId: string,
  nodes: CFGNode[],
  edges: CFGEdge[],
): string {
  const loc = node.loc as { start: { line: number } } | undefined;

  switch (node.type) {
    case 'IfStatement': {
      const condNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'condition',
        label: getCFGLabel(node),
        lineNumber: loc?.start.line,
      };
      nodes.push(condNode);
      edges.push({ source: prevId, target: condNode.id, type: 'normal' });

      // Merge point after if/else
      const mergeNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'statement',
        label: 'merge',
        lineNumber: loc?.start.line,
      };
      nodes.push(mergeNode);

      // True branch
      const consequent = (node as ASTNode & { consequent: ASTNode }).consequent;
      const trueBody = consequent.type === 'BlockStatement'
        ? (consequent as ASTNode & { body: ASTNode[] }).body
        : [consequent];

      if (trueBody.length > 0) {
        const trueEnd = processCFGStatements(trueBody, condNode.id, endId, nodes, edges);
        // Replace the last auto-edge from condNode with a labeled one
        const lastEdge = edges[edges.length - 1];
        if (lastEdge && lastEdge.source === condNode.id) {
          lastEdge.label = 'true';
          lastEdge.type = 'true';
        }
        edges.push({ source: trueEnd, target: mergeNode.id, type: 'normal' });
      } else {
        edges.push({ source: condNode.id, target: mergeNode.id, label: 'true', type: 'true' });
      }

      // False branch
      const alternate = (node as ASTNode & { alternate: ASTNode | null }).alternate;
      if (alternate) {
        const falseBody = alternate.type === 'BlockStatement'
          ? (alternate as ASTNode & { body: ASTNode[] }).body
          : alternate.type === 'IfStatement'
            ? [alternate]
            : [alternate];
        const falseEnd = processCFGStatements(falseBody, condNode.id, endId, nodes, edges);
        const lastEdgeF = edges.find(
          (e) => e.source === condNode.id && !e.label,
        );
        if (lastEdgeF) {
          lastEdgeF.label = 'false';
          lastEdgeF.type = 'false';
        }
        edges.push({ source: falseEnd, target: mergeNode.id, type: 'normal' });
      } else {
        edges.push({ source: condNode.id, target: mergeNode.id, label: 'false', type: 'false' });
      }

      return mergeNode.id;
    }

    case 'WhileStatement':
    case 'ForStatement': {
      const loopNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'loop',
        label: getCFGLabel(node),
        lineNumber: loc?.start.line,
      };
      nodes.push(loopNode);
      edges.push({ source: prevId, target: loopNode.id, type: 'normal' });

      // Loop body
      const body = (node as ASTNode & { body: ASTNode }).body;
      const bodyStmts = body.type === 'BlockStatement'
        ? (body as ASTNode & { body: ASTNode[] }).body
        : [body];

      const afterLoop: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'statement',
        label: 'end loop',
        lineNumber: loc?.start.line,
      };
      nodes.push(afterLoop);

      if (bodyStmts.length > 0) {
        const bodyEnd = processCFGStatements(bodyStmts, loopNode.id, endId, nodes, edges);
        // Label the edge from loop to body
        const bodyEdge = edges.find(
          (e) => e.source === loopNode.id && !e.label,
        );
        if (bodyEdge) {
          bodyEdge.label = 'true';
          bodyEdge.type = 'true';
        }
        // Back edge
        edges.push({ source: bodyEnd, target: loopNode.id, type: 'loop-back' });
      }

      // Exit edge
      edges.push({ source: loopNode.id, target: afterLoop.id, label: 'false', type: 'false' });

      return afterLoop.id;
    }

    case 'ReturnStatement': {
      const retNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'return',
        label: getCFGLabel(node),
        lineNumber: loc?.start.line,
      };
      nodes.push(retNode);
      edges.push({ source: prevId, target: retNode.id, type: 'normal' });
      edges.push({ source: retNode.id, target: endId, type: 'normal' });
      return retNode.id;
    }

    case 'FunctionDeclaration': {
      // Create a functionCall-type CFG node; visual styling (double border) is applied in FlowchartPanel
      const funcNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'functionCall',
        label: getCFGLabel(node),
        lineNumber: loc?.start.line,
      };
      nodes.push(funcNode);
      edges.push({ source: prevId, target: funcNode.id, type: 'normal' });
      return funcNode.id;
    }

    case 'TryStatement': {
      const tryNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'trycatch',
        label: getCFGLabel(node),
        lineNumber: loc?.start.line,
      };
      nodes.push(tryNode);
      edges.push({ source: prevId, target: tryNode.id, type: 'normal' });

      // Merge point after try-catch
      const mergeNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: 'statement',
        label: 'end try',
        lineNumber: loc?.start.line,
      };
      nodes.push(mergeNode);

      // Try block body
      const tryBlock = (node as ASTNode & { block: ASTNode }).block;
      const tryBody = (tryBlock as ASTNode & { body: ASTNode[] }).body;
      if (tryBody.length > 0) {
        const tryEnd = processCFGStatements(tryBody, tryNode.id, endId, nodes, edges);
        edges.push({ source: tryEnd, target: mergeNode.id, type: 'normal' });
      } else {
        edges.push({ source: tryNode.id, target: mergeNode.id, type: 'normal' });
      }

      // Catch block
      const handler = (node as ASTNode & { handler: ASTNode | null }).handler;
      if (handler) {
        const catchNode: CFGNode = {
          id: `cfg-${cfgIdCounter++}`,
          type: 'trycatch',
          label: `L${(handler.loc as { start: { line: number } })?.start.line || ''}: catch`,
          lineNumber: (handler.loc as { start: { line: number } })?.start.line,
        };
        nodes.push(catchNode);
        edges.push({ source: tryNode.id, target: catchNode.id, label: 'error', type: 'exception' });

        const catchBody = ((handler as ASTNode & { body: ASTNode }).body as ASTNode & { body: ASTNode[] }).body;
        if (catchBody.length > 0) {
          const catchEnd = processCFGStatements(catchBody, catchNode.id, endId, nodes, edges);
          edges.push({ source: catchEnd, target: mergeNode.id, type: 'normal' });
        } else {
          edges.push({ source: catchNode.id, target: mergeNode.id, type: 'normal' });
        }
      }

      // Finally block
      const finalizer = (node as ASTNode & { finalizer: ASTNode | null }).finalizer;
      if (finalizer) {
        const finallyNode: CFGNode = {
          id: `cfg-${cfgIdCounter++}`,
          type: 'statement',
          label: 'finally',
          lineNumber: (finalizer.loc as { start: { line: number } })?.start.line,
        };
        nodes.push(finallyNode);
        edges.push({ source: mergeNode.id, target: finallyNode.id, type: 'normal' });
        return finallyNode.id;
      }

      return mergeNode.id;
    }

    default: {
      const stmtNode: CFGNode = {
        id: `cfg-${cfgIdCounter++}`,
        type: getCFGNodeType(node.type),
        label: getCFGLabel(node),
        lineNumber: loc?.start.line,
      };
      nodes.push(stmtNode);
      edges.push({ source: prevId, target: stmtNode.id, type: 'normal' });
      return stmtNode.id;
    }
  }
}

/**
 * Mark CFG nodes that were executed based on snapshot data.
 */
export function markExecutedCFGNodes(
  cfg: ControlFlowGraph,
  snapshots: ExecutionState[],
): ControlFlowGraph {
  const executedLines = new Set<number>();
  for (const snap of snapshots) {
    if (snap.currentLine > 0) {
      executedLines.add(snap.currentLine);
    }
  }

  return {
    nodes: cfg.nodes.map((n) => ({
      ...n,
      wasExecuted: n.lineNumber ? executedLines.has(n.lineNumber) : n.type === 'start' || n.type === 'end',
    })),
    edges: cfg.edges.map((e) => {
      const sourceNode = cfg.nodes.find((n) => n.id === e.source);
      const targetNode = cfg.nodes.find((n) => n.id === e.target);
      return {
        ...e,
        wasExecuted:
          (sourceNode?.lineNumber ? executedLines.has(sourceNode.lineNumber) : false) &&
          (targetNode?.lineNumber ? executedLines.has(targetNode.lineNumber) : false),
      };
    }),
  };
}
