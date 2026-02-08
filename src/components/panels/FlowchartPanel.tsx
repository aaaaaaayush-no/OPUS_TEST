/**
 * Advanced Flowchart Panel – renders professional, publication-quality flowcharts
 * with color-coded flow lines, shaped nodes, interactive features, zoom/pan,
 * minimap, and execution state visualization.
 */
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { buildCFG, markExecutedCFGNodes } from '../../engine/treeUtils';
import type { CFGNode, CFGEdge, ControlFlowGraph } from '../../engine/treeTypes';

// ─── Color palette for flow lines ────────────────────────────────────────────
const EDGE_COLORS: Record<CFGEdge['type'], string> = {
  normal:          '#4A90E2',
  true:            '#7ED321',
  false:           '#E94B3C',
  'loop-back':     '#9013FE',
  'function-call': '#F5A623',
  return:          '#BD10E0',
  exception:       '#D0021B',
  async:           '#50E3C2',
};

const EDGE_WIDTHS: Record<CFGEdge['type'], number> = {
  normal:          2,
  true:            2.5,
  false:           2.5,
  'loop-back':     2.5,
  'function-call': 2,
  return:          2,
  exception:       3,
  async:           2,
};

const EDGE_DASH: Record<CFGEdge['type'], string | undefined> = {
  normal:          undefined,
  true:            undefined,
  false:           undefined,
  'loop-back':     '5,3',
  'function-call': '2,2',
  return:          '8,3,2,3',
  exception:       undefined,
  async:           '4,2',
};

const EDGE_LABELS: Record<string, string> = {
  true: 'Yes',
  false: 'No',
  'loop-back': 'Repeat',
  exception: 'Error',
};

// ─── Node styling ────────────────────────────────────────────────────────────
interface NodeStyle {
  fill: string;
  gradient: [string, string];
  stroke: string;
  textFill: string;
  icon: string;
}

const NODE_STYLES: Record<string, NodeStyle> = {
  start:        { fill: '#E8F4FF', gradient: ['#E8F4FF', '#FFFFFF'], stroke: '#4A90E2', textFill: '#2C3E50', icon: '▶' },
  end:          { fill: '#FDEDEE', gradient: ['#FDEDEE', '#FFFFFF'], stroke: '#4A90E2', textFill: '#2C3E50', icon: '⏹' },
  statement:    { fill: '#FAFBFC', gradient: ['#FAFBFC', '#FFFFFF'], stroke: '#95A5A6', textFill: '#2C3E50', icon: '' },
  condition:    { fill: '#FFF8E1', gradient: ['#FFF8E1', '#FFFFFF'], stroke: '#F5A623', textFill: '#2C3E50', icon: '❓' },
  loop:         { fill: '#F3E5F5', gradient: ['#F3E5F5', '#FFFFFF'], stroke: '#9013FE', textFill: '#2C3E50', icon: '🔄' },
  functionCall: { fill: '#FFF3E0', gradient: ['#FFF3E0', '#FFFFFF'], stroke: '#F5A623', textFill: '#2C3E50', icon: 'ƒ' },
  return:       { fill: '#FFF7ED', gradient: ['#FFF7ED', '#FFFFFF'], stroke: '#EA580C', textFill: '#2C3E50', icon: '↩' },
  input:        { fill: '#E0F7FA', gradient: ['#E0F7FA', '#FFFFFF'], stroke: '#50E3C2', textFill: '#2C3E50', icon: '📥' },
  output:       { fill: '#E0F7FA', gradient: ['#E0F7FA', '#FFFFFF'], stroke: '#50E3C2', textFill: '#2C3E50', icon: '📤' },
  annotation:   { fill: '#FFFDE7', gradient: ['#FFFDE7', '#FFFDE7'], stroke: '#95A5A6', textFill: '#666666', icon: '💬' },
  trycatch:     { fill: '#FFF3E0', gradient: ['#FFF3E0', '#FFFFFF'], stroke: '#F5A623', textFill: '#2C3E50', icon: '⚠' },
};

// ─── Layout algorithm ────────────────────────────────────────────────────────
interface LayoutNode {
  node: CFGNode;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const DIAMOND_SIZE = 50;
const LAYER_GAP = 80;
const NODE_GAP = 120;
const PADDING = 40;

function computeLayout(cfg: ControlFlowGraph): { layoutNodes: LayoutNode[]; width: number; height: number } {
  if (cfg.nodes.length === 0) return { layoutNodes: [], width: 0, height: 0 };

  // Assign layers using topological sort (BFS from start)
  const layers = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const edge of cfg.edges) {
    if (edge.type === 'loop-back') continue;
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
      layers.set(node.id, layers.size);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, CFGNode[]>();
  for (const node of cfg.nodes) {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(node);
  }

  const layoutNodes: LayoutNode[] = [];
  let maxX = 0;

  const sortedLayers = Array.from(layerGroups.entries()).sort(([a], [b]) => a - b);
  for (const [layer, nodes] of sortedLayers) {
    const totalWidth = nodes.length * NODE_WIDTH + (nodes.length - 1) * NODE_GAP;
    const startX = -totalWidth / 2;
    for (let i = 0; i < nodes.length; i++) {
      const w = nodes[i].type === 'condition' ? DIAMOND_SIZE * 2 + 40 : NODE_WIDTH;
      const h = NODE_HEIGHT;
      const x = startX + i * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2;
      const y = layer * (NODE_HEIGHT + LAYER_GAP) + PADDING;
      layoutNodes.push({ node: nodes[i], x, y, width: w, height: h, layer });
      maxX = Math.max(maxX, Math.abs(x) + NODE_WIDTH / 2);
    }
  }

  const maxLayer = Math.max(...Array.from(layers.values()));
  return {
    layoutNodes,
    width: maxX * 2 + PADDING * 2,
    height: (maxLayer + 1) * (NODE_HEIGHT + LAYER_GAP) + PADDING * 2,
  };
}

// ─── SVG gradient definitions ────────────────────────────────────────────────
function GradientDefs() {
  return (
    <>
      {Object.entries(NODE_STYLES).map(([type, style]) => (
        <linearGradient key={`grad-${type}`} id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={style.gradient[0]} />
          <stop offset="100%" stopColor={style.gradient[1]} />
        </linearGradient>
      ))}
    </>
  );
}

// ─── SVG arrow marker definitions ────────────────────────────────────────────
function MarkerDefs() {
  return (
    <>
      {Object.entries(EDGE_COLORS).map(([type, color]) => (
        <marker
          key={`arrow-${type}`}
          id={`arrow-${type}`}
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon points="0 0, 10 4, 0 8" fill={color} />
        </marker>
      ))}
      <marker
        id="arrow-unexecuted"
        markerWidth="10"
        markerHeight="8"
        refX="9"
        refY="4"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 10 4, 0 8" fill="#D1D5DB" />
      </marker>
    </>
  );
}

// ─── Node Components ─────────────────────────────────────────────────────────
interface FlowNodeProps {
  layout: LayoutNode;
  offsetX: number;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

function FlowNode({ layout, offsetX, isHovered, isSelected, onHover, onClick }: FlowNodeProps) {
  const { node, x, y } = layout;
  const style = NODE_STYLES[node.type] || NODE_STYLES.statement;
  const cx = x + offsetX;
  const cy = y + NODE_HEIGHT / 2;
  const executed = node.wasExecuted;
  const opacity = executed ? 1 : 0.4;
  const hoverStroke = isHovered ? 3 : isSelected ? 4 : 2;
  const shadowFilter = isHovered ? 'url(#shadow-hover)' : 'url(#shadow-default)';

  // Start/End: Pill/rounded rectangle
  if (node.type === 'start' || node.type === 'end') {
    const w = 120;
    const h = 44;
    return (
      <g
        opacity={opacity}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(node.id)}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx={h / 2}
          ry={h / 2}
          fill={`url(#grad-${node.type})`}
          stroke={isSelected ? '#4A90E2' : style.stroke}
          strokeWidth={hoverStroke}
          filter={shadowFilter}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={style.textFill}
          fontSize="14"
          fontWeight="700"
          fontFamily="'Segoe UI', Arial, sans-serif"
        >
          {style.icon} {node.label}
        </text>
      </g>
    );
  }

  // Decision/Condition: Diamond
  if (node.type === 'condition') {
    const size = DIAMOND_SIZE;
    const points = `${cx},${cy - size} ${cx + size + 20},${cy} ${cx},${cy + size} ${cx - size - 20},${cy}`;
    const labelText = node.label.length > 20 ? node.label.slice(0, 20) + '…' : node.label;
    return (
      <g
        opacity={opacity}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(node.id)}
        style={{ cursor: 'pointer' }}
      >
        <polygon
          points={points}
          fill={`url(#grad-condition)`}
          stroke={isSelected ? '#4A90E2' : style.stroke}
          strokeWidth={hoverStroke}
          filter={shadowFilter}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={style.textFill}
          fontSize="12"
          fontWeight="600"
          fontFamily="'Segoe UI', Arial, sans-serif"
        >
          {labelText}
        </text>
      </g>
    );
  }

  // Loop: Hexagon
  if (node.type === 'loop') {
    const w = NODE_WIDTH;
    const h = NODE_HEIGHT;
    const inset = 18;
    const points = `${cx - w / 2 + inset},${cy - h / 2} ${cx + w / 2 - inset},${cy - h / 2} ${cx + w / 2},${cy} ${cx + w / 2 - inset},${cy + h / 2} ${cx - w / 2 + inset},${cy + h / 2} ${cx - w / 2},${cy}`;
    const labelText = node.label.length > 22 ? node.label.slice(0, 22) + '…' : node.label;
    return (
      <g
        opacity={opacity}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(node.id)}
        style={{ cursor: 'pointer' }}
      >
        <polygon
          points={points}
          fill={`url(#grad-loop)`}
          stroke={isSelected ? '#4A90E2' : style.stroke}
          strokeWidth={hoverStroke}
          filter={shadowFilter}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={style.textFill}
          fontSize="13"
          fontWeight="600"
          fontFamily="'Segoe UI', Arial, sans-serif"
        >
          {style.icon} {labelText}
        </text>
      </g>
    );
  }

  // Function/Subroutine: Double-bordered rectangle
  if (node.type === 'functionCall') {
    const w = NODE_WIDTH;
    const h = NODE_HEIGHT + 10;
    const labelText = node.label.length > 22 ? node.label.slice(0, 22) + '…' : node.label;
    return (
      <g
        opacity={opacity}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(node.id)}
        style={{ cursor: 'pointer' }}
      >
        {/* Outer border */}
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx={4}
          ry={4}
          fill={`url(#grad-functionCall)`}
          stroke={isSelected ? '#4A90E2' : style.stroke}
          strokeWidth={hoverStroke}
          filter={shadowFilter}
        />
        {/* Inner border */}
        <rect
          x={cx - w / 2 + 6}
          y={cy - h / 2 + 6}
          width={w - 12}
          height={h - 12}
          rx={2}
          ry={2}
          fill="none"
          stroke={style.stroke}
          strokeWidth={1}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={style.textFill}
          fontSize="13"
          fontWeight="600"
          fontFamily="'Segoe UI', Arial, sans-serif"
        >
          {style.icon} {labelText}
        </text>
      </g>
    );
  }

  // Try-catch: Rounded rectangle with special border
  if (node.type === 'trycatch') {
    const w = NODE_WIDTH;
    const h = NODE_HEIGHT;
    const labelText = node.label.length > 22 ? node.label.slice(0, 22) + '…' : node.label;
    return (
      <g
        opacity={opacity}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(node.id)}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx={8}
          ry={8}
          fill={`url(#grad-trycatch)`}
          stroke={isSelected ? '#4A90E2' : style.stroke}
          strokeWidth={hoverStroke}
          strokeDasharray="6,2"
          filter={shadowFilter}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={style.textFill}
          fontSize="13"
          fontWeight="600"
          fontFamily="'Segoe UI', Arial, sans-serif"
        >
          {style.icon} {labelText}
        </text>
      </g>
    );
  }

  // Default: Process/Statement rectangle
  const w = NODE_WIDTH;
  const h = NODE_HEIGHT;
  const labelText = node.label.length > 24 ? node.label.slice(0, 24) + '…' : node.label;
  return (
    <g
      opacity={opacity}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node.id)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={4}
        ry={4}
        fill={`url(#grad-${node.type in NODE_STYLES ? node.type : 'statement'})`}
        stroke={isSelected ? '#4A90E2' : style.stroke}
        strokeWidth={hoverStroke}
        filter={shadowFilter}
      />
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={style.textFill}
        fontSize="13"
        fontWeight="400"
        fontFamily="'Consolas', 'Monaco', monospace"
      >
        {labelText}
      </text>
      {node.executionCount !== undefined && node.executionCount > 0 && (
        <g>
          <rect
            x={cx + w / 2 - 28}
            y={cy - h / 2 - 8}
            width={24}
            height={16}
            rx={8}
            fill="#E8F4FF"
            stroke="#4A90E2"
            strokeWidth={1}
          />
          <text
            x={cx + w / 2 - 16}
            y={cy - h / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#2C3E50"
            fontSize="10"
            fontWeight="600"
          >
            {node.executionCount}x
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Edge Components ─────────────────────────────────────────────────────────
interface FlowEdgeProps {
  edge: CFGEdge;
  sourceLayout: LayoutNode;
  targetLayout: LayoutNode;
  offsetX: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}

function FlowEdge({ edge, sourceLayout, targetLayout, offsetX, isHovered, onHover }: FlowEdgeProps) {
  const sx = sourceLayout.x + offsetX;
  const sy = sourceLayout.y + NODE_HEIGHT;
  const tx = targetLayout.x + offsetX;
  const ty = targetLayout.y;

  const edgeColor = edge.wasExecuted
    ? EDGE_COLORS[edge.type] || EDGE_COLORS.normal
    : '#D1D5DB';
  const edgeWidth = isHovered ? 4 : (edge.wasExecuted ? EDGE_WIDTHS[edge.type] || 2 : 1);
  const dashArray = EDGE_DASH[edge.type];
  const markerId = edge.wasExecuted ? `arrow-${edge.type}` : 'arrow-unexecuted';
  const isBackEdge = edge.type === 'loop-back';
  const edgeId = `${edge.source}-${edge.target}`;

  const label = edge.label ? (EDGE_LABELS[edge.label] || edge.label) : EDGE_LABELS[edge.type];

  if (isBackEdge) {
    const curveOffset = 90;
    const pathD = `M ${sx} ${sy} C ${sx + curveOffset} ${sy + 30}, ${tx + curveOffset} ${ty - 30}, ${tx} ${ty}`;
    const midX = sx + curveOffset * 0.7;
    const midY = (sy + ty) / 2;
    return (
      <g
        onMouseEnter={() => onHover(edgeId)}
        onMouseLeave={() => onHover(null)}
        style={{ cursor: 'pointer' }}
      >
        <path
          d={pathD}
          fill="none"
          stroke={edgeColor}
          strokeWidth={edgeWidth}
          strokeDasharray={dashArray}
          markerEnd={`url(#${markerId})`}
          opacity={edge.wasExecuted ? 1 : 0.3}
        />
        {/* Animated particle for executed back edges */}
        {edge.wasExecuted && (
          <circle r="4" fill="white" opacity="0.9">
            <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
          </circle>
        )}
        {label && (
          <g>
            <rect
              x={midX - 22}
              y={midY - 10}
              width={44}
              height={20}
              rx={10}
              fill="white"
              stroke={edgeColor}
              strokeWidth={1}
            />
            <text
              x={midX}
              y={midY + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={edgeColor}
              fontSize="11"
              fontWeight="600"
              fontFamily="'Segoe UI', Arial, sans-serif"
            >
              {label}
            </text>
          </g>
        )}
      </g>
    );
  }

  // Orthogonal routing with rounded corners
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  let pathD: string;

  if (Math.abs(sx - tx) < 5) {
    // Straight vertical line
    pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
  } else {
    // Manhattan routing with rounded corners
    const r = 8;
    const midY2 = sy + (ty - sy) / 2;
    if (tx > sx) {
      pathD = `M ${sx} ${sy} L ${sx} ${midY2 - r} Q ${sx} ${midY2} ${sx + r} ${midY2} L ${tx - r} ${midY2} Q ${tx} ${midY2} ${tx} ${midY2 + r} L ${tx} ${ty}`;
    } else {
      pathD = `M ${sx} ${sy} L ${sx} ${midY2 - r} Q ${sx} ${midY2} ${sx - r} ${midY2} L ${tx + r} ${midY2} Q ${tx} ${midY2} ${tx} ${midY2 + r} L ${tx} ${ty}`;
    }
  }

  return (
    <g
      onMouseEnter={() => onHover(edgeId)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={edgeColor}
        strokeWidth={edgeWidth}
        strokeDasharray={dashArray}
        markerEnd={`url(#${markerId})`}
        opacity={edge.wasExecuted ? 1 : 0.3}
      />
      {label && (
        <g>
          <rect
            x={mx - 18}
            y={my - 10}
            width={36}
            height={20}
            rx={10}
            fill={edge.type === 'true' ? '#E8F5E9' : edge.type === 'false' ? '#FFEBEE' : 'white'}
            stroke={edgeColor}
            strokeWidth={1}
          />
          <text
            x={mx}
            y={my + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={edgeColor}
            fontSize="11"
            fontWeight="600"
            fontFamily="'Segoe UI', Arial, sans-serif"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Tooltip Component ───────────────────────────────────────────────────────
interface TooltipProps {
  node: CFGNode;
  x: number;
  y: number;
}

function Tooltip({ node, x, y }: TooltipProps) {
  return (
    <g>
      <rect
        x={x + 10}
        y={y - 50}
        width={180}
        height={60}
        rx={6}
        fill="#1F2937"
        opacity={0.95}
      />
      <text x={x + 20} y={y - 32} fill="white" fontSize="12" fontWeight="600" fontFamily="'Segoe UI', Arial, sans-serif">
        {node.lineNumber ? `Line ${node.lineNumber}` : node.type}
      </text>
      <text x={x + 20} y={y - 14} fill="#9CA3AF" fontSize="11" fontFamily="'Segoe UI', Arial, sans-serif">
        {node.wasExecuted ? '✓ Executed' : '○ Not executed'}
        {node.executionCount ? ` • ${node.executionCount}x` : ''}
      </text>
    </g>
  );
}

// ─── Minimap Component ───────────────────────────────────────────────────────
interface MinimapProps {
  layoutNodes: LayoutNode[];
  edges: CFGEdge[];
  nodeMap: Map<string, LayoutNode>;
  totalWidth: number;
  totalHeight: number;
  viewBox: { x: number; y: number; w: number; h: number };
  offsetX: number;
}

function Minimap({ layoutNodes, edges, nodeMap, totalWidth, totalHeight, viewBox, offsetX }: MinimapProps) {
  const mmW = 140;
  const mmH = 100;
  const scaleX = mmW / Math.max(totalWidth, 1);
  const scaleY = mmH / Math.max(totalHeight, 1);
  const scale = Math.min(scaleX, scaleY) * 0.9;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: mmW + 8,
        height: mmH + 24,
        background: 'white',
        border: '1px solid #D1D5DB',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        padding: 4,
        zIndex: 10,
      }}
    >
      <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, marginBottom: 2, textAlign: 'center' }}>Minimap</div>
      <svg width={mmW} height={mmH} viewBox={`0 0 ${mmW} ${mmH}`}>
        {/* Edges */}
        {edges.map((edge, i) => {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) return null;
          const xOff = mmW / 2 * (1 - scale * 2);
          return (
            <line
              key={`mm-e-${i}`}
              x1={(src.x + offsetX) * scale + xOff}
              y1={(src.y + NODE_HEIGHT / 2) * scale}
              x2={(tgt.x + offsetX) * scale + xOff}
              y2={(tgt.y + NODE_HEIGHT / 2) * scale}
              stroke={edge.wasExecuted ? EDGE_COLORS[edge.type] || '#4A90E2' : '#E5E7EB'}
              strokeWidth={0.5}
            />
          );
        })}
        {/* Nodes */}
        {(() => {
          const xOff = mmW / 2 * (1 - scale * 2);
          return layoutNodes.map((ln) => (
            <rect
              key={`mm-n-${ln.node.id}`}
              x={(ln.x + offsetX - 4) * scale + xOff}
              y={(ln.y) * scale}
              width={8 * scale + 2}
              height={4 * scale + 2}
              rx={1}
              fill={ln.node.wasExecuted ? (NODE_STYLES[ln.node.type]?.stroke || '#6B7280') : '#E5E7EB'}
            />
          ));
        })()}
        {/* Viewport indicator */}
        <rect
          x={Math.max(0, viewBox.x * scale)}
          y={Math.max(0, viewBox.y * scale)}
          width={Math.min(mmW, viewBox.w * scale)}
          height={Math.min(mmH, viewBox.h * scale)}
          fill="none"
          stroke="#4A90E2"
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
}

// ─── Legend Component ────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { shape: 'pill', label: 'Start / End', color: '#4A90E2' },
    { shape: 'rect', label: 'Process', color: '#95A5A6' },
    { shape: 'diamond', label: 'Decision', color: '#F5A623' },
    { shape: 'hex', label: 'Loop', color: '#9013FE' },
    { shape: 'dblrect', label: 'Function', color: '#F5A623' },
    { shape: 'dashrect', label: 'Try/Catch', color: '#F5A623' },
  ];

  const edgeItems = [
    { label: 'Sequential', color: '#4A90E2', dash: undefined },
    { label: 'True (Yes)', color: '#7ED321', dash: undefined },
    { label: 'False (No)', color: '#E94B3C', dash: undefined },
    { label: 'Loop back', color: '#9013FE', dash: '5,3' },
    { label: 'Function call', color: '#F5A623', dash: '2,2' },
    { label: 'Return', color: '#BD10E0', dash: '8,3,2,3' },
    { label: 'Exception', color: '#D0021B', dash: undefined },
  ];

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      padding: '6px 12px',
      borderBottom: '1px solid var(--border-light)',
      fontSize: 10,
      alignItems: 'center',
    }}>
      <span style={{ fontWeight: 600, color: '#6B7280', marginRight: 4 }}>Nodes:</span>
      {items.map((item) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <svg width="14" height="10" viewBox="0 0 14 10">
            {item.shape === 'pill' && <rect x="1" y="1" width="12" height="8" rx="4" fill="none" stroke={item.color} strokeWidth="1.5" />}
            {item.shape === 'rect' && <rect x="1" y="1" width="12" height="8" rx="1" fill="none" stroke={item.color} strokeWidth="1.5" />}
            {item.shape === 'diamond' && <polygon points="7,0 14,5 7,10 0,5" fill="none" stroke={item.color} strokeWidth="1.2" />}
            {item.shape === 'hex' && <polygon points="3,0 11,0 14,5 11,10 3,10 0,5" fill="none" stroke={item.color} strokeWidth="1.2" />}
            {item.shape === 'dblrect' && (
              <>
                <rect x="0" y="0" width="14" height="10" rx="1" fill="none" stroke={item.color} strokeWidth="1.2" />
                <rect x="2" y="2" width="10" height="6" rx="1" fill="none" stroke={item.color} strokeWidth="0.8" />
              </>
            )}
            {item.shape === 'dashrect' && <rect x="1" y="1" width="12" height="8" rx="2" fill="none" stroke={item.color} strokeWidth="1.2" strokeDasharray="2,1" />}
          </svg>
          <span style={{ color: '#6B7280' }}>{item.label}</span>
        </span>
      ))}
      <span style={{ width: 1, height: 12, background: '#E5E7EB', margin: '0 4px' }} />
      <span style={{ fontWeight: 600, color: '#6B7280', marginRight: 4 }}>Flows:</span>
      {edgeItems.map((item) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <svg width="20" height="8" viewBox="0 0 20 8">
            <line x1="0" y1="4" x2="16" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray={item.dash} />
            <polygon points="14,1 20,4 14,7" fill={item.color} />
          </svg>
          <span style={{ color: '#6B7280' }}>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function FlowchartPanel() {
  const code = useExecutionStore((s) => s.code);
  const snapshots = useExecutionStore((s) => s.snapshots);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Current line for highlighting
  const currentLine = useMemo(() => {
    if (currentStepIndex >= 0 && currentStepIndex < snapshots.length) {
      return snapshots[currentStepIndex].currentLine;
    }
    return -1;
  }, [snapshots, currentStepIndex]);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.2, Math.min(3, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.target === e.currentTarget) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
    }
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPanOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const zoomToFit = useCallback(() => {
    if (!layout || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const scaleX = containerRect.width / Math.max(layout.width, 1);
    const scaleY = containerRect.height / Math.max(layout.height, 1);
    setZoom(Math.min(scaleX, scaleY, 1) * 0.9);
    setPanOffset({ x: 0, y: 0 });
  }, [layout]);

  // Focus on current executing node
  const focusCurrent = useCallback(() => {
    if (!layout || currentLine < 0) return;
    const currentNode = layout.layoutNodes.find((ln) => ln.node.lineNumber === currentLine);
    if (currentNode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPanOffset({
        x: rect.width / 2 - (currentNode.x + layout.width / 2) * zoom,
        y: rect.height / 2 - (currentNode.y + NODE_HEIGHT / 2) * zoom,
      });
    }
  }, [layout, currentLine, zoom]);

  // ESC to deselect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNode(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!cfg || !layout) {
    return (
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Write code to see the Flowchart</div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>Supports if/else, loops, functions, try/catch</div>
        </div>
      </div>
    );
  }

  const { layoutNodes, width, height } = layout;
  const offsetX = width / 2;
  const svgWidth = Math.max(width, 300);
  const svgHeight = Math.max(height, 200);

  // Build lookup
  const nodeMap = new Map<string, LayoutNode>();
  for (const ln of layoutNodes) {
    nodeMap.set(ln.node.id, ln);
  }

  const executedCount = cfg.nodes.filter((n) => n.wasExecuted).length;
  const totalCount = cfg.nodes.length;
  const coveragePercent = totalCount > 0 ? Math.round((executedCount / totalCount) * 100) : 0;

  // Hovered node info for tooltip
  const hoveredNodeLayout = hoveredNode ? nodeMap.get(hoveredNode) : null;

  // ViewBox for minimap
  const viewBox = {
    x: -panOffset.x / zoom,
    y: -panOffset.y / zoom,
    w: containerRef.current ? containerRef.current.clientWidth / zoom : svgWidth,
    h: containerRef.current ? containerRef.current.clientHeight / zoom : svgHeight,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-header)',
        fontSize: 12,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>📐 Flowchart</span>
        <span style={{ color: 'var(--border-color)' }}>|</span>
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

        {/* Zoom controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            className="cf-btn cf-btn-sm cf-btn-icon"
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}
            title="Zoom out"
          >
            −
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="cf-btn cf-btn-sm cf-btn-icon"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            title="Zoom in"
          >
            +
          </button>
          <button className="cf-btn cf-btn-sm" onClick={resetZoom} title="Reset zoom">
            100%
          </button>
          <button className="cf-btn cf-btn-sm" onClick={zoomToFit} title="Zoom to fit">
            Fit
          </button>
          {currentLine > 0 && (
            <button className="cf-btn cf-btn-sm" onClick={focusCurrent} title="Focus current node">
              📍
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <Legend />

      {/* Graph area */}
      <div
        ref={containerRef}
        className="cf-scrollbar"
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: isPanning ? 'grabbing' : 'grab',
          background: '#FAFBFC',
          backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width={svgWidth * zoom}
          height={svgHeight * zoom}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            display: 'block',
          }}
        >
          <defs>
            <GradientDefs />
            <MarkerDefs />
            {/* Shadow filters */}
            <filter id="shadow-default" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.08" />
            </filter>
            <filter id="shadow-hover" x="-10%" y="-10%" width="120%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
            {/* Pulse animation for current node */}
            <filter id="glow-current">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges (render first so nodes are on top) */}
          {cfg.edges.map((edge, i) => {
            const sourceLayout = nodeMap.get(edge.source);
            const targetLayout = nodeMap.get(edge.target);
            if (!sourceLayout || !targetLayout) return null;
            return (
              <FlowEdge
                key={`edge-${i}`}
                edge={edge}
                sourceLayout={sourceLayout}
                targetLayout={targetLayout}
                offsetX={offsetX}
                isHovered={hoveredEdge === `${edge.source}-${edge.target}`}
                onHover={setHoveredEdge}
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((ln) => {
            const isCurrent = ln.node.lineNumber === currentLine && currentLine > 0;
            return (
              <g key={ln.node.id}>
                {/* Current node pulse ring */}
                {isCurrent && (
                  <rect
                    x={ln.x + offsetX - NODE_WIDTH / 2 - 4}
                    y={ln.y + NODE_HEIGHT / 2 - NODE_HEIGHT / 2 - 4}
                    width={NODE_WIDTH + 8}
                    height={NODE_HEIGHT + 8}
                    rx={8}
                    fill="none"
                    stroke="#4A90E2"
                    strokeWidth={3}
                    opacity={0.6}
                    filter="url(#glow-current)"
                  >
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="stroke-width" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
                  </rect>
                )}
                <FlowNode
                  layout={ln}
                  offsetX={offsetX}
                  isHovered={hoveredNode === ln.node.id}
                  isSelected={selectedNode === ln.node.id}
                  onHover={setHoveredNode}
                  onClick={setSelectedNode}
                />
              </g>
            );
          })}

          {/* Tooltip */}
          {hoveredNodeLayout && (
            <Tooltip
              node={hoveredNodeLayout.node}
              x={hoveredNodeLayout.x + offsetX + NODE_WIDTH / 2}
              y={hoveredNodeLayout.y + NODE_HEIGHT / 2}
            />
          )}
        </svg>

        {/* Minimap */}
        <Minimap
          layoutNodes={layoutNodes}
          edges={cfg.edges}
          nodeMap={nodeMap}
          totalWidth={svgWidth}
          totalHeight={svgHeight}
          viewBox={viewBox}
          offsetX={offsetX}
        />
      </div>
    </div>
  );
}
