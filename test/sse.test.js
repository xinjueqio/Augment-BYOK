const test = require("node:test");
const assert = require("node:assert/strict");

const { parseSse } = require("../payload/extension/out/byok/providers/sse");

async function collect(iter) {
  const out = [];
  for await (const x of iter) out.push(x);
  return out;
}

test("parseSse: basic data event", async () => {
  const resp = new Response("data: hello\n\n");
  const events = await collect(parseSse(resp));
  assert.deepEqual(events, [{ event: undefined, data: "hello" }]);
});

test("parseSse: supports event + multi-line data", async () => {
  const resp = new Response("event: msg\ndata: a\ndata: b\n\n");
  const events = await collect(parseSse(resp));
  assert.deepEqual(events, [{ event: "msg", data: "a\nb" }]);
});

test("parseSse: yields final event even without trailing blank line", async () => {
  const resp = new Response("data: last");
  const events = await collect(parseSse(resp));
  assert.deepEqual(events, [{ event: undefined, data: "last" }]);
});

