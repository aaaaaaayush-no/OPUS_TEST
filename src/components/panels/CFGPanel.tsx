/**
 * Control Flow Graph Panel – renders a flowchart-style directed graph
 * of the program's control flow using a vertical layout.
 * Nodes are shaped/colored by type, edges show direction and conditions.
 */
import { useMemo } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { buildCFG, markExecutedCFGNodes } from '../../engine/treeUtils';
import type { CFGNode, CFGEdge, ControlFlowGraph } from '../../engine/treeTypes';

// ─── Node styling by type ───────────────────────────────────────────────────
const NODE_STYLES: Record<CFGNode['type'], { bg: string; border: string; text: string; shape: string }> = {
  start:        { bg: 'bg-green-900/60', border: 'border-green-400', text: 'text-green-300', shape: 'rounded-full' },
  end:          { bg: 'bg-red-900/60',   border: 'border-red-400',   text: 'text-red-300',   shape: 'rounded-full' },
  statement:    { bg: 'bg-gray-800',     border: 'border-gray-500',  text: 'text-gray-200',  shape: 'rounded' },
  condition:    { bg: 'bg-yellow-900/40',border: 'border-yellow-500',text: 'text-yellow-200',shape: 'rotate-diamond' },
  loop:         { bg: 'bg-purple-900/40',border: 'border-purple-500',text: 'text-purple-200',shape: 'rounded-lg' },
  functionCall: { bg: 'bg-cyan-900/40',  border: 'border-cyan-500',  text: 'text-cyan-200',  shape: 'rounded-xl' },
  return:       { bg: 'bg-orange-900/40',border: 'border-orange-500',text: 'text-orange-200',shape: 'rounded' },
};

// ─── Edge styling ───────────────────────────────────────────────────────────
function getEdgeColor(edge: CFGEdge): string {
  if (edge.wasExecuted) {
    switch (edge.type) {
      case 'true': return 'text-green-400';
      case 'false': return 'text-red-400';
      case 'loop-back': return 'text-purple-400';
      default: return 'text-blue-400';
    }
  }
  return 'text-gray-600';
}

function getEdgeLabelColor(edge: CFGEdge): string {
  switch (edge.type) {
    case 'true': return 'text-green-400';
    case 'false': return 'text-red-400';
    case 'loop-back': return 'text-purple-400';
    default: return 'text-gray-500';
  }
}

// ─── Layered layout algorithm ───────────────────────────────────────────────
interface LayoutNode {
  node: CFGNode;
  x: number;
  y: number;
  layer: number;
}

function computeLayout(cfg: ControlFlowGraph): { layoutNodes: LayoutNode[]; width: number; height: number } {
  if (cfg.nodes.length === 0) return { layoutNodes: [], width: 0, height: 0 };

  // Assign layers using topological sort (BFS from start)
  const layers = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const edge of cfg.edges) {
    if (edge.type === 'loop-back') continue; // Skip back-edges for layering
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  const startNode = cfg.nodes.find((n) => n.type === 'start');
  if (!startNode) return { layoutNodes: [], width: 0, height: 0 };

  const queue: string[] = [startNode.id];
  layers.set(startNode.id, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current)!;
    const neighbors = adjacency.get(current) || [];
    for (const next of neighbors) {
      const existingLayer = layers.get(next);
      if (existingLayer === undefined || existingLayer < currentLayer + 1) {
        layers.set(next, currentLayer + 1);
        queue.push(next);
      }
    }
  }

  // Assign any unvisited nodes
  for (const node of cfg.nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, (layers.size));
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, CFGNode[]>();
  for (const node of cfg.nodes) {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(node);
  }

  const NODE_WIDTH = 160;
  const NODE_HEIGHT = 40;
  const LAYER_GAP = 60;
  const NODE_GAP = 20;

  const layoutNodes: LayoutNode[] = [];
  let maxX = 0;

  const sortedLayers = Array.from(layerGroups.entries()).sort(([a], [b]) => a - b);
  for (const [layer, nodes] of sortedLayers) {
    const totalWidth = nodes.length * NODE_WIDTH + (nodes.length - 1) * NODE_GAP;
    const startX = -totalWidth / 2;
    for (let i = 0; i < nodes.length; i++) {
      const x = startX + i * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2;
      const y = layer * (NODE_HEIGHT + LAYER_GAP);
      layoutNodes.push({ node: nodes[i], x, y, layer });
      maxX = Math.max(maxX, Math.abs(x) + NODE_WIDTH / 2);
    }
  }

  const maxLayer = Math.max(...Array.from(layers.values()));
  return {
    layoutNodes,
    width: maxX * 2 + 40,
    height: (maxLayer + 1) * (NODE_HEIGHT + LAYER_GAP) + 40,
  };
}

// ─── SVG Node component ────────────────────────────────────────────────────
interface SVGNodeProps {
  layout: LayoutNode;
  offsetX: number;
}

function SVGNode({ layout, offsetX }: SVGNodeProps) {
  const { node, x, y } = layout;
  const style = NODE_STYLES[node.type];
  const cx = x + offsetX;
  const cy = y + 20;

  if (node.type === 'start' || node.type === 'end') {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={16}
          className={`${node.wasExecuted ? 'fill-current opacity-80' : 'fill-current opacity-30'} ${style.text}`}
          stroke="currentColor"
          strokeWidth={node.wasExecuted ? 2 : 1}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className={`text-[10px] ${style.text} fill-current`}
        >
          {node.label}
        </text>
      </g>
    );
  }

  if (node.type === 'condition') {
    // Diamond shape
    const size = 40;
    const points = `${cx},${cy - size / 2} ${cx + size},${cy} ${cx},${cy + size / 2} ${cx - size},${cy}`;
    return (
      <g>
        <polygon
          points={points}
          className={`${node.wasExecuted ? 'fill-yellow-900/60' : 'fill-gray-800/60'}`}
          stroke={node.wasExecuted ? '#eab308' : '#6b7280'}
          strokeWidth={node.wasExecuted ? 2 : 1}
        />
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          className={`text-[9px] ${node.wasExecuted ? 'fill-yellow-200' : 'fill-gray-400'}`}
        >
          {node.label.length > 18 ? node.label.slice(0, 18) + '…' : node.label}
        </text>
      </g>
    );
  }

  // Rectangle with rounded corners
  const w = 140;
  const h = 30;
  const borderColor = node.wasExecuted ? style.border.replace('border-', '') : 'gray-600';
  const isLoop = node.type === 'loop';

  return (
    <g>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={isLoop ? 12 : node.type === 'functionCall' ? 15 : 4}
        className={`${node.wasExecuted ? style.bg.replace('bg-', 'fill-').replace(/\/\d+/, '') : 'fill-gray-800/60'}`}
        style={{ fill: node.wasExecuted ? undefined : '#1f2937', opacity: node.wasExecuted ? 0.8 : 0.4 }}
        stroke={node.wasExecuted ? `var(--color-${borderColor})` : '#4b5563'}
        strokeWidth={node.wasExecuted ? 2 : 1}
        strokeDasharray={isLoop ? '4 2' : undefined}
      />
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        className={`text-[10px] ${node.wasExecuted ? style.text : 'text-gray-500'} fill-current`}
      >
        {node.label.length > 20 ? node.label.slice(0, 20) + '…' : node.label}
      </text>
    </g>
  );
}

// ─── SVG Edge component ────────────────────────────────────────────────────
interface SVGEdgeProps {
  edge: CFGEdge;
  sourceLayout: LayoutNode;
  targetLayout: LayoutNode;
  offsetX: number;
}

function SVGEdge({ edge, sourceLayout, targetLayout, offsetX }: SVGEdgeProps) {
  const sx = sourceLayout.x + offsetX;
  const sy = sourceLayout.y + 40;
  const tx = targetLayout.x + offsetX;
  const ty = targetLayout.y;

  const color = getEdgeColor(edge);
  const labelColor = getEdgeLabelColor(edge);
  const isBackEdge = edge.type === 'loop-back';

  // Calculate midpoint for label
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;

  if (isBackEdge) {
    // Draw a curved back-edge
    const curveOffset = 80;
    return (
      <g>
        <path
          d={`M ${sx} ${sy} C ${sx + curveOffset} ${sy + 20}, ${tx + curveOffset} ${ty - 20}, ${tx} ${ty}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={edge.wasExecuted ? 1.5 : 0.5}
          strokeDasharray="4 2"
          className={color}
          markerEnd="url(#arrowhead)"
        />
      </g>
    );
  }

  return (
    <g>
      <line
        x1={sx}
        y1={sy}
        x2={tx}
        y2={ty}
        stroke="currentColor"
        strokeWidth={edge.wasExecuted ? 1.5 : 0.5}
        className={color}
        markerEnd="url(#arrowhead)"
      />
      {edge.label && (
        <text
          x={mx + 8}
          y={my}
          className={`text-[9px] ${labelColor} fill-current`}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function CFGPanel() {
  const code = useExecutionStore((s) => s.code);
  const snapshots = useExecutionStore((s) => s.snapshots);

  const cfg = useMemo<ControlFlowGraph | null>(() => {
    if (!code.trim()) return null;
    try {
      const rawCFG = buildCFG(code);
      if (snapshots.length > 0) {
        return markExecutedCFGNodes(rawCFG, snapshots);
      }
      return rawCFG;
    } catch {
      return null;
    }
  }, [code, snapshots]);

  const layout = useMemo(() => {
    if (!cfg) return null;
    return computeLayout(cfg);
  }, [cfg]);

  if (!cfg || !layout) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Write code to see the Control Flow Graph
      </div>
    );
  }

  const { layoutNodes, width, height } = layout;
  const offsetX = width / 2;
  const svgWidth = Math.max(width, 300);
  const svgHeight = Math.max(height, 200);

  // Build lookup for edge rendering
  const nodeMap = new Map<string, LayoutNode>();
  for (const ln of layoutNodes) {
    nodeMap.set(ln.node.id, ln);
  }

  const executedCount = cfg.nodes.filter((n) => n.wasExecuted).length;
  const totalCount = cfg.nodes.length;
  const coveragePercent = totalCount > 0 ? Math.round((executedCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-700 bg-gray-800/50 text-xs">
        <span className="text-gray-400">{cfg.nodes.length} nodes</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">{cfg.edges.length} edges</span>
        {snapshots.length > 0 && (
          <>
            <span className="text-gray-600">|</span>
            <span className={`${coveragePercent === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
              {coveragePercent}% coverage
            </span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 px-3 py-1 border-b border-gray-700 text-[10px]">
        <span className="text-green-400">● Start</span>
        <span className="text-red-400">● End</span>
        <span className="text-yellow-400">◆ Condition</span>
        <span className="text-purple-400">▢ Loop</span>
        <span className="text-gray-400">□ Statement</span>
        <span className="text-cyan-400">▣ Function</span>
        <span className="text-orange-400">◯ Return</span>
      </div>

      {/* Graph */}
      <div className="flex-1 overflow-auto p-2">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="mx-auto"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                className="fill-gray-400"
              />
            </marker>
          </defs>

          {/* Edges */}
          {cfg.edges.map((edge, i) => {
            const sourceLayout = nodeMap.get(edge.source);
            const targetLayout = nodeMap.get(edge.target);
            if (!sourceLayout || !targetLayout) return null;
            return (
              <SVGEdge
                key={`edge-${i}`}
                edge={edge}
                sourceLayout={sourceLayout}
                targetLayout={targetLayout}
                offsetX={offsetX}
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((ln) => (
            <SVGNode
              key={ln.node.id}
              layout={ln}
              offsetX={offsetX}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
