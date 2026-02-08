# ⚡ Code Visualizer

A production-grade, real-time JavaScript code execution visualizer built with React, TypeScript, and a custom AST interpreter.

## Features

- **Step-by-step execution** — Walk through code line by line, forward and backward
- **Time-travel debugging** — Jump to any previous execution state
- **Variable tracking** — See variables change in real-time with type information
- **Call stack visualization** — Track function calls, arguments, and return values
- **Console output** — View console.log/warn/error output at each step
- **Execution timeline** — Visual overview of execution with line-frequency analysis
- **Breakpoints** — Click the gutter to set line breakpoints
- **Auto-play** — Automatically step through execution with adjustable speed
- **Infinite loop detection** — Safely stops execution that exceeds step limits

## Supported JavaScript Features

- Variables (`let`, `const`, `var`)
- Functions (declarations, expressions, arrow functions)
- Control flow (`if`/`else`, `switch`, ternary)
- Loops (`for`, `while`, `break`, `continue`)
- Arrays and Objects
- Template literals
- Try/catch/finally
- Logical operators (`&&`, `||`, `??`)
- Assignment operators (`+=`, `-=`, `*=`, `/=`)
- Recursive functions
- Built-in globals (`Math`, `console`, `JSON`, etc.)

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Editor**: Monaco Editor
- **State**: Zustand
- **Parser**: Acorn (ECMAScript 2022)
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run preview` | Preview production build |

## Architecture

```
src/
├── engine/
│   ├── types.ts          # Core type definitions (ExecutionState, StackFrame, Variable)
│   └── interpreter.ts    # Acorn-based JS interpreter with state snapshots
├── store/
│   └── executionStore.ts # Zustand store for execution & time-travel state
├── components/
│   ├── CodeEditor.tsx    # Monaco Editor with breakpoints & line highlighting
│   ├── Controls.tsx      # Execution controls (run, step, pause, speed)
│   └── panels/
│       ├── VariablesPanel.tsx  # Variable/scope inspector
│       ├── CallStackPanel.tsx  # Call stack visualization
│       ├── ConsolePanel.tsx    # Console output display
│       └── TimelinePanel.tsx   # Execution timeline with time-travel
├── App.tsx               # Main layout with split panels
├── main.tsx              # Entry point
└── index.css             # Tailwind CSS imports
```
