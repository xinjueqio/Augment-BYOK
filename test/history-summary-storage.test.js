const test = require("node:test");
const assert = require("node:assert/strict");

const {
  setHistorySummaryStorage,
  deleteHistorySummaryCache,
  clearHistorySummaryCacheAll
} = require("../payload/extension/out/byok/core/augment-history-summary/auto");

test("historySummary: storage injection persists delete/clear to storage", async () => {
  const store = new Map();
  const storage = {
    get: (k) => store.get(k),
    update: async (k, v) => {
      store.set(k, v);
    }
  };

  store.set("augment-byok.historySummaryCache.v1", {
    version: 1,
    entries: {
      conv1: { summaryText: "s1", summarizedUntilRequestId: "r1", updatedAtMs: 123 },
      conv2: { summaryText: "s2", summarizedUntilRequestId: "r2", updatedAtMs: 456 }
    }
  });

  assert.equal(setHistorySummaryStorage(storage), true);

  const deleted = await deleteHistorySummaryCache("conv1");
  assert.equal(deleted, true);

  const afterDelete = store.get("augment-byok.historySummaryCache.v1");
  assert.ok(afterDelete && typeof afterDelete === "object");
  assert.ok(afterDelete.entries && typeof afterDelete.entries === "object");
  assert.ok(!Object.prototype.hasOwnProperty.call(afterDelete.entries, "conv1"));
  assert.ok(Object.prototype.hasOwnProperty.call(afterDelete.entries, "conv2"));

  const cleared = await clearHistorySummaryCacheAll();
  assert.equal(cleared, 1);

  const afterClear = store.get("augment-byok.historySummaryCache.v1");
  assert.ok(afterClear && typeof afterClear === "object");
  assert.deepEqual(afterClear.entries, {});
});
