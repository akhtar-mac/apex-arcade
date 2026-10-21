import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const untracked = execFileSync('git', ['ls-files', '-z', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const files = [...tracked, ...untracked];

const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bsk_live_[A-Za-z0-9]{16,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/
];

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.test(content)) findings.push(`${file}: ${pattern}`);
  }
}

if (findings.length > 0) {
  console.error('Potential committed secrets found:\n' + findings.join('\n'));
  process.exit(1);
}

console.log(`Secret scan passed across ${files.length} tracked and untracked files (${tracked.length} tracked).`);
