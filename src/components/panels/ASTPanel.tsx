/**
 * AST Viewer Panel – renders the Abstract Syntax Tree of the current code
 * as an interactive, collapsible, color-coded tree.
 */
import { useState, useMemo, useCallback } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { parseAST, markExecutingNodes } from '../../engine/treeUtils';
import type { TreeNode, NodeCategory } from '../../engine/treeTypes';

// ─── Color map for node categories ──────────────────────────────────────────
const CATEGORY_COLORS: Record<NodeCategory, { bg: string; text: string; border: string }> = {
  declaration: { bg: 'bg-blue-900/40', text: 'text-blue-300', border: 'border-blue-500/50' },
  expression:  { bg: 'bg-green-900/40', text: 'text-green-300', border: 'border-green-500/50' },
  statement:   { bg: 'bg-purple-900/40', text: 'text-purple-300', border: 'border-purple-500/50' },
  literal:     { bg: 'bg-orange-900/40', text: 'text-orange-300', border: 'border-orange-500/50' },
  operator:    { bg: 'bg-red-900/40', text: 'text-red-300', border: 'border-red-500/50' },
  control:     { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-500/50' },
  function:    { bg: 'bg-cyan-900/40', text: 'text-cyan-300', border: 'border-cyan-500/50' },
  program:     { bg: 'bg-gray-800', text: 'text-gray-200', border: 'border-gray-500/50' },
};

const CATEGORY_BADGE_COLORS: Record<NodeCategory, string> = {
  declaration: 'bg-blue-500/20 text-blue-300',
  expression:  'bg-green-500/20 text-green-300',
  statement:   'bg-purple-500/20 text-purple-300',
  literal:     'bg-orange-500/20 text-orange-300',
  operator:    'bg-red-500/20 text-red-300',
  control:     'bg-yellow-500/20 text-yellow-300',
  function:    'bg-cyan-500/20 text-cyan-300',
  program:     'bg-gray-500/20 text-gray-300',
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
    <div className="ml-3">
      <div
        className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded cursor-pointer transition-all text-xs
          ${isExecuting ? 'ring-2 ring-yellow-400/60 bg-yellow-500/10' : ''}
          ${matchesSearch && searchTerm ? 'bg-yellow-500/10' : ''}
          hover:bg-gray-700/50
        `}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          if (node.metadata.lineNumber) onNodeClick(node.metadata.lineNumber);
        }}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <span className={`text-gray-500 w-3 text-center transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        ) : (
          <span className="w-3 text-center text-gray-600">•</span>
        )}

        {/* Node type badge */}
        <span className={`px-1 py-0 rounded text-[10px] font-mono ${CATEGORY_BADGE_COLORS[category]}`}>
          {node.type}
        </span>

        {/* Node label */}
        <span className={`font-mono font-medium ${colors.text}`}>
          {node.label}
        </span>

        {/* Line number */}
        {node.metadata.lineNumber && (
          <span className="text-gray-600 text-[10px] ml-auto">
            L{node.metadata.lineNumber}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className={`border-l ${colors.border} ml-1.5`}>
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
    <div className="flex flex-wrap gap-2 px-3 py-1.5 border-b border-gray-700 text-[10px]">
      {items.map(({ category, label }) => (
        <span key={category} className={`px-1.5 py-0.5 rounded ${CATEGORY_BADGE_COLORS[category]}`}>
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

  const handleNodeClick = useCallback((lineNumber: number) => {
    // The click-to-highlight interaction is handled by the parent via the store
    // For now we log it – in a full implementation this would scroll the editor
    console.log('AST node clicked, line:', lineNumber);
  }, []);

  if (parseError) {
    return (
      <div className="p-4 text-red-400 text-sm">
        <div className="font-bold mb-1">⚠️ Parse Error</div>
        <div className="text-xs text-red-300">{parseError}</div>
      </div>
    );
  }

  if (!astTree) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Write code to see the Abstract Syntax Tree
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700 bg-gray-800/50">
        <span className="text-xs text-gray-400">{nodeCount} nodes</span>
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-gray-700 text-xs text-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-700 text-xs text-gray-200 rounded px-2 py-1 outline-none"
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
      <div className="flex-1 overflow-auto p-2">
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
