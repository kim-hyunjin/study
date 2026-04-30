import { createFileRoute } from '@tanstack/react-router';
import React, { useState } from 'react';
import { lessons } from '../data/content';
import { CodeExercise } from '../components/CodeExercise';
import { JSXAnimation } from '../components/animations/JSXAnimation';
import { StateFlowAnimation } from '../components/animations/StateFlowAnimation';
import { BookOpen, Code2, PlayCircle, ChevronRight, ChevronLeft } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

function Dashboard() {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const currentLesson = lessons[currentLessonIndex];

  const handleNext = () => {
    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(prev => prev - 1);
    }
  };

  const renderAnimation = () => {
    switch (currentLesson.animationType) {
      case 'jsx-structure':
        return <JSXAnimation />;
      case 'state-flow':
        return <StateFlowAnimation />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-200 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="font-bold text-white text-xl">R</span>
          </div>
          <h1 className="font-bold text-lg tracking-tight">React Interactive Guide</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrev} 
            disabled={currentLessonIndex === 0}
            className="p-2 hover:bg-gray-800 rounded-full disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium">
            Lesson {currentLessonIndex + 1} of {lessons.length}
          </span>
          <button 
            onClick={handleNext} 
            disabled={currentLessonIndex === lessons.length - 1}
            className="p-2 hover:bg-gray-800 rounded-full disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Column: Tutorial Content */}
        <section className="flex-1 flex flex-col bg-[#161b22] rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2 bg-[#1c2128]">
            <BookOpen size={18} className="text-blue-400" />
            <h2 className="font-semibold">{currentLesson.title}</h2>
          </div>
          <div className="flex-1 overflow-auto p-8 prose prose-invert max-w-none">
            {/* Simple Markdown-like rendering using split/map for this prototype */}
            {currentLesson.content.split('\n').map((line, i) => {
              if (line.trim().startsWith('#')) {
                return <h1 key={i} className="text-2xl font-bold mb-4">{line.replace('#', '').trim()}</h1>;
              }
              if (line.trim().startsWith('**')) {
                return <p key={i} className="font-bold text-blue-300 mt-6">{line.replace(/\*\*/g, '').trim()}</p>;
              }
              return <p key={i} className="text-gray-400 mb-2 leading-relaxed">{line.trim()}</p>;
            })}
          </div>
        </section>

        {/* Right Column: Editor & Animation */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Top Half: Code Editor */}
          <section className="flex-[1.2] flex flex-col min-h-0">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Code2 size={16} className="text-green-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Editor</span>
            </div>
            <CodeExercise 
              initialCode={currentLesson.initialCode} 
              solutionRegex={currentLesson.solutionRegex}
              onSuccess={() => {}} 
            />
          </section>

          {/* Bottom Half: Animation Visualization */}
          <section className="flex-1 flex flex-col min-h-0">
            <div className="mb-2 flex items-center gap-2 px-1">
              <PlayCircle size={16} className="text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Visualization</span>
            </div>
            {renderAnimation()}
          </section>
        </div>
      </main>
    </div>
  );
}
