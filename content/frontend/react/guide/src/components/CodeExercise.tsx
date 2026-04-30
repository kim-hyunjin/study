import React, { useState, useEffect } from 'react';
import _Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/themes/prism-tomorrow.css';
import { CheckCircle, XCircle } from 'lucide-react';

const Editor = ((_Editor as any).default || _Editor) as any;
const { highlight, languages } = Prism;

interface CodeExerciseProps {
  initialCode: string;
  solutionRegex: RegExp;
  onSuccess: () => void;
}

export const CodeExercise = ({ initialCode, solutionRegex, onSuccess }: CodeExerciseProps) => {
  const [code, setCode] = useState(initialCode);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    setCode(initialCode);
    setIsValid(null);
  }, [initialCode]);

  const checkSolution = () => {
    const passed = solutionRegex.test(code);
    setIsValid(passed);
    if (passed) {
      onSuccess();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#2d2d2d] rounded-lg overflow-hidden border border-gray-700 shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-gray-700">
        <span className="text-xs font-mono text-gray-400">App.jsx</span>
        <button
          onClick={checkSolution}
          className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          정답 확인
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed">
        <Editor
          value={code}
          onValueChange={code => setCode(code)}
          highlight={code => highlight(code, languages.jsx || languages.js, 'jsx')}
          padding={10}
          style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 14,
            minHeight: '200px',
            backgroundColor: 'transparent',
            color: '#ccc'
          }}
          className="outline-none"
        />
      </div>

      {isValid !== null && (
        <div className={`p-3 flex items-center gap-2 text-sm font-medium ${isValid ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {isValid ? (
            <>
              <CheckCircle size={18} />
              <span>훌륭합니다! 정답입니다.</span>
            </>
          ) : (
            <>
              <XCircle size={18} />
              <span>코드를 다시 확인해보세요.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
