const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci-pipeline.yml'), 'utf8');
const finalGate = workflow.split('  pipeline-gate:')[1];

test('final CI gate inspects dependency results instead of announcing a false pass', () => {
  assert.match(finalGate, /toJSON\(needs\)/);
  assert.match(finalGate, /failure|cancelled|skipped/);
  assert.doesNotMatch(finalGate, /Status: ALL GATES PASSED/);
});
