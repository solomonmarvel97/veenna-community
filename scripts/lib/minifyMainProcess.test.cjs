'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { minifyMainProcess } = require('./minifyMainProcess.cjs');

function makeElectronDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'minify-main-'));
  const dir = path.join(root, 'electron');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'node_modules', 'dep'), { recursive: true });
  return { root, dir };
}

test('minifies sources in place and the result still runs the same', () => {
  const { root, dir } = makeElectronDir();
  const commented = [
    "'use strict';",
    '// a comment that should not ship',
    'function addNumbers(firstNumber, secondNumber) {',
    '  const total = firstNumber + secondNumber;',
    '  return total;',
    '}',
    'module.exports = { addNumbers };',
    '',
  ].join('\n');
  const file = path.join(dir, 'lib', 'math.cjs');
  fs.writeFileSync(file, commented);

  const result = minifyMainProcess(dir);

  assert.strictEqual(result.files, 1);
  assert.ok(result.bytesAfter < result.bytesBefore);
  const shipped = fs.readFileSync(file, 'utf8');
  assert.ok(!shipped.includes('a comment that should not ship'));
  assert.ok(!shipped.includes('firstNumber'));
  assert.strictEqual(require(file).addNumbers(2, 3), 5);
  assert.strictEqual(require(file).addNumbers.name, 'addNumbers');
  fs.rmSync(root, { recursive: true, force: true });
});

test('leaves tests and node_modules untouched', () => {
  const { root, dir } = makeElectronDir();
  const testFile = path.join(dir, 'lib', 'thing.test.cjs');
  const depFile = path.join(dir, 'node_modules', 'dep', 'index.js');
  const body = '// keep me\nmodule.exports = 1;\n';
  fs.writeFileSync(testFile, body);
  fs.writeFileSync(depFile, body);

  const result = minifyMainProcess(dir);

  assert.strictEqual(result.files, 0);
  assert.strictEqual(fs.readFileSync(testFile, 'utf8'), body);
  assert.strictEqual(fs.readFileSync(depFile, 'utf8'), body);
  fs.rmSync(root, { recursive: true, force: true });
});

test('names the file when a source cannot be parsed', () => {
  const { root, dir } = makeElectronDir();
  fs.writeFileSync(path.join(dir, 'broken.cjs'), 'function (');
  assert.throws(() => minifyMainProcess(dir), /broken\.cjs/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('fails loudly when the electron folder is missing from the bundle', () => {
  assert.throws(() => minifyMainProcess(path.join(os.tmpdir(), 'no-such-electron-dir')), /missing from the bundle/);
});
