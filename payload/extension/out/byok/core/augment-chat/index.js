"use strict";

const shared = require("./shared");
const openai = require("./openai");
const openaiResponses = require("./openai-responses");
const anthropic = require("./anthropic");
const gemini = require("./gemini");

module.exports = {
  normalizeAugmentChatRequest: shared.normalizeAugmentChatRequest,
  buildSystemPrompt: shared.buildSystemPrompt,
  convertOpenAiTools: shared.convertOpenAiTools,
  convertOpenAiResponsesTools: shared.convertOpenAiResponsesTools,
  convertAnthropicTools: shared.convertAnthropicTools,
  convertGeminiTools: shared.convertGeminiTools,
  buildToolMetaByName: shared.buildToolMetaByName,
  buildOpenAiMessages: openai.buildOpenAiMessages,
  buildOpenAiResponsesInput: openaiResponses.buildOpenAiResponsesInput,
  buildAnthropicMessages: anthropic.buildAnthropicMessages,
  buildGeminiContents: gemini.buildGeminiContents
};
