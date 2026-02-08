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
  'var(--accent-blue)',
  'var(--accent-green)',
  'var(--accent-purple)',
  'var(--accent-warning)',
  'var(--accent-blue)',
  'var(--accent-error)',
  'var(--accent-green)',
  'var(--accent-purple)',
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

  // Filter duplicates if toggled off
  const visibleChildren = showDuplicates
    ? node.children
    : deduplicateChildren(node.children);

  const hiddenCount = node.children.length - visibleChildren.length;

  return (
    <div style={{ marginLeft: 12, borderLeft: node.depth > 0 ? `1px solid ${depthColor}` : 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 12,
          background: node.callIndex === currentStep ? 'var(--accent-blue-light)' : 'transparent',
          border: node.callIndex === currentStep ? '1px solid var(--accent-blue)' : '1px solid transparent',
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <span className="cf-tree-toggle" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            ▶
          </span>
        ) : (
          <span style={{ width: 16 }} />
        )}

        {/* Function icon */}
        <span style={{ fontSize: 10 }}>
          {node.isBaseCase ? '🟢' : node.isDuplicate ? '🔄' : '📎'}
        </span>

        {/* Function name */}
        <span style={{
          fontFamily: 'var(--font-code)',
          fontWeight: 500,
          color: node.isBaseCase ? 'var(--accent-green)' : node.isDuplicate ? 'var(--text-muted)' : 'var(--accent-blue)',
        }}>
          {node.functionName}
        </span>

        {/* Arguments */}
        {node.args.length > 0 && (
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-code)' }}>
            ({node.args.map(formatValue).join(', ')})
          </span>
        )}

        {/* Return value */}
        {node.returnValue !== undefined && (
          <span style={{ color: 'var(--accent-warning)', fontFamily: 'var(--font-code)', marginLeft: 4 }}>
            → {formatValue(node.returnValue)}
          </span>
        )}

        {/* Depth badge */}
        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto' }}>
          d={node.depth}
        </span>

        {/* Call index */}
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
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
            <div style={{ marginLeft: 24, fontSize: 10, color: 'var(--text-muted)', padding: '2px 0' }}>
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
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
        Run code to see the function call tree
      </div>
    );
  }

  // If no function calls were made
  if (callTree.children.length === 0) {
    return (
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
        No function calls detected. Try code with function invocations.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-header)', fontSize: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>{totalCalls} calls</span>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>depth {depth}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={showDuplicates}
            onChange={(e) => setShowDuplicates(e.target.checked)}
          />
          Show duplicates
        </label>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '4px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 10, color: 'var(--text-muted)' }}>
        <span>🟢 Base case</span>
        <span>🔄 Duplicate</span>
        <span>📎 Call</span>
        <span style={{ color: 'var(--accent-warning)' }}>→ Return value</span>
      </div>

      {/* Tree */}
      <div className="cf-scrollbar" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <CallNodeView
          node={callTree}
          showDuplicates={showDuplicates}
          currentStep={currentStepIndex}
        />
      </div>
    </div>
  );
}
