import { describe, it, expect } from 'vitest';
import { Interpreter } from '../engine/interpreter';

describe('Interpreter', () => {
  it('should parse and execute a simple variable declaration', () => {
    const interp = new Interpreter();
    interp.parse('let x = 42;');
    const snapshots = interp.run();

    expect(snapshots.length).toBeGreaterThan(0);
    const lastSnap = snapshots[snapshots.length - 1];
    expect(lastSnap.globalVariables.get('x')?.value).toBe(42);
  });

  it('should handle arithmetic expressions', () => {
    const interp = new Interpreter();
    interp.parse('let a = 2 + 3; let b = a * 4;');
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('a')?.value).toBe(5);
    expect(last.globalVariables.get('b')?.value).toBe(20);
  });

  it('should execute function declarations and calls', () => {
    const interp = new Interpreter();
    interp.parse(`
      function add(a, b) {
        return a + b;
      }
      let result = add(3, 4);
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('result')?.value).toBe(7);
  });

  it('should track call stack during function execution', () => {
    const interp = new Interpreter();
    interp.parse(`
      function greet(name) {
        return "Hello, " + name;
      }
      let msg = greet("World");
    `);
    const snapshots = interp.run();

    const hasCallStack = snapshots.some((s) => s.callStack.length > 0);
    expect(hasCallStack).toBe(true);

    const greetFrame = snapshots.find((s) =>
      s.callStack.some((f) => f.functionName === 'greet'),
    );
    expect(greetFrame).toBeDefined();
  });

  it('should handle recursive functions', () => {
    const interp = new Interpreter();
    interp.parse(`
      function factorial(n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
      }
      let result = factorial(5);
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('result')?.value).toBe(120);
  });

  it('should capture console.log output', () => {
    const interp = new Interpreter();
    interp.parse('console.log("hello", 42);');
    const snapshots = interp.run();

    const lastOutput = snapshots[snapshots.length - 1].output;
    expect(lastOutput.length).toBe(1);
    expect(lastOutput[0].type).toBe('log');
    expect(lastOutput[0].args).toEqual(['hello', 42]);
  });

  it('should handle for loops', () => {
    const interp = new Interpreter();
    interp.parse(`
      let sum = 0;
      for (let i = 1; i <= 5; i++) {
        sum = sum + i;
      }
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('sum')?.value).toBe(15);
  });

  it('should handle while loops', () => {
    const interp = new Interpreter();
    interp.parse(`
      let count = 0;
      while (count < 3) {
        count = count + 1;
      }
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('count')?.value).toBe(3);
  });

  it('should handle if/else statements', () => {
    const interp = new Interpreter();
    interp.parse(`
      let x = 10;
      let result;
      if (x > 5) {
        result = "big";
      } else {
        result = "small";
      }
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('result')?.value).toBe('big');
  });

  it('should handle arrays', () => {
    const interp = new Interpreter();
    interp.parse(`
      let arr = [1, 2, 3];
      let first = arr[0];
      let len = arr.length;
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('first')?.value).toBe(1);
    expect(last.globalVariables.get('len')?.value).toBe(3);
  });

  it('should handle objects', () => {
    const interp = new Interpreter();
    interp.parse(`
      let obj = { name: "Alice", age: 30 };
      let name = obj.name;
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('name')?.value).toBe('Alice');
  });

  it('should handle errors gracefully', () => {
    const interp = new Interpreter();
    interp.parse('let x = unknownVar;');
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.errorState).not.toBeNull();
    expect(last.errorState?.message).toContain('not defined');
  });

  it('should handle try/catch', () => {
    const interp = new Interpreter();
    interp.parse(`
      let caught = false;
      try {
        throw "oops";
      } catch (e) {
        caught = true;
      }
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('caught')?.value).toBe(true);
  });

  it('should support arrow functions', () => {
    const interp = new Interpreter();
    interp.parse(`
      let double = (x) => x * 2;
      let result = double(21);
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('result')?.value).toBe(42);
  });

  it('should support template literals', () => {
    const interp = new Interpreter();
    interp.parse('let name = "World"; let msg = `Hello, ${name}!`;');
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('msg')?.value).toBe('Hello, World!');
  });

  it('should detect infinite loops and stop execution', () => {
    const interp = new Interpreter();
    interp.parse('while (true) {}');
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.errorState).not.toBeNull();
    expect(last.errorState?.message).toContain('Maximum execution steps');
  });

  it('should track step numbers correctly', () => {
    const interp = new Interpreter();
    interp.parse('let a = 1; let b = 2; let c = 3;');
    const snapshots = interp.run();

    for (let i = 0; i < snapshots.length; i++) {
      expect(snapshots[i].step).toBe(i);
    }
  });

  it('should handle switch statements', () => {
    const interp = new Interpreter();
    interp.parse(`
      let x = 2;
      let result;
      switch (x) {
        case 1:
          result = "one";
          break;
        case 2:
          result = "two";
          break;
        default:
          result = "other";
          break;
      }
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('result')?.value).toBe('two');
  });

  it('should handle assignment operators', () => {
    const interp = new Interpreter();
    interp.parse(`
      let x = 10;
      x += 5;
      x -= 3;
      x *= 2;
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('x')?.value).toBe(24);
  });

  it('should handle logical operators', () => {
    const interp = new Interpreter();
    interp.parse(`
      let a = true && false;
      let b = true || false;
      let c = null ?? "default";
    `);
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('a')?.value).toBe(false);
    expect(last.globalVariables.get('b')?.value).toBe(true);
    expect(last.globalVariables.get('c')?.value).toBe('default');
  });

  it('should handle ternary operator', () => {
    const interp = new Interpreter();
    interp.parse('let x = true ? "yes" : "no";');
    const snapshots = interp.run();

    const last = snapshots[snapshots.length - 1];
    expect(last.globalVariables.get('x')?.value).toBe('yes');
  });
});
