/**
 * Call Tree Panel – visualizes the function call hierarchy
 * built from execution snapshots. Shows recursive call patterns,
 * base cases, and duplicate subtrees.
 */
import { useState, useMemo } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { buildCallTree } from '../../engine/treeUtils';
import type { CallTreeNode } from '../../engine/treeTypes';

// ─── Value formatter ────────────────────────────────────────────────────────
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'function') return 'ƒ()';
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{${entries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ')}}`;
  }
  return String(value);
}

// ─── Depth color gradient ───────────────────────────────────────────────────
const DEPTH_COLORS = [
  'border-blue-500/50',
  'border-green-500/50',
  'border-purple-500/50',
  'border-orange-500/50',
  'border-cyan-500/50',
  'border-pink-500/50',
  'border-yellow-500/50',
  'border-red-500/50',
];

const DEPTH_BG = [
  'bg-blue-500/5',
  'bg-green-500/5',
  'bg-purple-500/5',
  'bg-orange-500/5',
  'bg-cyan-500/5',
  'bg-pink-500/5',
  'bg-yellow-500/5',
  'bg-red-500/5',
];

// ─── Call Tree Node component ───────────────────────────────────────────────
interface CallNodeProps {
  node: CallTreeNode;
  showDuplicates: boolean;
  currentStep: number;
}

function CallNodeView({ node, showDuplicates, currentStep }: CallNodeProps) {
  const [expanded, setExpanded] = useState(node.depth < 3);
  const hasChildren = node.children.length > 0;
  const depthColor = DEPTH_COLORS[node.depth % DEPTH_COLORS.length];
  const depthBg = DEPTH_BG[node.depth % DEPTH_BG.length];

  // Filter duplicates if toggled off
  const visibleChildren = showDuplicates
    ? node.children
    : deduplicateChildren(node.children);

  const hiddenCount = node.children.length - visibleChildren.length;

  return (
    <div className={`ml-3 ${node.depth > 0 ? `border-l ${depthColor}` : ''}`}>
      <div
        className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded cursor-pointer transition-all text-xs
          ${depthBg}
          ${node.callIndex === currentStep ? 'ring-1 ring-yellow-400/50' : ''}
          hover:bg-gray-700/50
        `}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <span className={`text-gray-500 w-3 text-center transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        ) : (
          <span className="w-3" />
        )}

        {/* Function icon */}
        <span className="text-[10px]">
          {node.isBaseCase ? '🟢' : node.isDuplicate ? '🔄' : '📎'}
        </span>

        {/* Function name */}
        <span className={`font-mono font-medium ${
          node.isBaseCase ? 'text-green-300' :
          node.isDuplicate ? 'text-gray-400' :
          'text-blue-300'
        }`}>
          {node.functionName}
        </span>

        {/* Arguments */}
        {node.args.length > 0 && (
          <span className="text-gray-400 font-mono">
            ({node.args.map(formatValue).join(', ')})
          </span>
        )}

        {/* Return value */}
        {node.returnValue !== undefined && (
          <span className="text-yellow-300 font-mono ml-1">
            → {formatValue(node.returnValue)}
          </span>
        )}

        {/* Depth badge */}
        <span className="text-gray-600 text-[10px] ml-auto">
          d={node.depth}
        </span>

        {/* Call index */}
        <span className="text-gray-600 text-[10px]">
          #{node.callIndex}
        </span>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {visibleChildren.map((child) => (
            <CallNodeView
              key={child.id}
              node={child}
              showDuplicates={showDuplicates}
              currentStep={currentStep}
            />
          ))}
          {hiddenCount > 0 && (
            <div className="ml-6 text-[10px] text-gray-500 py-0.5">
              +{hiddenCount} duplicate subtree(s) hidden
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function deduplicateChildren(children: CallTreeNode[]): CallTreeNode[] {
  const seen = new Set<string>();
  return children.filter((child) => {
    const key = `${child.functionName}(${JSON.stringify(child.args)})`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countCallNodes(node: CallTreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countCallNodes(child);
  }
  return count;
}

function maxDepth(node: CallTreeNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(maxDepth));
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function CallTreePanel() {
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const [showDuplicates, setShowDuplicates] = useState(true);

  const callTree = useMemo(() => buildCallTree(snapshots), [snapshots]);
  const totalCalls = useMemo(() => (callTree ? countCallNodes(callTree) : 0), [callTree]);
  const depth = useMemo(() => (callTree ? maxDepth(callTree) : 0), [callTree]);

  if (!callTree || snapshots.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Run code to see the function call tree
      </div>
    );
  }

  // If no function calls were made
  if (callTree.children.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No function calls detected. Try code with function invocations.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-700 bg-gray-800/50 text-xs">
        <span className="text-gray-400">{totalCalls} calls</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">depth {depth}</span>
        <label className="flex items-center gap-1 ml-auto cursor-pointer text-gray-400">
          <input
            type="checkbox"
            checked={showDuplicates}
            onChange={(e) => setShowDuplicates(e.target.checked)}
            className="rounded bg-gray-700 border-gray-600"
          />
          Show duplicates
        </label>
      </div>

      {/* Legend */}
      <div className="flex gap-3 px-3 py-1 border-b border-gray-700 text-[10px] text-gray-400">
        <span>🟢 Base case</span>
        <span>🔄 Duplicate</span>
        <span>📎 Call</span>
        <span className="text-yellow-300">→ Return value</span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-2">
        <CallNodeView
          node={callTree}
          showDuplicates={showDuplicates}
          currentStep={currentStepIndex}
        />
      </div>
    </div>
  );
}
