'use strict';

// Minimal, dependency-free tests for the non-destructive merge logic.
const assert = require('assert');
const { mergeConfVars, mergeConfig, parseJsonField } = require('../lib/kaltura');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('  ✓ ' + name);
}

console.log('mergeConfVars');
t('adds plugin to empty confVars', () => {
  const { confVars, changed } = mergeConfVars('');
  assert.strictEqual(confVars.versions['playkit-annoto-loader'], '{latest}');
  assert.strictEqual(changed, true);
});
t('preserves existing versions and langs', () => {
  const existing = JSON.stringify({ versions: { 'playkit-kava': '{latest}' }, langs: ['en'] });
  const { confVars } = mergeConfVars(existing);
  assert.strictEqual(confVars.versions['playkit-kava'], '{latest}');
  assert.strictEqual(confVars.versions['playkit-annoto-loader'], '{latest}');
  assert.deepStrictEqual(confVars.langs, ['en']);
});
t('reports no change when already present with same version', () => {
  const existing = JSON.stringify({ versions: { 'playkit-annoto-loader': '{latest}' } });
  const { changed, before } = mergeConfVars(existing);
  assert.strictEqual(before, '{latest}');
  assert.strictEqual(changed, false);
});
t('honors a pinned version', () => {
  const { confVars } = mergeConfVars('', { version: '1.0.1' });
  assert.strictEqual(confVars.versions['playkit-annoto-loader'], '1.0.1');
});
t('throws on invalid existing confVars JSON (no clobber)', () => {
  assert.throws(() => mergeConfVars('{not json'), /not valid JSON/);
});

console.log('mergeConfig');
t('adds annoto-loader plugin config to empty config', () => {
  const { config } = mergeConfig('', { clientId: 'KEY', region: 'eu' });
  assert.deepStrictEqual(config.plugins['annoto-loader'], { clientId: 'KEY', region: 'eu' });
});
t('preserves other plugins and top-level config keys', () => {
  const existing = JSON.stringify({ playback: { autoplay: true }, plugins: { kava: { x: 1 } } });
  const { config } = mergeConfig(existing, { clientId: 'KEY', region: 'us' });
  assert.deepStrictEqual(config.playback, { autoplay: true });
  assert.deepStrictEqual(config.plugins.kava, { x: 1 });
  assert.deepStrictEqual(config.plugins['annoto-loader'], { clientId: 'KEY', region: 'us' });
});
t('merges into an existing annoto-loader config without dropping extra keys', () => {
  const existing = JSON.stringify({ plugins: { 'annoto-loader': { clientId: 'OLD', theme: 'dark' } } });
  const { config } = mergeConfig(existing, { clientId: 'NEW', region: 'eu' });
  assert.deepStrictEqual(config.plugins['annoto-loader'], { clientId: 'NEW', theme: 'dark', region: 'eu' });
});
t('throws on invalid existing config JSON (no clobber)', () => {
  assert.throws(() => mergeConfig('{bad', { clientId: 'K' }), /not valid JSON/);
});

console.log('parseJsonField');
t('empty string → {}', () => assert.deepStrictEqual(parseJsonField('', 'x'), {}));
t('passes objects through', () => assert.deepStrictEqual(parseJsonField({ a: 1 }, 'x'), { a: 1 }));

console.log('\nAll ' + passed + ' tests passed.');
