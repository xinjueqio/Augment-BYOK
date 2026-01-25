"use strict";

const { withTiming } = require("../../../infra/trace");
const { makeBackChatResult } = require("../../../core/protocol");
const { completeAugmentChatTextByProviderType } = require("../../../core/provider-augment-chat");
const {
  buildByokAugmentChatContext
} = require("../augment-chat");

async function byokChat({ cfg, provider, model, requestedModel, body, timeoutMs, abortSignal, upstreamCompletionURL, upstreamApiToken, requestId }) {
  const ctx = await buildByokAugmentChatContext({
    kind: "chat",
    endpoint: "/chat",
    cfg,
    provider,
    model,
    requestedModel,
    body,
    timeoutMs,
    abortSignal,
    upstreamCompletionURL,
    upstreamApiToken,
    requestId
  });
  if (ctx.empty) return makeBackChatResult("", { nodes: [] });

  const text = await withTiming(ctx.traceLabel, async () =>
    await completeAugmentChatTextByProviderType({
      type: ctx.type,
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
      model,
      req: ctx.req,
      timeoutMs,
      abortSignal,
      extraHeaders: ctx.extraHeaders,
      requestDefaults: ctx.requestDefaults
    })
  );

  const out = makeBackChatResult(text, { nodes: [] });
  if (ctx.checkpointNotFound) out.checkpoint_not_found = true;
  if (ctx.workspaceFileChunks.length) out.workspace_file_chunks = ctx.workspaceFileChunks;
  return out;
}

module.exports = { byokChat };
