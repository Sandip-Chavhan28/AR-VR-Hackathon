const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/SAMBODHIT/.gemini/antigravity-ide/brain/da23a92d-0c14-4783-b284-c5f780318084/.system_generated/logs/transcript_full.jsonl')
});

rl.on('line', (line) => {
  if (line.includes('"step_index":496')) {
    const obj = JSON.parse(line);
    fs.writeFileSync('C:/Users/SAMBODHIT/.gemini/antigravity-ide/brain/da23a92d-0c14-4783-b284-c5f780318084/scratch/prompt496.txt', obj.content);
    console.log('Successfully written prompt of length:', obj.content.length);
    process.exit(0);
  }
});
