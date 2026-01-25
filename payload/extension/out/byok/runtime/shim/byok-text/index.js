"use strict";

const { completeTextByProviderType, streamTextDeltasByProviderType } = require("../../../core/provider-text");
const { providerRequestContext } = require("../common");

async function byokCompleteText({ provider, model, system, messages, timeoutMs, abortSignal }) {
  const { type, baseUrl, apiKey, extraHeaders, requestDefaults } = providerRequestContext(provider);

  return await completeTextByProviderType({ type, baseUrl, apiKey, model, system, messages, timeoutMs, abortSignal, extraHeaders, requestDefaults });
}

async function* byokStreamText({ provider, model, system, messages, timeoutMs, abortSignal }) {
  const { type, baseUrl, apiKey, extraHeaders, requestDefaults } = providerRequestContext(provider);

  yield* streamTextDeltasByProviderType({ type, baseUrl, apiKey, model, system, messages, timeoutMs, abortSignal, extraHeaders, requestDefaults });
}

module.exports = { byokCompleteText, byokStreamText };
