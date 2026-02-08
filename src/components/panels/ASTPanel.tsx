/**
 * AST Viewer Panel – renders the Abstract Syntax Tree of the current code
 * as an interactive, collapsible, color-coded tree.
 */
import { useState, useMemo, useCallback } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { parseAST, markExecutingNodes } from '../../engine/treeUtils';
import type { TreeNode, NodeCategory } from '../../engine/treeTypes';

// ─── Color map for node categories ──────────────────────────────────────────
const CATEGORY_COLORS: Record<NodeCategory, { text: string; border: string }> = {
  declaration: { text: 'cf-val-object', border: 'var(--accent-blue)' },
  expression:  { text: 'cf-val-number', border: 'var(--accent-green)' },
  statement:   { text: 'cf-val-string', border: 'var(--accent-purple)' },
  literal:     { text: 'cf-val-number', border: 'var(--accent-warning)' },
  operator:    { text: 'cf-val-string', border: 'var(--accent-error)' },
  control:     { text: 'cf-val-function', border: 'var(--accent-warning)' },
  function:    { text: 'cf-val-object', border: 'var(--accent-blue)' },
  program:     { text: '', border: 'var(--text-muted)' },
};

const CATEGORY_BADGE: Record<NodeCategory, string> = {
  declaration: 'cf-badge-blue',
  expression:  'cf-badge-green',
  statement:   'cf-badge-purple',
  literal:     'cf-badge-warning',
  operator:    'cf-badge-error',
  control:     'cf-badge-warning',
  function:    'cf-badge-blue',
  program:     'cf-badge-blue',
};

// ─── Tree Node component ────────────────────────────────────────────────────
interface ASTNodeProps {
  node: TreeNode;
  filter: string;
  searchTerm: string;
  onNodeClick: (lineNumber: number) => void;
  defaultExpanded?: boolean;
}

function ASTNodeView({ node, filter, searchTerm, onNodeClick, defaultExpanded = false }: ASTNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || node.metadata.depth < 2);
  const hasChildren = node.children.length > 0;
  const category = node.metadata.nodeCategory || 'statement';
  const colors = CATEGORY_COLORS[category];

  // Filter logic
  if (filter && filter !== 'all') {
    const matchesSelf = category === filter;
    const matchesChild = hasMatchingDescendant(node, filter);
    if (!matchesSelf && !matchesChild) return null;
  }

  // Search logic
  const matchesSearch =
    !searchTerm ||
    node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.type.toLowerCase().includes(searchTerm.toLowerCase());

  const childMatchesSearch = searchTerm ? hasSearchMatch(node, searchTerm) : true;

  if (searchTerm && !matchesSearch && !childMatchesSearch) return null;

  const isExecuting = node.metadata.isExecuting;

  return (
    <div style={{ marginLeft: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 12,
          background: isExecuting ? 'var(--accent-blue-light)' : matchesSearch && searchTerm ? 'var(--accent-warning-light)' : 'transparent',
          border: isExecuting ? '1px solid var(--accent-blue)' : '1px solid transparent',
        }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          if (node.metadata.lineNumber) onNodeClick(node.metadata.lineNumber);
        }}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <span className="cf-tree-toggle" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            ▶
          </span>
        ) : (
          <span style={{ width: 16, textAlign: 'center', color: 'var(--text-muted)' }}>•</span>
        )}

        {/* Node type badge */}
        <span className={`cf-badge ${CATEGORY_BADGE[category]}`} style={{ fontSize: 10, fontFamily: 'var(--font-code)' }}>
          {node.type}
        </span>

        {/* Node label */}
        <span className={colors.text} style={{ fontFamily: 'var(--font-code)', fontWeight: 500 }}>
          {node.label}
        </span>

        {/* Line number */}
        {node.metadata.lineNumber && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto' }}>
            L{node.metadata.lineNumber}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div style={{ borderLeft: `1px solid ${colors.border}`, marginLeft: 6, paddingLeft: 2 }}>
          {node.children.map((child) => (
            <ASTNodeView
              key={child.id}
              node={child}
              filter={filter}
              searchTerm={searchTerm}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function hasMatchingDescendant(node: TreeNode, filter: string): boolean {
  for (const child of node.children) {
    if (child.metadata.nodeCategory === filter) return true;
    if (hasMatchingDescendant(child, filter)) return true;
  }
  return false;
}

function hasSearchMatch(node: TreeNode, term: string): boolean {
  const lower = term.toLowerCase();
  for (const child of node.children) {
    if (
      child.label.toLowerCase().includes(lower) ||
      child.type.toLowerCase().includes(lower)
    ) return true;
    if (hasSearchMatch(child, lower)) return true;
  }
  return false;
}

function countNodes(node: TreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

// ─── Legend component ────────────────────────────────────────────────────────
function ASTLegend() {
  const items: { category: NodeCategory; label: string }[] = [
    { category: 'declaration', label: 'Declarations' },
    { category: 'expression', label: 'Expressions' },
    { category: 'statement', label: 'Statements' },
    { category: 'literal', label: 'Literals' },
    { category: 'operator', label: 'Operators' },
    { category: 'control', label: 'Control Flow' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 10 }}>
      {items.map(({ category, label }) => (
        <span key={category} className={`cf-badge ${CATEGORY_BADGE[category]}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function ASTPanel() {
  const code = useExecutionStore((s) => s.code);
  const currentSnapshot = useExecutionStore((s) => {
    const { snapshots, currentStepIndex } = s;
    if (currentStepIndex >= 0 && currentStepIndex < snapshots.length) {
      return snapshots[currentStepIndex];
    }
    return null;
  });

  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { astTree, parseError } = useMemo(() => {
    if (!code.trim()) return { astTree: null, parseError: null };
    try {
      const tree = parseAST(code);
      if (currentSnapshot) {
        return { astTree: markExecutingNodes(tree, currentSnapshot.currentLine), parseError: null };
      }
      return { astTree: tree, parseError: null };
    } catch (e) {
      return { astTree: null, parseError: e instanceof Error ? e.message : 'Parse error' };
    }
  }, [code, currentSnapshot]);

  const nodeCount = useMemo(() => (astTree ? countNodes(astTree) : 0), [astTree]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleNodeClick = useCallback((_lineNumber: number) => {
    // Bidirectional linking: clicking an AST node could scroll the editor to this line.
    // The editor highlights the current execution line via the store already.
  }, []);

  if (parseError) {
    return (
      <div className="cf-panel-content" style={{ color: 'var(--accent-error)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Parse Error</div>
        <div style={{ fontSize: 12 }}>{parseError}</div>
      </div>
    );
  }

  if (!astTree) {
    return (
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
        Write code to see the Abstract Syntax Tree
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-header)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{nodeCount} nodes</span>
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            outline: 'none',
            fontFamily: 'var(--font-ui)',
            background: 'var(--bg-primary)',
          }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            outline: 'none',
            fontFamily: 'var(--font-ui)',
            background: 'var(--bg-primary)',
          }}
        >
          <option value="all">All types</option>
          <option value="declaration">Declarations</option>
          <option value="expression">Expressions</option>
          <option value="statement">Statements</option>
          <option value="literal">Literals</option>
          <option value="operator">Operators</option>
          <option value="control">Control Flow</option>
        </select>
      </div>

      {/* Legend */}
      <ASTLegend />

      {/* Tree */}
      <div className="cf-scrollbar" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <ASTNodeView
          node={astTree}
          filter={filter}
          searchTerm={searchTerm}
          onNodeClick={handleNodeClick}
          defaultExpanded
        />
      </div>
    </div>
  );
}
