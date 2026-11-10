'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { classifyOutboundUrl } = require('./outboundUrl.cjs')

test('http(s) goes to the in-app browser', () => {
  assert.equal(classifyOutboundUrl('https://example.com/x'), 'browser')
  assert.equal(classifyOutboundUrl('http://localhost:4173/'), 'browser')
})

test('mailto stays on the OS handler', () => {
  assert.equal(classifyOutboundUrl('mailto:hi@example.com'), 'external')
})

test('the app scheme and about:blank stay in the window', () => {
  assert.equal(classifyOutboundUrl('veenna-community://index.html'), 'app')
  assert.equal(classifyOutboundUrl('about:blank'), 'app')
})

test('the vite dev origin stays in the window', () => {
  assert.equal(
    classifyOutboundUrl('http://localhost:3020/tasks', {
      loadViteDevServer: true,
      viteDevServerUrl: 'http://localhost:3020',
    }),
    'app',
  )
})

test('file and javascript are blocked', () => {
  assert.equal(classifyOutboundUrl('file:///etc/passwd'), 'block')
  assert.equal(classifyOutboundUrl('javascript:alert(1)'), 'block')
})
