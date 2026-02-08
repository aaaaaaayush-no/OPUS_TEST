import { useExecutionStore } from '../../store/executionStore';

function formatValue(value: unknown, depth = 0): string {
  if (depth > 3) return '...';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'function') return `ƒ ${(value as { name?: string }).name || 'anonymous'}()`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (depth > 1) return `[Array(${value.length})]`;
    const items = value.map((v) => formatValue(v, depth + 1)).join(', ');
    return `[${items}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    if (depth > 1) return `{Object(${entries.length})}`;
    const items = entries.map(([k, v]) => `${k}: ${formatValue(v, depth + 1)}`).join(', ');
    return `{${items}}`;
  }
  return String(value);
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'number': return 'text-blue-400';
    case 'string': return 'text-green-400';
    case 'boolean': return 'text-yellow-400';
    case 'null': return 'text-gray-500';
    case 'undefined': return 'text-gray-500';
    case 'function': return 'text-purple-400';
    case 'array': return 'text-cyan-400';
    case 'object': return 'text-orange-400';
    default: return 'text-gray-300';
  }
}

export default function VariablesPanel() {
  const currentSnapshot = useExecutionStore((s) => {
    const { snapshots, currentStepIndex } = s;
    if (currentStepIndex >= 0 && currentStepIndex < snapshots.length) {
      return snapshots[currentStepIndex];
    }
    return null;
  });

  if (!currentSnapshot) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Run code to see variables
      </div>
    );
  }

  const { globalVariables, callStack } = currentSnapshot;

  // Filter out built-in globals
  const builtins = new Set([
    'console', 'Math', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'undefined', 'NaN', 'Infinity', 'Array', 'Object', 'String',
    'Number', 'Boolean', 'JSON',
  ]);

  const userGlobals = Array.from(globalVariables.entries()).filter(
    ([name]) => !builtins.has(name),
  );

  return (
    <div className="p-3 text-sm overflow-auto h-full">
      {/* Local Scope (top of call stack) */}
      {callStack.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Local — {callStack[callStack.length - 1].functionName}()
          </h3>
          <div className="space-y-1">
            {Array.from(callStack[callStack.length - 1].localVariables.entries()).map(
              ([name, variable]) => (
                <div
                  key={name}
                  className={`flex items-start gap-2 px-2 py-1 rounded ${
                    variable.isNew ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30' : ''
                  }`}
                >
                  <span className="text-gray-300 font-mono">{name}</span>
                  <span className="text-gray-600">=</span>
                  <span className={`font-mono ${getTypeColor(variable.type)}`}>
                    {formatValue(variable.value)}
                  </span>
                  <span className="text-gray-600 text-xs ml-auto">{variable.type}</span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Global Scope */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
          Global Scope
        </h3>
        {userGlobals.length === 0 ? (
          <div className="text-gray-600 text-xs px-2">No user-defined globals</div>
        ) : (
          <div className="space-y-1">
            {userGlobals.map(([name, variable]) => (
              <div
                key={name}
                className={`flex items-start gap-2 px-2 py-1 rounded ${
                  variable.isNew ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30' : ''
                }`}
              >
                <span className="text-gray-300 font-mono">{name}</span>
                <span className="text-gray-600">=</span>
                <span className={`font-mono ${getTypeColor(variable.type)}`}>
                  {formatValue(variable.value)}
                </span>
                <span className="text-gray-600 text-xs ml-auto">{variable.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
