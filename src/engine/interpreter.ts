/**
 * JavaScript interpreter built on Acorn AST parser.
 * Executes code step-by-step and emits execution state snapshots.
 */
import * as acorn from 'acorn';
import type { Node } from 'acorn';
import type {
  ExecutionState,
  StackFrame,
  Variable,
  ConsoleOutput,
  ErrorInfo,
} from './types';

// ─── AST Node type helpers ────────────────────────────────────────────────────
interface ASTNode extends Node {
  [key: string]: unknown;
}

// ─── Environment (scope chain) ───────────────────────────────────────────────
class Environment {
  private values = new Map<string, unknown>();
  parent: Environment | null;
  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  define(name: string, value: unknown): void {
    this.values.set(name, value);
  }

  get(name: string): unknown {
    if (this.values.has(name)) return this.values.get(name);
    if (this.parent) return this.parent.get(name);
    throw new ReferenceError(`${name} is not defined`);
  }

  set(name: string, value: unknown): void {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new ReferenceError(`${name} is not defined`);
  }

  has(name: string): boolean {
    if (this.values.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  /** Collect all variables in this scope */
  getVariables(scope: Variable['scope']): Map<string, Variable> {
    const vars = new Map<string, Variable>();
    for (const [name, value] of this.values) {
      vars.set(name, {
        name,
        value,
        type: getTypeString(value),
        isNew: false,
        scope,
      });
    }
    return vars;
  }

  entries(): Map<string, unknown> {
    return new Map(this.values);
  }
}

function getTypeString(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// ─── Signal classes for control flow ─────────────────────────────────────────
class ReturnSignal {
  value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}
class BreakSignal {}
class ContinueSignal {}

// ─── Interpreter ─────────────────────────────────────────────────────────────
export class Interpreter {
  private ast: ASTNode | null = null;
  private globalEnv = new Environment();
  private callStack: StackFrame[] = [];
  private output: ConsoleOutput[] = [];
  private errorState: ErrorInfo | null = null;
  private stepCount = 0;
  private currentLine = 0;
  private currentColumn = 0;
  private snapshots: ExecutionState[] = [];
  private changedVars = new Set<string>();
  private maxSteps = 50000;

  /** Parse source code into AST */
  parse(source: string): void {
    this.ast = acorn.parse(source, {
      ecmaVersion: 2022,
      sourceType: 'module',
      locations: true,
    }) as unknown as ASTNode;
    this.reset();
  }

  /** Reset interpreter state */
  reset(): void {
    this.globalEnv = new Environment();
    this.callStack = [];
    this.output = [];
    this.errorState = null;
    this.stepCount = 0;
    this.currentLine = 0;
    this.currentColumn = 0;
    this.snapshots = [];
    this.changedVars = new Set();

    // Provide console.log
    const outputRef = this.output;
    const consoleMethods: Record<string, unknown> = {};
    for (const method of ['log', 'warn', 'error', 'info'] as const) {
      consoleMethods[method] = (...args: unknown[]) => {
        outputRef.push({ type: method, args, timestamp: Date.now() });
      };
    }
    this.globalEnv.define('console', consoleMethods);

    // Built-in functions
    this.globalEnv.define('Math', Math);
    this.globalEnv.define('parseInt', parseInt);
    this.globalEnv.define('parseFloat', parseFloat);
    this.globalEnv.define('isNaN', isNaN);
    this.globalEnv.define('isFinite', isFinite);
    this.globalEnv.define('undefined', undefined);
    this.globalEnv.define('NaN', NaN);
    this.globalEnv.define('Infinity', Infinity);
    this.globalEnv.define('Array', Array);
    this.globalEnv.define('Object', Object);
    this.globalEnv.define('String', String);
    this.globalEnv.define('Number', Number);
    this.globalEnv.define('Boolean', Boolean);
    this.globalEnv.define('JSON', JSON);
  }

  /** Execute the entire program, capturing snapshots at each step */
  run(): ExecutionState[] {
    if (!this.ast) throw new Error('No code parsed');
    this.snapshots = [];
    this.captureSnapshot();
    try {
      this.execNode(this.ast, this.globalEnv);
    } catch (e) {
      if (e instanceof Error) {
        this.errorState = {
          message: e.message,
          line: this.currentLine,
          column: this.currentColumn,
          stack: e.stack,
        };
      }
      this.captureSnapshot();
    }
    return this.snapshots;
  }

  /** Get all snapshots */
  getSnapshots(): ExecutionState[] {
    return this.snapshots;
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  private captureSnapshot(): void {
    const globalVars = this.globalEnv.getVariables('global');

    // Mark changed variables
    for (const name of this.changedVars) {
      const v = globalVars.get(name);
      if (v) v.isNew = true;
      for (const frame of this.callStack) {
        const lv = frame.localVariables.get(name);
        if (lv) lv.isNew = true;
      }
    }

    const snapshot: ExecutionState = {
      step: this.stepCount,
      currentLine: this.currentLine,
      currentColumn: this.currentColumn,
      callStack: this.callStack.map((f) => ({
        ...f,
        localVariables: new Map(f.localVariables),
        arguments: [...f.arguments],
      })),
      output: [...this.output],
      errorState: this.errorState ? { ...this.errorState } : null,
      globalVariables: new Map(globalVars),
    };

    this.snapshots.push(snapshot);
    this.changedVars.clear();
    this.stepCount++;
  }

  private updateLocation(node: ASTNode): void {
    const loc = node.loc as { start: { line: number; column: number } } | undefined;
    if (loc) {
      this.currentLine = loc.start.line;
      this.currentColumn = loc.start.column;
    }
  }

  // ─── Node execution ───────────────────────────────────────────────────────

  private execNode(node: ASTNode, env: Environment): unknown {
    if (this.stepCount > this.maxSteps) {
      throw new Error('Maximum execution steps exceeded (possible infinite loop)');
    }

    this.updateLocation(node);

    switch (node.type) {
      case 'Program':
        return this.execProgram(node, env);
      case 'VariableDeclaration':
        return this.execVariableDeclaration(node, env);
      case 'VariableDeclarator':
        return this.execVariableDeclarator(node, env);
      case 'ExpressionStatement':
        return this.execExpressionStatement(node, env);
      case 'CallExpression':
        return this.execCallExpression(node, env);
      case 'MemberExpression':
        return this.execMemberExpression(node, env);
      case 'Identifier':
        return env.get((node as ASTNode & { name: string }).name);
      case 'Literal':
        return (node as ASTNode & { value: unknown }).value;
      case 'TemplateLiteral':
        return this.execTemplateLiteral(node, env);
      case 'BinaryExpression':
        return this.execBinaryExpression(node, env);
      case 'LogicalExpression':
        return this.execLogicalExpression(node, env);
      case 'UnaryExpression':
        return this.execUnaryExpression(node, env);
      case 'UpdateExpression':
        return this.execUpdateExpression(node, env);
      case 'AssignmentExpression':
        return this.execAssignmentExpression(node, env);
      case 'FunctionDeclaration':
        return this.execFunctionDeclaration(node, env);
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return this.execFunctionExpression(node, env);
      case 'ReturnStatement':
        return this.execReturnStatement(node, env);
      case 'BlockStatement':
        return this.execBlockStatement(node, env);
      case 'IfStatement':
        return this.execIfStatement(node, env);
      case 'WhileStatement':
        return this.execWhileStatement(node, env);
      case 'ForStatement':
        return this.execForStatement(node, env);
      case 'BreakStatement':
        return new BreakSignal();
      case 'ContinueStatement':
        return new ContinueSignal();
      case 'ArrayExpression':
        return this.execArrayExpression(node, env);
      case 'ObjectExpression':
        return this.execObjectExpression(node, env);
      case 'ConditionalExpression':
        return this.execConditionalExpression(node, env);
      case 'ThrowStatement':
        return this.execThrowStatement(node, env);
      case 'TryStatement':
        return this.execTryStatement(node, env);
      case 'SwitchStatement':
        return this.execSwitchStatement(node, env);
      case 'EmptyStatement':
        return undefined;
      case 'SpreadElement':
        return this.execNode((node as ASTNode).argument as ASTNode, env);
      case 'NewExpression':
        return this.execNewExpression(node, env);
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  // ─── Individual node handlers ──────────────────────────────────────────────

  private execProgram(node: ASTNode, env: Environment): unknown {
    const body = (node as ASTNode & { body: ASTNode[] }).body;
    let result: unknown;
    for (const stmt of body) {
      result = this.execNode(stmt, env);
      if (result instanceof ReturnSignal) return result;
    }
    return result;
  }

  private execVariableDeclaration(node: ASTNode, env: Environment): void {
    const declarations = (node as ASTNode & { declarations: ASTNode[] }).declarations;
    for (const decl of declarations) {
      this.execVariableDeclarator(decl, env);
    }
    this.captureSnapshot();
  }

  private execVariableDeclarator(node: ASTNode, env: Environment): void {
    const id = (node as ASTNode & { id: ASTNode }).id;
    const init = (node as ASTNode & { init: ASTNode | null }).init;
    const name = (id as ASTNode & { name: string }).name;
    const value = init ? this.execNode(init, env) : undefined;
    env.define(name, value);
    this.changedVars.add(name);
  }

  private execExpressionStatement(node: ASTNode, env: Environment): unknown {
    const expr = (node as ASTNode & { expression: ASTNode }).expression;
    const result = this.execNode(expr, env);
    this.captureSnapshot();
    return result;
  }

  private execCallExpression(node: ASTNode, env: Environment): unknown {
    const callee = (node as ASTNode & { callee: ASTNode }).callee;
    const args = (node as ASTNode & { arguments: ASTNode[] }).arguments;

    let func: unknown;
    let thisVal: unknown = undefined;

    if (callee.type === 'MemberExpression') {
      const obj = this.execNode((callee as ASTNode & { object: ASTNode }).object, env) as Record<string, unknown>;
      const prop = this.getMemberProperty(callee, env);
      func = obj[prop as string];
      thisVal = obj;
    } else {
      func = this.execNode(callee, env);
    }

    const evaluatedArgs = args.map((a) => this.execNode(a, env));

    if (typeof func !== 'function') {
      throw new TypeError(`${this.nodeToString(callee)} is not a function`);
    }

    // Interpreter-defined functions (closures)
    if ((func as { _isInterpreterFunc?: boolean })._isInterpreterFunc) {
      return (func as (...a: unknown[]) => unknown)(...evaluatedArgs);
    }

    // Native functions
    return (func as (...a: unknown[]) => unknown).apply(thisVal, evaluatedArgs);
  }

  private execMemberExpression(node: ASTNode, env: Environment): unknown {
    const obj = this.execNode((node as ASTNode & { object: ASTNode }).object, env) as Record<string, unknown>;
    const prop = this.getMemberProperty(node, env);

    if (obj === null || obj === undefined) {
      throw new TypeError(`Cannot read properties of ${obj} (reading '${String(prop)}')`);
    }

    const val = (obj as Record<string | number, unknown>)[prop as string | number];
    if (typeof val === 'function') {
      return val.bind(obj);
    }
    return val;
  }

  private getMemberProperty(node: ASTNode, env: Environment): unknown {
    const computed = (node as ASTNode & { computed: boolean }).computed;
    const property = (node as ASTNode & { property: ASTNode }).property;
    if (computed) {
      return this.execNode(property, env);
    }
    return (property as ASTNode & { name: string }).name;
  }

  private execTemplateLiteral(node: ASTNode, env: Environment): string {
    const quasis = (node as ASTNode & { quasis: ASTNode[] }).quasis;
    const expressions = (node as ASTNode & { expressions: ASTNode[] }).expressions;
    let result = '';
    for (let i = 0; i < quasis.length; i++) {
      result += ((quasis[i] as ASTNode & { value: { cooked: string } }).value).cooked;
      if (i < expressions.length) {
        result += String(this.execNode(expressions[i], env));
      }
    }
    return result;
  }

  private execBinaryExpression(node: ASTNode, env: Environment): unknown {
    const left = this.execNode((node as ASTNode & { left: ASTNode }).left, env);
    const right = this.execNode((node as ASTNode & { right: ASTNode }).right, env);
    const op = (node as ASTNode & { operator: string }).operator;
    switch (op) {
      case '+': return (left as number) + (right as number);
      case '-': return (left as number) - (right as number);
      case '*': return (left as number) * (right as number);
      case '/': return (left as number) / (right as number);
      case '%': return (left as number) % (right as number);
      case '**': return (left as number) ** (right as number);
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '<': return (left as number) < (right as number);
      case '>': return (left as number) > (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>=': return (left as number) >= (right as number);
      case '&': return (left as number) & (right as number);
      case '|': return (left as number) | (right as number);
      case '^': return (left as number) ^ (right as number);
      case '<<': return (left as number) << (right as number);
      case '>>': return (left as number) >> (right as number);
      case '>>>': return (left as number) >>> (right as number);
      case 'instanceof': return left instanceof (right as new (...a: unknown[]) => unknown);
      case 'in': return (left as string) in (right as Record<string, unknown>);
      default: throw new Error(`Unsupported binary operator: ${op}`);
    }
  }

  private execLogicalExpression(node: ASTNode, env: Environment): unknown {
    const left = this.execNode((node as ASTNode & { left: ASTNode }).left, env);
    const op = (node as ASTNode & { operator: string }).operator;
    switch (op) {
      case '&&': return left ? this.execNode((node as ASTNode & { right: ASTNode }).right, env) : left;
      case '||': return left ? left : this.execNode((node as ASTNode & { right: ASTNode }).right, env);
      case '??': return left != null ? left : this.execNode((node as ASTNode & { right: ASTNode }).right, env);
      default: throw new Error(`Unsupported logical operator: ${op}`);
    }
  }

  private execUnaryExpression(node: ASTNode, env: Environment): unknown {
    const arg = this.execNode((node as ASTNode & { argument: ASTNode }).argument, env);
    const op = (node as ASTNode & { operator: string }).operator;
    switch (op) {
      case '-': return -(arg as number);
      case '+': return +(arg as number);
      case '!': return !arg;
      case '~': return ~(arg as number);
      case 'typeof': return typeof arg;
      case 'void': return undefined;
      default: throw new Error(`Unsupported unary operator: ${op}`);
    }
  }

  private execUpdateExpression(node: ASTNode, env: Environment): unknown {
    const arg = (node as ASTNode & { argument: ASTNode }).argument;
    const op = (node as ASTNode & { operator: string }).operator;
    const prefix = (node as ASTNode & { prefix: boolean }).prefix;
    const name = (arg as ASTNode & { name: string }).name;
    const current = env.get(name) as number;

    const updated = op === '++' ? current + 1 : current - 1;
    env.set(name, updated);
    this.changedVars.add(name);
    this.captureSnapshot();
    return prefix ? updated : current;
  }

  private execAssignmentExpression(node: ASTNode, env: Environment): unknown {
    const left = (node as ASTNode & { left: ASTNode }).left;
    const right = this.execNode((node as ASTNode & { right: ASTNode }).right, env);
    const op = (node as ASTNode & { operator: string }).operator;

    if (left.type === 'Identifier') {
      const name = (left as ASTNode & { name: string }).name;
      let current: unknown;
      if (op !== '=') {
        current = env.get(name);
      }
      const value = this.applyAssignOp(op, current, right);
      env.set(name, value);
      this.changedVars.add(name);
      return value;
    }

    if (left.type === 'MemberExpression') {
      const obj = this.execNode((left as ASTNode & { object: ASTNode }).object, env) as Record<string, unknown>;
      const prop = this.getMemberProperty(left, env) as string;
      let current: unknown;
      if (op !== '=') {
        current = obj[prop];
      }
      const value = this.applyAssignOp(op, current, right);
      obj[prop] = value;
      return value;
    }

    throw new Error(`Invalid assignment target: ${left.type}`);
  }

  private applyAssignOp(op: string, current: unknown, right: unknown): unknown {
    switch (op) {
      case '=': return right;
      case '+=': return (current as number) + (right as number);
      case '-=': return (current as number) - (right as number);
      case '*=': return (current as number) * (right as number);
      case '/=': return (current as number) / (right as number);
      case '%=': return (current as number) % (right as number);
      default: throw new Error(`Unsupported assignment operator: ${op}`);
    }
  }

  private execFunctionDeclaration(node: ASTNode, env: Environment): void {
    const id = (node as ASTNode & { id: ASTNode }).id;
    const name = (id as ASTNode & { name: string }).name;
    const func = this.createFunction(node, env, name);
    env.define(name, func);
    this.changedVars.add(name);
    this.captureSnapshot();
  }

  private execFunctionExpression(node: ASTNode, env: Environment): (...args: unknown[]) => unknown {
    const id = (node as ASTNode & { id: ASTNode | null }).id;
    const name = id ? (id as ASTNode & { name: string }).name : '<anonymous>';
    return this.createFunction(node, env, name);
  }

  private createFunction(
    node: ASTNode,
    closureEnv: Environment,
    name: string,
  ): (...args: unknown[]) => unknown {
    const params = (node as ASTNode & { params: ASTNode[] }).params;
    const body = (node as ASTNode & { body: ASTNode }).body;

    const fn = (...args: unknown[]): unknown => {
      const fnEnv = new Environment(closureEnv);
      const argVars: Variable[] = [];

      for (let i = 0; i < params.length; i++) {
        const paramName = (params[i] as ASTNode & { name: string }).name;
        fnEnv.define(paramName, args[i]);
        argVars.push({
          name: paramName,
          value: args[i],
          type: getTypeString(args[i]),
          isNew: true,
          scope: 'local',
        });
      }

      const loc = node.loc as { start: { line: number; column: number } } | undefined;
      const frame: StackFrame = {
        functionName: name,
        arguments: argVars,
        localVariables: fnEnv.getVariables('local'),
        sourceLocation: loc
          ? { line: loc.start.line, column: loc.start.column }
          : { line: 0, column: 0 },
      };

      this.callStack.push(frame);
      this.captureSnapshot();

      try {
        const result = this.execNode(body, fnEnv);
        if (result instanceof ReturnSignal) {
          frame.returnValue = result.value;
          frame.localVariables = fnEnv.getVariables('local');
          this.captureSnapshot();
          return result.value;
        }
        frame.localVariables = fnEnv.getVariables('local');
        // Arrow functions with expression bodies return the expression value
        if (body.type !== 'BlockStatement') {
          frame.returnValue = result;
          this.captureSnapshot();
          return result;
        }
        return undefined;
      } finally {
        this.callStack.pop();
      }
    };

    (fn as unknown as { _isInterpreterFunc: boolean })._isInterpreterFunc = true;
    return fn;
  }

  private execReturnStatement(node: ASTNode, env: Environment): ReturnSignal {
    const arg = (node as ASTNode & { argument: ASTNode | null }).argument;
    const value = arg ? this.execNode(arg, env) : undefined;
    return new ReturnSignal(value);
  }

  private execBlockStatement(node: ASTNode, env: Environment): unknown {
    const body = (node as ASTNode & { body: ASTNode[] }).body;
    const blockEnv = new Environment(env);
    let result: unknown;
    for (const stmt of body) {
      result = this.execNode(stmt, blockEnv);
      if (
        result instanceof ReturnSignal ||
        result instanceof BreakSignal ||
        result instanceof ContinueSignal
      ) {
        return result;
      }
    }
    return result;
  }

  private execIfStatement(node: ASTNode, env: Environment): unknown {
    const test = this.execNode((node as ASTNode & { test: ASTNode }).test, env);
    this.captureSnapshot();
    if (test) {
      return this.execNode((node as ASTNode & { consequent: ASTNode }).consequent, env);
    }
    const alt = (node as ASTNode & { alternate: ASTNode | null }).alternate;
    if (alt) {
      return this.execNode(alt, env);
    }
    return undefined;
  }

  private execWhileStatement(node: ASTNode, env: Environment): unknown {
    while (true) {
      const test = this.execNode((node as ASTNode & { test: ASTNode }).test, env);
      this.captureSnapshot();
      if (!test) break;
      const result = this.execNode((node as ASTNode & { body: ASTNode }).body, env);
      if (result instanceof BreakSignal) break;
      if (result instanceof ReturnSignal) return result;
    }
    return undefined;
  }

  private execForStatement(node: ASTNode, env: Environment): unknown {
    const forEnv = new Environment(env);
    const init = (node as ASTNode & { init: ASTNode | null }).init;
    if (init) this.execNode(init, forEnv);

    while (true) {
      const test = (node as ASTNode & { test: ASTNode | null }).test;
      if (test) {
        const condition = this.execNode(test, forEnv);
        this.captureSnapshot();
        if (!condition) break;
      }

      const result = this.execNode((node as ASTNode & { body: ASTNode }).body, forEnv);
      if (result instanceof BreakSignal) break;
      if (result instanceof ReturnSignal) return result;

      const update = (node as ASTNode & { update: ASTNode | null }).update;
      if (update) this.execNode(update, forEnv);
    }
    return undefined;
  }

  private execArrayExpression(node: ASTNode, env: Environment): unknown[] {
    const elements = (node as ASTNode & { elements: (ASTNode | null)[] }).elements;
    return elements.map((el) => (el ? this.execNode(el, env) : undefined));
  }

  private execObjectExpression(node: ASTNode, env: Environment): Record<string, unknown> {
    const properties = (node as ASTNode & { properties: ASTNode[] }).properties;
    const obj: Record<string, unknown> = {};
    for (const prop of properties) {
      const key = (prop as ASTNode & { key: ASTNode }).key;
      const value = (prop as ASTNode & { value: ASTNode }).value;
      const computed = (prop as ASTNode & { computed: boolean }).computed;

      let keyStr: string;
      if (computed) {
        keyStr = String(this.execNode(key, env));
      } else if (key.type === 'Identifier') {
        keyStr = (key as ASTNode & { name: string }).name;
      } else {
        keyStr = String((key as ASTNode & { value: unknown }).value);
      }

      obj[keyStr] = this.execNode(value, env);
    }
    return obj;
  }

  private execConditionalExpression(node: ASTNode, env: Environment): unknown {
    const test = this.execNode((node as ASTNode & { test: ASTNode }).test, env);
    return test
      ? this.execNode((node as ASTNode & { consequent: ASTNode }).consequent, env)
      : this.execNode((node as ASTNode & { alternate: ASTNode }).alternate, env);
  }

  private execThrowStatement(node: ASTNode, env: Environment): never {
    const arg = this.execNode((node as ASTNode & { argument: ASTNode }).argument, env);
    if (arg instanceof Error) throw arg;
    throw new Error(String(arg));
  }

  private execTryStatement(node: ASTNode, env: Environment): unknown {
    try {
      return this.execNode((node as ASTNode & { block: ASTNode }).block, env);
    } catch (e) {
      const handler = (node as ASTNode & { handler: ASTNode | null }).handler;
      if (handler) {
        const catchEnv = new Environment(env);
        const param = (handler as ASTNode & { param: ASTNode | null }).param;
        if (param) {
          catchEnv.define((param as ASTNode & { name: string }).name, e);
        }
        return this.execNode((handler as ASTNode & { body: ASTNode }).body, catchEnv);
      }
      throw e;
    } finally {
      const finalizer = (node as ASTNode & { finalizer: ASTNode | null }).finalizer;
      if (finalizer) {
        this.execNode(finalizer, env);
      }
    }
  }

  private execSwitchStatement(node: ASTNode, env: Environment): unknown {
    const discriminant = this.execNode(
      (node as ASTNode & { discriminant: ASTNode }).discriminant,
      env,
    );
    const cases = (node as ASTNode & { cases: ASTNode[] }).cases;
    let matched = false;

    for (const c of cases) {
      const testNode = (c as ASTNode & { test: ASTNode | null }).test;
      if (!matched && testNode) {
        const testVal = this.execNode(testNode, env);
        if (testVal !== discriminant) continue;
      }
      if (testNode || matched) {
        matched = true;
        const consequent = (c as ASTNode & { consequent: ASTNode[] }).consequent;
        for (const stmt of consequent) {
          const result = this.execNode(stmt, env);
          if (result instanceof BreakSignal) return undefined;
          if (result instanceof ReturnSignal) return result;
        }
      }
      if (!testNode) {
        // default case
        matched = true;
        const consequent = (c as ASTNode & { consequent: ASTNode[] }).consequent;
        for (const stmt of consequent) {
          const result = this.execNode(stmt, env);
          if (result instanceof BreakSignal) return undefined;
          if (result instanceof ReturnSignal) return result;
        }
      }
    }
    return undefined;
  }

  private execNewExpression(node: ASTNode, env: Environment): unknown {
    const callee = (node as ASTNode & { callee: ASTNode }).callee;
    const args = (node as ASTNode & { arguments: ASTNode[] }).arguments;
    const Constructor = this.execNode(callee, env) as new (...a: unknown[]) => unknown;
    const evaluatedArgs = args.map((a) => this.execNode(a, env));
    return new Constructor(...evaluatedArgs);
  }

  private nodeToString(node: ASTNode): string {
    if (node.type === 'Identifier') return (node as ASTNode & { name: string }).name;
    if (node.type === 'MemberExpression') {
      const obj = this.nodeToString((node as ASTNode & { object: ASTNode }).object);
      const prop = (node as ASTNode & { property: ASTNode }).property;
      return `${obj}.${(prop as ASTNode & { name: string }).name}`;
    }
    return '<expression>';
  }
}
