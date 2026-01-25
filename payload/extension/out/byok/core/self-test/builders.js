"use strict";

const { normalizeString } = require("../../infra/util");
const { REQUEST_NODE_IMAGE, REQUEST_NODE_TOOL_RESULT, TOOL_RESULT_CONTENT_TEXT } = require("../augment-protocol");

function onePixelPngBase64() {
  // 1x1 png (RGBA). 用于多模态链路连通性测试。
  // 旧的灰度+alpha PNG 在少数网关/上游解码器中会被误判为“invalid image”，这里改为最通用的 RGBA。
  return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
}

function makeSelfTestToolDefinitions() {
  return [
    {
      name: "echo_self_test",
      description: "BYOK self-test tool. Echo back the input.",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string" }
        }
      }
    }
  ];
}

function makeToolResultNode({ id, toolUseId, contentText, isError }) {
  const nodeIdNum = Number(id);
  const nodeId = Number.isFinite(nodeIdNum) && nodeIdNum > 0 ? Math.floor(nodeIdNum) : 1;
  return {
    id: nodeId,
    type: REQUEST_NODE_TOOL_RESULT,
    content: "",
    tool_result_node: {
      tool_use_id: String(toolUseId || ""),
      content: String(contentText || ""),
      is_error: Boolean(isError),
      content_nodes: [
        {
          type: TOOL_RESULT_CONTENT_TEXT,
          text_content: String(contentText || "")
        }
      ]
    }
  };
}

function makeImageNode() {
  return {
    id: 1,
    type: REQUEST_NODE_IMAGE,
    content: "",
    image_node: {
      // format=0 → 默认为 image/png
      format: 0,
      image_data: onePixelPngBase64()
    }
  };
}

function makeBaseAugmentChatRequest({ message, conversationId, toolDefinitions, nodes, chatHistory } = {}) {
  return {
    message: typeof message === "string" ? message : "",
    conversation_id: normalizeString(conversationId) || "",
    chat_history: Array.isArray(chatHistory) ? chatHistory : [],
    tool_definitions: Array.isArray(toolDefinitions) ? toolDefinitions : [],
    nodes: Array.isArray(nodes) ? nodes : [],
    structured_request_nodes: [],
    request_nodes: [],
    agent_memories: "",
    mode: "AGENT",
    prefix: "",
    selected_code: "",
    disable_selected_code_details: false,
    suffix: "",
    diff: "",
    lang: "",
    path: "",
    user_guidelines: "",
    workspace_guidelines: "",
    persona_type: 0,
    silent: false,
    canvas_id: "",
    request_id_override: "",
    rules: null,
    feature_detection_flags: {}
  };
}

module.exports = { makeSelfTestToolDefinitions, makeToolResultNode, makeImageNode, makeBaseAugmentChatRequest };

