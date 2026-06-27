const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\2806da45-791d-45e8-aa90-73113b7e81af\\.system_generated\\logs\\transcript_full.jsonl', 'utf8').split('\n');

console.log('Search results in transcript_full.jsonl:');
lines.forEach((line, idx) => {
  if (!line) return;
  if (line.includes('capture_browser_console_logs')) {
    try {
      const obj = JSON.parse(line);
      console.log(` - Line ${idx}: Step ${obj.step_index}, Source: ${obj.source}, Type: ${obj.type}`);
    } catch (e) {
      console.log(` - Line ${idx}: (Parse Error) ${e.message}`);
    }
  }
});
