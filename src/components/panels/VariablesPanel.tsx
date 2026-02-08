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

function getTypeClass(type: string): string {
  switch (type) {
    case 'number': return 'cf-val-number';
    case 'string': return 'cf-val-string';
    case 'boolean': return 'cf-val-boolean';
    case 'null':
    case 'undefined': return 'cf-val-null';
    case 'function': return 'cf-val-function';
    default: return 'cf-val-object';
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
      <div className="cf-panel-content" style={{ color: 'var(--text-muted)' }}>
        Run code to see variables
      </div>
    );
  }

  const { globalVariables, callStack } = currentSnapshot;

  const builtins = new Set([
    'console', 'Math', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'undefined', 'NaN', 'Infinity', 'Array', 'Object', 'String',
    'Number', 'Boolean', 'JSON',
  ]);

  const userGlobals = Array.from(globalVariables.entries()).filter(
    ([name]) => !builtins.has(name),
  );

  return (
    <div className="cf-panel-content cf-scrollbar" style={{ overflow: 'auto' }}>
      {/* Local Scope */}
      {callStack.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            📦 Local — {callStack[callStack.length - 1].functionName}()
          </div>
          <table className="cf-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(callStack[callStack.length - 1].localVariables.entries()).map(
                ([name, variable]) => (
                  <tr key={name} style={variable.isNew ? { background: 'var(--accent-warning-light)' } : {}}>
                    <td style={{ fontFamily: 'var(--font-code)', fontWeight: 500 }}>{name}</td>
                    <td style={{ fontFamily: 'var(--font-code)' }} className={getTypeClass(variable.type)}>
                      {formatValue(variable.value)}
                    </td>
                    <td>
                      <span className="cf-badge cf-badge-blue">{variable.type}</span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Global Scope */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          🌐 Global Scope
        </div>
        {userGlobals.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '4px 8px' }}>No user-defined globals</div>
        ) : (
          <table className="cf-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {userGlobals.map(([name, variable]) => (
                <tr key={name} style={variable.isNew ? { background: 'var(--accent-warning-light)' } : {}}>
                  <td style={{ fontFamily: 'var(--font-code)', fontWeight: 500 }}>{name}</td>
                  <td style={{ fontFamily: 'var(--font-code)' }} className={getTypeClass(variable.type)}>
                    {formatValue(variable.value)}
                  </td>
                  <td>
                    <span className="cf-badge cf-badge-blue">{variable.type}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
