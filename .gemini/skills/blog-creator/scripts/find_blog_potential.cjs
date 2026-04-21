const fs = require('fs');
const path = require('path');

/**
 * 재귀적으로 파일을 탐색합니다. (glob 의존성 제거)
 */
function getFiles(dir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      // 제외 디렉토리
      if (['node_modules', '.git', 'dist', 'build', '.next', 'blog-creator'].some(d => name.includes(d))) continue;
      getFiles(name, allFiles);
    } else {
      allFiles.push(name);
    }
  }
  return allFiles;
}

function findPotentialFiles(rootDir) {
  const extensions = ['.md', '.js', '.ts', '.py', '.go', '.java', '.cpp', '.ipynb'];
  const files = getFiles(rootDir);
  const potentials = [];

  for (const fullPath of files) {
    const relativePath = path.relative(rootDir, fullPath);
    const stats = fs.statSync(fullPath);
    
    // 확장자 체크
    if (!extensions.some(ext => fullPath.endsWith(ext))) continue;
    // 너무 작은 파일 제외 (100바이트 미만)
    if (stats.size < 100) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    let score = 0;
    const reasons = [];

    // 1. 노트/학습 기록 여부
    if (relativePath.includes('note/') || relativePath.toLowerCase().includes('learning')) {
      score += 50;
      reasons.push('학습 노트');
    }

    // 2. 파일 크기 (정보량)
    if (stats.size > 5000) {
      score += 20;
      reasons.push('상세한 내용');
    }

    // 3. 특정 키워드 포함
    const keywords = ['TODO', 'NOTE', 'BLOG', '구현', '설계', '핵심'];
    keywords.forEach(kw => {
      if (content.includes(kw)) {
        score += 10;
        reasons.push(`${kw} 키워드 포함`);
      }
    });

    // 4. README 파일
    if (relativePath.toLowerCase().endsWith('readme.md')) {
      score += 30;
      reasons.push('프로젝트 개요');
    }

    // 5. 최근 수정 여부 (7일 이내)
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (stats.mtimeMs > oneWeekAgo) {
      score += 15;
      reasons.push('최근 작업');
    }

    if (score > 40) {
      potentials.push({
        file: relativePath,
        score,
        reasons: [...new Set(reasons)].slice(0, 3),
      });
    }
  }

  return potentials.sort((a, b) => b.score - a.score).slice(0, 15);
}

const root = process.argv[2] || process.cwd();
const results = findPotentialFiles(root);

console.log('--- 📝 블로그 글감 후보 (Top 15) ---');
results.forEach((res, i) => {
  console.log(`${i + 1}. [${res.score}점] ${res.file} (${res.reasons.join(', ')})`);
});
