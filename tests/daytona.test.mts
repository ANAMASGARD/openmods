import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
class NotFound extends Error {}
let failInit = false;
let missing = false;
let started = 0;
let deleted = 0;
let options: unknown;
const sandbox = {
  id: 'sandbox-test', state: 'stopped', labels: { project: 'openmods', environment: 'development' },
  start: async () => { started++; },
  process: { executeCommand: async () => ({ exitCode: failInit ? 1 : 0 }) },
  computerUse: { getStatus: async () => ({ status: 'active' }), start: async () => {} },
  getSignedPreviewUrl: async () => ({ url: 'https://desktop.example/?token=test' }),
};
mock.module(require.resolve('@daytona/sdk'), { namedExports: {
  DaytonaNotFoundError: NotFound, DaytonaConflictError: class extends Error {},
  Daytona: class {
    async create(input: unknown) { options = input; return sandbox; }
    async get() { if (missing) throw new NotFound(); return sandbox; }
    async delete() { deleted++; }
  },
} });
process.env.DAYTONA_API_KEY = 'test-only';
process.env.OPENMODS_ENV = 'development';
const api = await import('../lib/daytona');
test('provisioning persists sandbox and cleans up failed memory initialization', async () => {
  assert.equal(await api.createBotSandbox('bot-1'), 'sandbox-test');
  assert.deepEqual(options, { labels: { project: 'openmods', environment: 'development', botId: 'bot-1' }, autoStopInterval: 15, autoDeleteInterval: -1 });
  failInit = true;
  await assert.rejects(api.createBotSandbox('bot-2'));
  assert.equal(deleted, 1);
  failInit = false;
});
test('access restarts stopped sandbox and refuses foreign environment', async () => {
  await api.getBotSandbox('sandbox-test');
  assert.equal(started, 1);
  sandbox.labels.environment = 'production';
  await assert.rejects(api.getBotSandbox('sandbox-test'));
  assert.equal(started, 1);
  sandbox.labels.environment = 'development';
});
test('desktop preserves signed URL and returns expiration', async () => {
  const before = Date.now();
  const connection = await api.getBotDesktopConnection('sandbox-test');
  assert.equal(connection.url, 'wss://desktop.example/websockify?token=test');
  assert.ok(connection.expiresAt >= before + 3600000);
});
test('delete is idempotent for missing sandbox', async () => {
  missing = true;
  await api.deleteBotSandbox('sandbox-test');
  missing = false;
  await api.deleteBotSandbox('sandbox-test');
  assert.equal(deleted, 2);
});
