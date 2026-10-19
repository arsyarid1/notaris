import { useState } from 'react';
import { Copy, Check, Terminal, FileCode, ArrowDown } from 'lucide-react';
import { RAW_SQL_SCRIPT } from '../data/schemaData';

export default function SqlViewer() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(RAW_SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Basic syntax highlingting for display
  const highlightSql = (sql: string) => {
    const lines = sql.split('\n');
    return lines.map((line, index) => {
      // Comments
      if (line.trim().startsWith('--')) {
        return <span key={index} className="text-emerald-500 font-mono block">{line}</span>;
      }
      
      // SQL keywords highlighting
      const words = line.split(/(\s+|,|\(|\)|;)/);
      const highlightedLine = words.map((word, wordIdx) => {
        const upperWord = word.toUpperCase();
        const keywords = [
          'CREATE', 'TABLE', 'ALTER', 'POLICY', 'ON', 'FOR', 'USING', 'WITH', 'CHECK', 'DEFAULT', 'PRIMARY', 'KEY', 'REFERENCES',
          'UUID', 'VARCHAR', 'TIMESTAMP', 'WITH', 'TIME', 'ZONE', 'NOT', 'NULL', 'ENUM', 'TYPE', 'AS', 'FOREIGN', 'CASCADE', 'SET',
          'INDEX', 'TRIGGER', 'FUNCTION', 'RETURNS', 'LANGUAGE', 'SECURITY', 'DEFINER', 'BEGIN', 'END', 'IF', 'THEN', 'ELSIF',
          'RETURN', 'NEW', 'OLD', 'TG_OP', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'DELETE', 'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'IN'
        ];
        
        if (keywords.includes(upperWord)) {
          return <span key={wordIdx} className="text-amber-500 font-bold">{word}</span>;
        }
        if (word.startsWith("'") && word.endsWith("'")) {
          return <span key={wordIdx} className="text-sky-400">{word}</span>;
        }
        if (/^\d+$/.test(word)) {
          return <span key={wordIdx} className="text-purple-400">{word}</span>;
        }
        return <span key={wordIdx} className="text-slate-300">{word}</span>;
      });

      return (
        <div key={index} className="font-mono text-sm leading-6">
          <span className="text-slate-600 select-none mr-4 inline-block w-8 text-right">{index + 1}</span>
          {highlightedLine}
        </div>
      );
    });
  };

  return (
    <div id="sql-viewer-container" className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 border border-amber-500/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-slate-100 text-base">PostgreSQL DDL Script</h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">Skema DDL lengkap dengan Enums, Indeks, Kebijakan RLS, dan Audit Trigger.</p>
          </div>
        </div>
        
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all text-sm font-medium border border-slate-700"
          title="Salin SQL ke clipboard"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-400" />
              <span>Salin SQL</span>
            </>
          )}
        </button>
      </div>

      {/* SQL Code Editor Display */}
      <div className="flex-1 overflow-auto p-6 bg-slate-950 custom-scrollbar max-h-[650px]">
        <pre className="font-mono text-xs select-text selection:bg-slate-800 selection:text-white">
          {highlightSql(RAW_SQL_SCRIPT)}
        </pre>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-mono text-[10px] bg-slate-900 px-2 py-1 rounded border border-slate-800 text-amber-500">
          <FileCode className="w-3.5 h-3.5" /> UTF-8 • PostgreSQL Dialect
        </span>
        <span>Senior Production-Ready Schema</span>
      </div>
    </div>
  );
}
