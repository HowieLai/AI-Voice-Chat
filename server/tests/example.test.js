import test from 'node:test';
import assert from 'node:assert';

process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test';

const realFetch = global.fetch;
global.fetch = async (url, options) => {
  if (typeof url === 'string' && url.startsWith('https://api.openai.com/')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] })
    };
  }
  return realFetch(url, options);
};

const app = (await import('../index.js')).default;

test('POST /chat returns stubbed response', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const res = await realFetch(`http://localhost:${port}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [] })
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.choices[0].message.content, 'ok');
  server.close();
});
