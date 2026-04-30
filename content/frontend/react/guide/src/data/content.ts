export type Lesson = {
  id: string;
  title: string;
  content: string;
  initialCode: string;
  solutionRegex: RegExp;
  animationType: 'jsx-structure' | 'state-flow' | 'render-cycle';
};

export const lessons: Lesson[] = [
  {
    id: 'hello-react',
    title: 'Hello React',
    content: `
      # Hello React
      React는 UI를 만들기 위한 자바스크립트 라이브러리입니다. 
      JSX라는 문법을 사용하여 HTML과 비슷한 구조를 자바스크립트 내에서 작성할 수 있습니다.
      
      **문제:** 아래 에디터에서 h1 태그 안에 "Hello React"라고 적어보세요.
    `,
    initialCode: 'function App() {\n  return (\n    <div>\n      <h1></h1>\n    </div>\n  );\n}',
    solutionRegex: /<h1>\s*Hello React\s*<\/h1>/,
    animationType: 'jsx-structure',
  },
  {
    id: 'usestate-basic',
    title: 'State & Events',
    content: `
      # State & Events
      리액트에서 데이터의 상태를 관리할 때는 \`useState\` 훅을 사용합니다.
      버튼을 클릭했을 때 숫자가 증가하도록 만들어봅시다.
      
      **문제:** onClick 이벤트 핸들러에 count를 1씩 증가시키는 함수를 작성하세요.
    `,
    initialCode: 'function Counter() {\n  const [count, setCount] = React.useState(0);\n  return (\n    <button onClick={() => {}}>\n      Count: {count}\n    </button>\n  );\n}',
    solutionRegex: /setCount\(\s*(count\s*\+\s*1|c\s*=>\s*c\s*\+\s*1)\s*\)/,
    animationType: 'state-flow',
  },
];
