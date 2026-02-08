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
const NODE_STYLES: Record<CFGNode['type'], { fill: string; stroke: string; textFill: string }> = {
  start:        { fill: '#ECFDF5', stroke: '#059669', textFill: '#059669' },
  end:          { fill: '#FEF2F2', stroke: '#DC2626', textFill: '#DC2626' },
  statement:    { fill: '#F9FAFB', stroke: '#6B7280', textFill: '#1F2937' },
  condition:    { fill: '#FFFBEB', stroke: '#D97706', textFill: '#92400E' },
  loop:         { fill: '#F5F3FF', stroke: '#7C3AED', textFill: '#5B21B6' },
  functionCall: { fill: '#EFF6FF', stroke: '#2563EB', textFill: '#1D4ED8' },
  return:       { fill: '#FFF7ED', stroke: '#EA580C', textFill: '#C2410C' },
};

const NODE_STROKE_COLORS: Record<CFGNode['type'], string> = {
  start:        '#059669',
  end:          '#DC2626',
  statement:    '#6B7280',
  condition:    '#D97706',
  loop:         '#7C3AED',
  functionCall: '#2563EB',
  return:       '#EA580C',
};

// ─── Edge styling ───────────────────────────────────────────────────────────
function getEdgeStrokeColor(edge: CFGEdge): string {
  if (edge.wasExecuted) {
    switch (edge.type) {
      case 'true': return '#059669';
      case 'false': return '#DC2626';
      case 'loop-back': return '#7C3AED';
      default: return '#2563EB';
    }
  }
  return '#D1D5DB';
}

function getEdgeLabelFill(edge: CFGEdge): string {
  switch (edge.type) {
    case 'true': return '#059669';
    case 'false': return '#DC2626';
    case 'loop-back': return '#7C3AED';
    default: return '#6B7280';
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
          fill={node.wasExecuted ? style.fill : '#F3F4F6'}
          stroke={style.stroke}
          strokeWidth={node.wasExecuted ? 2 : 1}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill={style.textFill}
          fontSize="10"
        >
          {node.label}
        </text>
      </g>
    );
  }

  if (node.type === 'condition') {
    const size = 40;
    const points = `${cx},${cy - size / 2} ${cx + size},${cy} ${cx},${cy + size / 2} ${cx - size},${cy}`;
    return (
      <g>
        <polygon
          points={points}
          fill={node.wasExecuted ? style.fill : '#F3F4F6'}
          stroke={style.stroke}
          strokeWidth={node.wasExecuted ? 2 : 1}
        />
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fill={node.wasExecuted ? style.textFill : '#9CA3AF'}
          fontSize="9"
        >
          {node.label.length > 18 ? node.label.slice(0, 18) + '…' : node.label}
        </text>
      </g>
    );
  }

  const w = 140;
  const h = 30;
  const strokeColor = node.wasExecuted ? NODE_STROKE_COLORS[node.type] : '#D1D5DB';
  const isLoop = node.type === 'loop';

  return (
    <g>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={isLoop ? 12 : node.type === 'functionCall' ? 15 : 4}
        fill={node.wasExecuted ? style.fill : '#F9FAFB'}
        stroke={strokeColor}
        strokeWidth={node.wasExecuted ? 2 : 1}
        strokeDasharray={isLoop ? '4 2' : undefined}
      />
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        fill={node.wasExecuted ? style.textFill : '#9CA3AF'}
        fontSize="10"
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

  const strokeColor = getEdgeStrokeColor(edge);
  const labelFill = getEdgeLabelFill(edge);
  const isBackEdge = edge.type === 'loop-back';

  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;

  if (isBackEdge) {
    const curveOffset = 80;
    return (
      <g>
        <path
          d={`M ${sx} ${sy} C ${sx + curveOffset} ${sy + 20}, ${tx + curveOffset} ${ty - 20}, ${tx} ${ty}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={edge.wasExecuted ? 1.5 : 0.5}
          strokeDasharray="4 2"
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
        stroke={strokeColor}
        strokeWidth={edge.wasExecuted ? 1.5 : 0.5}
        markerEnd="url(#arrowhead)"
      />
      {edge.label && (
        <text
          x={mx + 8}
          y={my}
          fill={labelFill}
          fontSize="9"
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
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-header)', fontSize: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>{cfg.nodes.length} nodes</span>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <span style={{ color: 'var(--text-muted)' }}>{cfg.edges.length} edges</span>
        {snapshots.length > 0 && (
          <>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span style={{ color: coveragePercent === 100 ? 'var(--accent-green)' : 'var(--accent-warning)' }}>
              {coveragePercent}% coverage
            </span>
          </>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 10 }}>
        <span style={{ color: '#059669' }}>● Start</span>
        <span style={{ color: '#DC2626' }}>● End</span>
        <span style={{ color: '#D97706' }}>◆ Condition</span>
        <span style={{ color: '#7C3AED' }}>▢ Loop</span>
        <span style={{ color: '#6B7280' }}>□ Statement</span>
        <span style={{ color: '#2563EB' }}>▣ Function</span>
        <span style={{ color: '#EA580C' }}>◯ Return</span>
      </div>

      {/* Graph */}
      <div className="cf-scrollbar" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ margin: '0 auto', display: 'block' }}
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
                fill="#9CA3AF"
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
