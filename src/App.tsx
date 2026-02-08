import { useState } from 'react';
import CodeEditor from './components/CodeEditor';
import Controls from './components/Controls';
import VariablesPanel from './components/panels/VariablesPanel';
import CallStackPanel from './components/panels/CallStackPanel';
import ConsolePanel from './components/panels/ConsolePanel';
import TimelinePanel from './components/panels/TimelinePanel';

type PanelTab = 'variables' | 'callstack' | 'console' | 'timeline';

export default function App() {
  const [activeTab, setActiveTab] = useState<PanelTab>('variables');

  const tabs: { id: PanelTab; label: string; icon: string }[] = [
    { id: 'variables', label: 'Variables', icon: '📊' },
    { id: 'callstack', label: 'Call Stack', icon: '📚' },
    { id: 'console', label: 'Console', icon: '💻' },
    { id: 'timeline', label: 'Timeline', icon: '⏱️' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-3">
        <h1 className="text-lg font-bold text-blue-400">⚡ Code Visualizer</h1>
        <span className="text-gray-500 text-xs">Real-time JavaScript execution visualization</span>
      </header>

      {/* Controls */}
      <Controls />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Code Editor - Left Panel */}
        <div className="w-2/5 border-r border-gray-700 flex flex-col min-h-0">
          <CodeEditor />
        </div>

        {/* Visualization Panels - Right Panel */}
        <div className="w-3/5 flex flex-col min-h-0">
          {/* Panel Tabs */}
          <div className="flex bg-gray-800 border-b border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Panel Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'variables' && <VariablesPanel />}
            {activeTab === 'callstack' && <CallStackPanel />}
            {activeTab === 'console' && <ConsolePanel />}
            {activeTab === 'timeline' && <TimelinePanel />}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-1 flex items-center gap-4 text-xs text-gray-500">
        <span>JavaScript • ES2022</span>
        <span>|</span>
        <span>Code Visualizer v1.0.0</span>
      </footer>
    </div>
  );
}
