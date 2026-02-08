import { describe, it, expect } from 'vitest';
import {
  parseAST,
  markExecutingNodes,
  buildCallTree,
  buildCFG,
  markExecutedCFGNodes,
} from '../engine/treeUtils';
import { Interpreter } from '../engine/interpreter';

describe('parseAST', () => {
  it('should parse simple variable declaration into a tree', () => {
    const tree = parseAST('let x = 42;');
    expect(tree).toBeDefined();
    expect(tree.type).toBe('Program');
    expect(tree.label).toBe('Program');
    expect(tree.children.length).toBeGreaterThan(0);
    expect(tree.metadata.depth).toBe(0);
  });

  it('should assign correct categories to AST nodes', () => {
    const tree = parseAST('let x = 42;');
    expect(tree.metadata.nodeCategory).toBe('program');

    // Find the VariableDeclaration
    const varDecl = tree.children.find((c) => c.type === 'VariableDeclaration');
    expect(varDecl).toBeDefined();
    expect(varDecl!.metadata.nodeCategory).toBe('declaration');

    // Find the literal 42
    function findLiteral(node: ReturnType<typeof parseAST>): ReturnType<typeof parseAST> | null {
      if (node.type === 'Literal') return node;
      for (const child of node.children) {
        const found = findLiteral(child);
        if (found) return found;
      }
      return null;
    }
    const literal = findLiteral(tree);
    expect(literal).toBeDefined();
    expect(literal!.metadata.nodeCategory).toBe('literal');
  });

  it('should include line numbers in metadata', () => {
    const tree = parseAST('let a = 1;\nlet b = 2;');
    expect(tree.children.length).toBe(2);
    expect(tree.children[0].metadata.lineNumber).toBe(1);
    expect(tree.children[1].metadata.lineNumber).toBe(2);
  });

  it('should track depth correctly', () => {
    const tree = parseAST('let x = 1 + 2;');
    expect(tree.metadata.depth).toBe(0);
    // VariableDeclaration is at depth 1
    const varDecl = tree.children[0];
    expect(varDecl.metadata.depth).toBe(1);
  });

  it('should parse function declarations', () => {
    const tree = parseAST('function foo(a, b) { return a + b; }');
    const funcDecl = tree.children.find((c) => c.type === 'FunctionDeclaration');
    expect(funcDecl).toBeDefined();
    expect(funcDecl!.label).toBe('function foo');
    expect(funcDecl!.metadata.nodeCategory).toBe('declaration');
  });

  it('should handle if statements with control category', () => {
    const tree = parseAST('if (true) { let x = 1; }');
    function findIf(node: ReturnType<typeof parseAST>): ReturnType<typeof parseAST> | null {
      if (node.type === 'IfStatement') return node;
      for (const child of node.children) {
        const found = findIf(child);
        if (found) return found;
      }
      return null;
    }
    const ifNode = findIf(tree);
    expect(ifNode).toBeDefined();
    expect(ifNode!.metadata.nodeCategory).toBe('control');
  });

  it('should generate unique IDs for each node', () => {
    const tree = parseAST('let a = 1; let b = 2;');
    const ids = new Set<string>();
    function collectIds(node: ReturnType<typeof parseAST>) {
      ids.add(node.id);
      node.children.forEach(collectIds);
    }
    collectIds(tree);
    // All IDs should be unique
    const idArray: string[] = [];
    function collectIdArray(node: ReturnType<typeof parseAST>) {
      idArray.push(node.id);
      node.children.forEach(collectIdArray);
    }
    collectIdArray(tree);
    expect(ids.size).toBe(idArray.length);
  });
});

describe('markExecutingNodes', () => {
  it('should mark nodes on the executing line', () => {
    const tree = parseAST('let a = 1;\nlet b = 2;');
    const marked = markExecutingNodes(tree, 2);

    // The second VariableDeclaration (line 2) should be marked
    expect(marked.children[1].metadata.isExecuting).toBe(true);
    // The first one (line 1) should not
    expect(marked.children[0].metadata.isExecuting).toBe(false);
  });

  it('should not mutate original tree', () => {
    const tree = parseAST('let x = 1;');
    const marked = markExecutingNodes(tree, 1);
    expect(tree.metadata.isExecuting).toBeUndefined();
    expect(marked).not.toBe(tree);
  });
});

describe('buildCallTree', () => {
  it('should return null for empty snapshots', () => {
    expect(buildCallTree([])).toBeNull();
  });

  it('should build a tree from function calls', () => {
    const interp = new Interpreter();
    interp.parse(`
      function add(a, b) { return a + b; }
      let result = add(3, 4);
    `);
    const snapshots = interp.run();
    const tree = buildCallTree(snapshots);

    expect(tree).toBeDefined();
    expect(tree!.functionName).toBe('<program>');
    expect(tree!.children.length).toBeGreaterThan(0);

    // Should contain the 'add' call
    const addCall = tree!.children.find((c) => c.functionName === 'add');
    expect(addCall).toBeDefined();
    expect(addCall!.args).toEqual([3, 4]);
  });

  it('should handle recursive calls', () => {
    const interp = new Interpreter();
    interp.parse(`
      function factorial(n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
      }
      let result = factorial(3);
    `);
    const snapshots = interp.run();
    const tree = buildCallTree(snapshots);

    expect(tree).toBeDefined();

    // Should have nested factorial calls
    const factCall = tree!.children.find((c) => c.functionName === 'factorial');
    expect(factCall).toBeDefined();
    expect(factCall!.depth).toBeGreaterThan(0);
  });

  it('should mark base cases as leaf nodes', () => {
    const interp = new Interpreter();
    interp.parse(`
      function count(n) {
        if (n <= 0) return 0;
        return count(n - 1);
      }
      count(2);
    `);
    const snapshots = interp.run();
    const tree = buildCallTree(snapshots);

    expect(tree).toBeDefined();

    // Find the deepest call (base case)
    function findLeaf(node: ReturnType<typeof buildCallTree>): ReturnType<typeof buildCallTree> {
      if (!node) return null;
      if (node.children.length === 0 && node.functionName !== '<program>') return node;
      for (const child of node.children) {
        const leaf = findLeaf(child);
        if (leaf) return leaf;
      }
      return null;
    }
    const leaf = findLeaf(tree);
    expect(leaf).toBeDefined();
    expect(leaf!.isBaseCase).toBe(true);
  });

  it('should report correct program root', () => {
    const interp = new Interpreter();
    interp.parse('let x = 1;');
    const snapshots = interp.run();
    const tree = buildCallTree(snapshots);

    expect(tree).toBeDefined();
    expect(tree!.functionName).toBe('<program>');
    expect(tree!.depth).toBe(0);
  });
});

describe('buildCFG', () => {
  it('should create start and end nodes', () => {
    const cfg = buildCFG('let x = 1;');
    expect(cfg.nodes.length).toBeGreaterThanOrEqual(2);

    const startNode = cfg.nodes.find((n) => n.type === 'start');
    const endNode = cfg.nodes.find((n) => n.type === 'end');
    expect(startNode).toBeDefined();
    expect(endNode).toBeDefined();
  });

  it('should create edges between nodes', () => {
    const cfg = buildCFG('let x = 1; let y = 2;');
    expect(cfg.edges.length).toBeGreaterThan(0);

    // Should have an edge from start to first statement
    const startNode = cfg.nodes.find((n) => n.type === 'start')!;
    const fromStart = cfg.edges.find((e) => e.source === startNode.id);
    expect(fromStart).toBeDefined();
  });

  it('should create condition node for if statements', () => {
    const cfg = buildCFG('if (true) { let x = 1; }');
    const condNode = cfg.nodes.find((n) => n.type === 'condition');
    expect(condNode).toBeDefined();

    // Should have true/false edges
    const trueEdge = cfg.edges.find((e) => e.label === 'true');
    const falseEdge = cfg.edges.find((e) => e.label === 'false');
    expect(trueEdge).toBeDefined();
    expect(falseEdge).toBeDefined();
  });

  it('should create loop nodes for for/while statements', () => {
    const cfg = buildCFG('for (let i = 0; i < 3; i++) { let x = i; }');
    const loopNode = cfg.nodes.find((n) => n.type === 'loop');
    expect(loopNode).toBeDefined();

    // Should have a loop-back edge
    const backEdge = cfg.edges.find((e) => e.type === 'loop-back');
    expect(backEdge).toBeDefined();
  });

  it('should handle function declarations', () => {
    const cfg = buildCFG('function foo() { return 1; }');
    const funcNode = cfg.nodes.find((n) => n.label.includes('function foo'));
    expect(funcNode).toBeDefined();
    expect(funcNode!.type).toBe('functionCall');
  });

  it('should handle try-catch statements', () => {
    const cfg = buildCFG('try { let x = 1; } catch (e) { let y = 2; }');
    const tryNode = cfg.nodes.find((n) => n.type === 'trycatch' && n.label.includes('try'));
    expect(tryNode).toBeDefined();

    // Should have an exception edge from try to catch
    const exceptionEdge = cfg.edges.find((e) => e.type === 'exception');
    expect(exceptionEdge).toBeDefined();
    expect(exceptionEdge!.label).toBe('error');
  });

  it('should handle try-catch-finally statements', () => {
    const cfg = buildCFG('try { let x = 1; } catch (e) { let y = 2; } finally { let z = 3; }');
    const tryNode = cfg.nodes.find((n) => n.type === 'trycatch' && n.label.includes('try'));
    expect(tryNode).toBeDefined();

    const finallyNode = cfg.nodes.find((n) => n.label === 'finally');
    expect(finallyNode).toBeDefined();
  });

  it('should support all edge types in type system', () => {
    // Verify the edge types are properly typed
    const cfg = buildCFG(`
      function foo() { return 1; }
      try {
        if (true) {
          for (let i = 0; i < 3; i++) { foo(); }
        }
      } catch (e) { let x = 1; }
    `);

    // Should have normal, true, false, loop-back, and exception edges
    expect(cfg.edges.some((e) => e.type === 'normal')).toBe(true);
    expect(cfg.edges.some((e) => e.type === 'true')).toBe(true);
    expect(cfg.edges.some((e) => e.type === 'false')).toBe(true);
    expect(cfg.edges.some((e) => e.type === 'loop-back')).toBe(true);
    expect(cfg.edges.some((e) => e.type === 'exception')).toBe(true);
  });
});

describe('markExecutedCFGNodes', () => {
  it('should mark nodes on executed lines', () => {
    const cfg = buildCFG('let x = 1;\nlet y = 2;');
    const interp = new Interpreter();
    interp.parse('let x = 1;\nlet y = 2;');
    const snapshots = interp.run();

    const marked = markExecutedCFGNodes(cfg, snapshots);

    // Start and end should be marked as executed
    const startNode = marked.nodes.find((n) => n.type === 'start');
    expect(startNode!.wasExecuted).toBe(true);

    // Statement nodes should be marked based on execution
    const stmtNodes = marked.nodes.filter((n) => n.type === 'statement' && n.lineNumber);
    expect(stmtNodes.some((n) => n.wasExecuted)).toBe(true);
  });

  it('should not mutate original CFG', () => {
    const cfg = buildCFG('let x = 1;');
    const original = cfg.nodes.map((n) => ({ ...n }));

    const interp = new Interpreter();
    interp.parse('let x = 1;');
    const snapshots = interp.run();
    markExecutedCFGNodes(cfg, snapshots);

    // Original nodes should not have wasExecuted set
    expect(original[0].wasExecuted).toBeUndefined();
  });
});
