# ⚡ Code Visualizer

A production-grade, real-time JavaScript code execution visualizer built with React, TypeScript, and a custom AST interpreter. Write JavaScript code in a Monaco-powered editor and watch it execute step-by-step with full variable tracking, call stack visualization, time-travel debugging, and more.

---

## Table of Contents

- [Features](#features)
- [Supported JavaScript Features](#supported-javascript-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Start the Development Server](#3-start-the-development-server)
- [Available Scripts](#available-scripts)
- [Building for Production](#building-for-production)
- [Running Tests](#running-tests)
- [Linting](#linting)
- [Usage Guide](#usage-guide)
- [Project Architecture](#project-architecture)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Step-by-step execution** — Walk through code line by line, forward and backward
- **Time-travel debugging** — Jump to any previous execution state
- **Variable tracking** — See variables change in real-time with type information
- **Call stack visualization** — Track function calls, arguments, and return values
- **Console output** — View `console.log` / `console.warn` / `console.error` output at each step
- **Execution timeline** — Visual overview of execution with line-frequency analysis
- **Breakpoints** — Click the editor gutter to set/remove line breakpoints
- **Auto-play** — Automatically step through execution with adjustable speed
- **Infinite loop detection** — Safely stops execution that exceeds step limits
- **7 visualization panels** — Variables, Call Stack, Console, Timeline, AST, Call Tree, and Control Flow Graph (CFG)

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

| Technology | Purpose |
|---|---|
| [React 19](https://react.dev/) | UI framework |
| [TypeScript 5.9](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Vite 7](https://vite.dev/) | Build tool & dev server |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Code editor (same editor as VS Code) |
| [Acorn](https://github.com/acornjs/acorn) | JavaScript parser (ECMAScript 2022) |
| [Zustand](https://zustand.docs.pmnd.rs/) | Lightweight state management |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS framework |
| [Vitest](https://vitest.dev/) | Unit testing framework |

---

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Node.js** — version **18.0 or higher** (recommended: latest LTS)
  - Check with: `node --version`
  - Download from: [https://nodejs.org/](https://nodejs.org/)
- **npm** — version **9.0 or higher** (comes bundled with Node.js)
  - Check with: `npm --version`
- **Git** — for cloning the repository
  - Check with: `git --version`
  - Download from: [https://git-scm.com/](https://git-scm.com/)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/aaaaaaayush-no/OPUS_TEST.git
cd OPUS_TEST
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required dependencies listed in `package.json`, including React, Vite, the Monaco Editor, Acorn parser, Zustand, and Tailwind CSS.

### 3. Start the Development Server

```bash
npm run dev
```

The Vite development server will start with hot module replacement (HMR). By default, the app will be available at:

```
http://localhost:5173
```

Open this URL in your browser to use the Code Visualizer. The page will automatically reload when you make changes to the source code.

---

## Available Scripts

All commands are run from the project root directory:

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server with hot reload |
| `npm run build` | Type-check with TypeScript, then build for production |
| `npm run preview` | Serve the production build locally for testing |
| `npm run test` | Run the unit test suite with Vitest |
| `npm run lint` | Run ESLint to check for code quality issues |

---

## Building for Production

To create an optimized production build:

```bash
npm run build
```

This command performs two steps:

1. **Type-checks** the entire project using `tsc -b` (TypeScript compiler in build mode)
2. **Bundles** the application using Vite into the `dist/` directory

The output in the `dist/` folder is a static site that can be deployed to any static hosting provider (e.g., Vercel, Netlify, GitHub Pages, or any web server).

### Preview the Production Build

After building, you can preview the production build locally:

```bash
npm run preview
```

This starts a local server serving the files from `dist/`. By default it will be available at:

```
http://localhost:4173
```

---

## Running Tests

The project uses [Vitest](https://vitest.dev/) as its test runner. Tests are located in the `src/__tests__/` directory.

### Run all tests

```bash
npm run test
```

This runs all test files matching the `*.test.ts` / `*.test.tsx` pattern.

### Test files

| File | Description |
|---|---|
| `src/__tests__/interpreter.test.ts` | Tests for the custom JavaScript interpreter (parsing, execution, variable tracking, loops, functions, error handling, etc.) |
| `src/__tests__/treeUtils.test.ts` | Tests for AST/tree utility functions |

---

## Linting

To check for code quality and style issues:

```bash
npm run lint
```

This runs ESLint across all `.ts` and `.tsx` files in the project. The ESLint configuration includes:

- TypeScript-aware linting rules via `typescript-eslint`
- React Hooks rules via `eslint-plugin-react-hooks`
- React Refresh rules via `eslint-plugin-react-refresh`

---

## Usage Guide

Once the development server is running:

1. **Write or edit code** — The left panel contains a Monaco code editor pre-loaded with sample JavaScript code. You can edit or replace it with your own code.

2. **Run the code** — Use the control bar at the top to execute the code. The interpreter will parse and run your code, capturing a snapshot of the program state at each step.

3. **Step through execution** — Use the step forward/backward buttons to move through execution one step at a time. The current line is highlighted in the editor.

4. **Set breakpoints** — Click in the editor gutter (left margin) to toggle breakpoints on specific lines. Execution will pause when a breakpoint is hit.

5. **Auto-play** — Enable auto-play to automatically step through execution. Adjust the speed slider to control how fast it advances.

6. **Explore visualization panels** — Use the tabs on the right side to switch between panels:

   | Panel | What it shows |
   |---|---|
   | **📊 Variables** | All variables in scope with their current values and types |
   | **📚 Call Stack** | The current function call stack with arguments and return values |
   | **💻 Console** | Output from `console.log()`, `console.warn()`, and `console.error()` |
   | **⏱️ Timeline** | A visual timeline of execution steps — click any step to jump to it (time-travel) |
   | **🌳 AST** | The Abstract Syntax Tree of your code |
   | **🔀 Call Tree** | A tree visualization of function calls |
   | **📐 CFG** | The Control Flow Graph of your code |

7. **Time-travel** — Click on any step in the Timeline panel to jump directly to that point in execution and inspect the program state at that moment.

---

## Project Architecture

```
OPUS_TEST/
├── index.html                 # HTML entry point — loads the React app
├── package.json               # Project metadata, dependencies, and scripts
├── tsconfig.json              # Root TypeScript configuration (references app & node configs)
├── tsconfig.app.json          # TypeScript config for the app source code
├── tsconfig.node.json         # TypeScript config for Node.js tooling (Vite config, etc.)
├── vite.config.ts             # Vite build configuration (React & Tailwind plugins)
├── vitest.config.ts           # Vitest test configuration (jsdom environment)
├── eslint.config.js           # ESLint configuration
├── public/                    # Static assets served as-is
│   └── vite.svg
└── src/                       # Application source code
    ├── main.tsx               # React entry point — mounts <App /> to the DOM
    ├── App.tsx                # Main layout — header, controls, editor, and tabbed panels
    ├── index.css              # Global CSS with Tailwind imports
    ├── engine/                # Core interpreter engine
    │   ├── types.ts           # Type definitions (ExecutionState, StackFrame, Variable, etc.)
    │   ├── interpreter.ts     # Custom JavaScript interpreter built on Acorn AST parser
    │   ├── treeTypes.ts       # Tree data structure types
    │   └── treeUtils.ts       # Tree/AST utility functions
    ├── store/                 # State management
    │   └── executionStore.ts  # Zustand store for execution state & time-travel
    ├── components/            # React UI components
    │   ├── CodeEditor.tsx     # Monaco Editor with breakpoint & line highlighting support
    │   ├── Controls.tsx       # Execution controls (run, step, pause, reset, speed)
    │   └── panels/            # Visualization panel components
    │       ├── VariablesPanel.tsx   # Variable/scope inspector
    │       ├── CallStackPanel.tsx   # Call stack visualization
    │       ├── ConsolePanel.tsx     # Console output display
    │       ├── TimelinePanel.tsx    # Execution timeline with time-travel navigation
    │       ├── ASTPanel.tsx         # Abstract Syntax Tree viewer
    │       ├── CallTreePanel.tsx    # Function call tree visualization
    │       └── CFGPanel.tsx         # Control Flow Graph visualization
    └── __tests__/             # Unit tests
        ├── interpreter.test.ts     # Interpreter engine tests
        └── treeUtils.test.ts       # Tree utility tests
```

### How It Works

1. **Parsing** — When you click "Run", your JavaScript code is parsed into an Abstract Syntax Tree (AST) using the [Acorn](https://github.com/acornjs/acorn) parser.
2. **Interpretation** — A custom tree-walking interpreter (`src/engine/interpreter.ts`) executes the AST node by node, capturing a snapshot of the full program state (variables, call stack, console output, current line) at each step.
3. **State Management** — All execution snapshots are stored in a [Zustand](https://zustand.docs.pmnd.rs/) store (`src/store/executionStore.ts`), enabling time-travel by simply switching which snapshot index is active.
4. **Visualization** — React components read from the store and render the current execution state across the seven visualization panels.

---

## Troubleshooting

### `npm install` fails

- Ensure you are using **Node.js 18+** and **npm 9+**. Run `node --version` and `npm --version` to verify.
- Delete `node_modules/` and `package-lock.json`, then run `npm install` again:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### Development server doesn't start

- Make sure port **5173** is not in use by another application. If it is, Vite will automatically try the next available port and display the URL in the terminal.
- Check the terminal output for error messages.

### Build fails with TypeScript errors

- Run `npx tsc --noEmit` to see TypeScript errors independently of the build.
- Ensure all dependencies are installed with `npm install`.

### Tests fail

- Make sure dependencies are installed: `npm install`
- Run tests with verbose output for more details: `npx vitest run --reporter=verbose`

### Monaco Editor doesn't load

- The Monaco Editor requires a modern browser (Chrome, Firefox, Edge, or Safari). Ensure you are not using an outdated browser.
- Check the browser developer console for any errors.
