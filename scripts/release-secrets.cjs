const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('backend/.env'));
const secrets = [env.DATABASE_URL, env.GEMINI_API_KEY].filter(Boolean);
if (env.DATABASE_URL) {
  const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
  if (password.length >= 8) secrets.push(password);
}
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0').filter((file) => file && fs.existsSync(file));
const prohibitedEnvFiles = files.filter((file) => /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example'));
const sourceLeaks = [];
for (const file of files) {
  if (/\.(png|jpg|zip)$/.test(file)) continue;
  const contents = fs.readFileSync(file, 'utf8');
  if (secrets.some((secret) => contents.includes(secret))) sourceLeaks.push(file);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
const bundleLeaks = [];
for (const file of walk('frontend/dist')) {
  const contents = fs.readFileSync(file, 'utf8');
  if (secrets.some((secret) => contents.includes(secret)) || /DATABASE_URL|GEMINI_API_KEY|postgresql:\/\//.test(contents)) bundleLeaks.push(file);
}
const result = {
  scope: 'Current tracked and nonignored submission files plus frontend/dist; configured values are compared without printing them. Not a complete historical or third-party secret audit.',
  prohibitedEnvFiles, sourceLeaks, bundleLeaks,
  decision: prohibitedEnvFiles.length + sourceLeaks.length + bundleLeaks.length === 0 ? 'PASS' : 'FAIL'
};
fs.writeFileSync('docs/release/evidence/secrets-check.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (result.decision === 'FAIL') process.exitCode = 1;
