import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toBase64Url,
  buildBlueprint,
  buildPreviewUrl,
  buildCommentBody,
  buildDescriptionBlock,
  computeNextDescriptionBody,
  removeDescriptionBlock,
  descriptionBlockPattern,
  parseJsonInput,
  parseOptionalBoolean,
} from '../lib.js';

test('toBase64Url produces valid base64url (no +, /, or = chars)', () => {
  const input = '{"test":"hello world+/="}';
  const result = toBase64Url(input);
  assert.ok(!result.includes('+'), 'must not contain +');
  assert.ok(!result.includes('/'), 'must not contain /');
  assert.ok(!result.includes('='), 'must not contain =');
  // Verify round-trip
  const decoded = Buffer.from(result.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert.equal(decoded, input);
});

test('toBase64Url strips padding from base64', () => {
  // 'a' encodes to 'YQ==' in standard base64, must be 'YQ' in base64url
  assert.equal(toBase64Url('a'), 'YQ');
});

test('buildBlueprint returns correct structure', () => {
  const bp = buildBlueprint(
    'https://example.com/plugin.zip',
    'Test Title',
    'test-author',
    'Test description'
  );
  assert.deepEqual(bp, {
    meta: {
      title: 'Test Title',
      author: 'test-author',
      description: 'Test description',
    },
    plugins: ['https://example.com/plugin.zip'],
  });
});

test('buildBlueprint adds optional sections, deduplicates plugins, and keeps unset sections out', () => {
  const bp = buildBlueprint(
    'https://example.com/plugin.zip',
    'Test Title',
    'test-author',
    'Test description',
    {
      extraPlugins: [
        'PluginA',
        ' https://example.com/plugin.zip ',
        'PluginB',
        'PluginA',
      ],
      seed: {
        customers: [{ codcliente: 'CDEMO1', nombre: 'Cliente Demo' }],
      },
      landingPage: '/admin',
      debugEnabled: true,
      siteTitle: 'Demo Site',
      siteLocale: 'es_ES',
      loginUsername: 'admin',
    }
  );

  assert.deepEqual(bp, {
    meta: {
      title: 'Test Title',
      author: 'test-author',
      description: 'Test description',
    },
    plugins: [
      'https://example.com/plugin.zip',
      'PluginA',
      'PluginB',
    ],
    landingPage: '/admin',
    debug: {
      enabled: true,
    },
    siteOptions: {
      title: 'Demo Site',
      locale: 'es_ES',
    },
    login: {
      username: 'admin',
    },
    seed: {
      customers: [{ codcliente: 'CDEMO1', nombre: 'Cliente Demo' }],
    },
  });

  assert.equal('timezone' in bp.siteOptions, false);
});

test('buildBlueprint applies blueprint override last and still deduplicates plugins', () => {
  const bp = buildBlueprint(
    'https://example.com/plugin.zip',
    'Generated Title',
    'generated-author',
    'Generated description',
    {
      extraPlugins: ['PluginA'],
      debugEnabled: true,
      blueprintOverride: {
        meta: {
          title: 'Override Title',
        },
        debug: {
          enabled: false,
        },
        siteOptions: {
          timezone: 'Europe/Madrid',
        },
        plugins: ['PluginA', 'PluginA', 'PluginB'],
      },
    }
  );

  assert.deepEqual(bp, {
    meta: {
      title: 'Override Title',
      author: 'generated-author',
      description: 'Generated description',
    },
    debug: {
      enabled: false,
    },
    siteOptions: {
      timezone: 'Europe/Madrid',
    },
    plugins: ['PluginA', 'PluginB'],
  });
});

test('buildBlueprint rejects non-string plugin entries', () => {
  assert.throws(
    () =>
      buildBlueprint(
        'https://example.com/plugin.zip',
        'Generated Title',
        'generated-author',
        'Generated description',
        {
          extraPlugins: ['PluginA', 123],
        }
      ),
    /Each entry in "extra-plugins" must be a string/
  );

  assert.throws(
    () =>
      buildBlueprint(
        'https://example.com/plugin.zip',
        'Generated Title',
        'generated-author',
        'Generated description',
        {
          blueprintOverride: {
            plugins: ['PluginA', false],
          },
        }
      ),
    /Each entry in "blueprint-json.plugins" must be a string/
  );
});

test('parseJsonInput validates JSON types', () => {
  assert.deepEqual(
    parseJsonInput('extra-plugins', '["PluginA"]', 'array'),
    ['PluginA']
  );
  assert.deepEqual(
    parseJsonInput('seed-json', '{"customers":[]}', 'object'),
    { customers: [] }
  );
  assert.equal(parseJsonInput('seed-json', '', 'object'), undefined);
  assert.throws(
    () => parseJsonInput('extra-plugins', '{"plugin":"A"}', 'array'),
    /must be a JSON array/
  );
  assert.throws(
    () => parseJsonInput('seed-json', '[1,2,3]', 'object'),
    /must be a JSON object/
  );
});

test('parseOptionalBoolean accepts common boolean forms and rejects invalid values', () => {
  assert.equal(parseOptionalBoolean('true', 'debug-enabled'), true);
  assert.equal(parseOptionalBoolean('OFF', 'debug-enabled'), false);
  assert.equal(parseOptionalBoolean('', 'debug-enabled'), undefined);
  assert.throws(
    () => parseOptionalBoolean('maybe', 'debug-enabled'),
    /must be a boolean value/
  );
});

test('buildPreviewUrl appends blueprint-data query param', () => {
  const json = '{"meta":{},"plugins":["https://example.com/plugin.zip"]}';
  const url = buildPreviewUrl('https://erseco.github.io/facturascripts-playground/', json);
  assert.ok(url.startsWith('https://erseco.github.io/facturascripts-playground/'), 'starts with playground URL');
  assert.ok(url.includes('?blueprint-data='), 'contains blueprint-data param');
  // Must not contain raw base64 special chars
  const encoded = url.split('?blueprint-data=')[1];
  assert.ok(!encoded.includes('+'), 'encoded must not contain +');
  assert.ok(!encoded.includes('/'), 'encoded must not contain /');
  assert.ok(!encoded.includes('='), 'encoded must not contain =');
});

test('buildPreviewUrl appends trailing slash to playground URL if missing', () => {
  const json = '{"test":1}';
  const url = buildPreviewUrl('https://erseco.github.io/facturascripts-playground', json);
  assert.ok(url.startsWith('https://erseco.github.io/facturascripts-playground/'), 'trailing slash added');
});

test('buildCommentBody contains marker, URL, and image', () => {
  const marker = 'facturascripts-playground-preview';
  const previewUrl = 'https://erseco.github.io/facturascripts-playground/?blueprint-data=abc123';
  const imageUrl = 'https://example.com/logo.png';
  const body = buildCommentBody(marker, previewUrl, imageUrl);
  assert.ok(body.includes(`<!-- ${marker} -->`), 'contains hidden marker');
  assert.ok(body.includes(previewUrl), 'contains preview URL');
  assert.ok(body.includes(imageUrl), 'contains image URL');
});

test('buildCommentBody appends extra-text when provided', () => {
  const body = buildCommentBody(
    'facturascripts-playground-preview',
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png',
    'Test the **invoicing** flow.'
  );
  assert.ok(body.endsWith('Test the **invoicing** flow.'), 'extra-text is appended verbatim');
});

test('buildCommentBody ignores empty extra-text', () => {
  const body = buildCommentBody(
    'facturascripts-playground-preview',
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png',
    '   '
  );
  assert.ok(body.endsWith('This preview was generated automatically from the PR branch ZIP.'));
});

test('buildDescriptionBlock wraps content with :start and :end markers', () => {
  const marker = 'facturascripts-playground-preview';
  const block = buildDescriptionBlock(
    marker,
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png'
  );
  assert.ok(block.startsWith(`<!-- ${marker}:start -->`), 'starts with :start marker');
  assert.ok(block.endsWith(`<!-- ${marker}:end -->`), 'ends with :end marker');
  assert.ok(block.includes('FacturaScripts Playground Preview'), 'contains title');
});

test('descriptionBlockPattern matches the managed block including trailing whitespace', () => {
  const marker = 'facturascripts-playground-preview';
  const block = buildDescriptionBlock(
    marker,
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png'
  );
  const wrapped = `Hello\n\n${block}\n\nGoodbye`;
  const pattern = descriptionBlockPattern(marker);
  const match = wrapped.match(pattern);
  assert.ok(match, 'pattern matched the block');
  assert.ok(match[0].includes(':end -->'), 'capture spans end marker');
});

test('computeNextDescriptionBody appends the block when markers are missing', () => {
  const block = buildDescriptionBlock(
    'facturascripts-playground-preview',
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png'
  );
  const result = computeNextDescriptionBody(
    'PR body here.',
    'facturascripts-playground-preview',
    block
  );
  assert.ok(result.startsWith('PR body here.'), 'preserves original body');
  assert.ok(result.endsWith('<!-- facturascripts-playground-preview:end -->'));
});

test('computeNextDescriptionBody replaces an existing managed block', () => {
  const marker = 'facturascripts-playground-preview';
  const oldBlock = buildDescriptionBlock(
    marker,
    'https://example.com/?blueprint-data=OLD',
    'https://example.com/logo.png'
  );
  const newBlock = buildDescriptionBlock(
    marker,
    'https://example.com/?blueprint-data=NEW',
    'https://example.com/logo.png'
  );
  const next = computeNextDescriptionBody(
    `Top text\n\n${oldBlock}\n\nBottom text`,
    marker,
    newBlock
  );
  assert.ok(next.includes('blueprint-data=NEW'), 'updated to new payload');
  assert.ok(!next.includes('blueprint-data=OLD'), 'removed old payload');
  assert.ok(next.startsWith('Top text'), 'preserved leading text');
  assert.ok(next.endsWith('Bottom text'), 'preserved trailing text');
});

test('computeNextDescriptionBody returns null when user replaced the block with placeholder text', () => {
  const marker = 'facturascripts-playground-preview';
  const userBody = `<!-- ${marker}:start -->\nI removed the button on purpose.\n<!-- ${marker}:end -->`;
  const block = buildDescriptionBlock(
    marker,
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png'
  );
  assert.equal(computeNextDescriptionBody(userBody, marker, block), null);
});

test('computeNextDescriptionBody returns null when markers absent and restore disabled', () => {
  const marker = 'facturascripts-playground-preview';
  const block = buildDescriptionBlock(
    marker,
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png'
  );
  assert.equal(
    computeNextDescriptionBody('Plain PR body', marker, block, {
      restoreIfRemoved: false,
    }),
    null
  );
});

test('removeDescriptionBlock strips the managed block but leaves rest intact', () => {
  const marker = 'facturascripts-playground-preview';
  const block = buildDescriptionBlock(
    marker,
    'https://example.com/?blueprint-data=abc',
    'https://example.com/logo.png'
  );
  const body = `Intro\n\n${block}\n\nOutro`;
  const stripped = removeDescriptionBlock(body, marker);
  assert.ok(!stripped.includes(':start -->'), 'start marker removed');
  assert.ok(!stripped.includes(':end -->'), 'end marker removed');
  assert.ok(stripped.includes('Intro'), 'intro preserved');
  assert.ok(stripped.includes('Outro'), 'outro preserved');
});

test('removeDescriptionBlock is a no-op when markers are absent', () => {
  assert.equal(
    removeDescriptionBlock('Just a plain body', 'facturascripts-playground-preview'),
    'Just a plain body'
  );
});
