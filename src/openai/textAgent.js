import fetch from "node-fetch";
import { CONFIG } from "../config.js";
import { TOOL_DEFS, runToolCall } from "../agent/tools.js";
import { buildSystemPrompt } from "../agent/systemPromptRu.js";

export async function respondText({ userId, channel, userText, phone }) {
  const system = buildSystemPrompt();

  const baseInput = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Канал: ${channel}. Телефон: ${phone || "неизвестно"}\nСообщение: ${userText}`,
    },
  ];

  let resp = await callOpenAI({
    input: baseInput,
    previous_response_id: undefined,
    tool_outputs: undefined,
  });

  while (true) {
    const toolCalls = extractToolCalls(resp);
    if (!toolCalls.length) break;

    const tool_outputs = [];
    for (const tc of toolCalls) {
      const id = tc.id || tc.call_id; // поддержка разных форматов
      const name = tc.function?.name || tc.name;
      const argsRaw = tc.function?.arguments || tc.arguments || "{}";

      let args = {};
      try {
        args = JSON.parse(argsRaw);
      } catch {
        args = {};
      }

      const result = await runToolCall(name, args);

      // Для /v1/responses часто ждёт tool_call_id, поэтому оставляем его
      tool_outputs.push({
        tool_call_id: id,
        output: JSON.stringify(result),
      });
    }

    resp = await callOpenAI({
      input: baseInput,
      previous_response_id: resp.id,
      tool_outputs,
    });
  }

  return extractText(resp) || "Извините, не получилось ответить. Повторите, пожалуйста.";
}

async function callOpenAI({ input, previous_response_id, tool_outputs }) {
  // ВАЖНО: нормализуем TOOL_DEFS под формат /v1/responses (tools[*].name на верхнем уровне)
  const tools = normalizeToolsForResponses(TOOL_DEFS);

  const body = {
    model: CONFIG.openaiTextModel,
    input,
    temperature: 0.4,
    tool_choice: "auto",
  };

  // ✅ Передаём tools только если они реально есть
  if (Array.isArray(tools) && tools.length) body.tools = tools;

  if (previous_response_id) body.previous_response_id = previous_response_id;
  if (tool_outputs) body.tool_outputs = tool_outputs;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  return await res.json();
}

/**
 * Приводит tools к формату Responses API.
 * Поддерживает оба варианта:
 * 1) chat.completions style:
 *    { type:"function", function:{ name, description, parameters } }
 * 2) responses style:
 *    { type:"function", name, description, parameters }
 */
function normalizeToolsForResponses(toolDefs) {
  if (!Array.isArray(toolDefs)) return [];

  return toolDefs
    .map((t) => {
      if (!t) return null;

      // Если уже responses-формат
      if (t.type === "function" && t.name) return t;

      // Если chat-формат
      if (t.type === "function" && t.function?.name) {
        return {
          type: "function",
          name: t.function.name,
          description: t.function.description || "",
          parameters: t.function.parameters || { type: "object", properties: {} },
        };
      }

      // Иногда встречается другой кейс: { name, description, parameters } без type
      if (t.name) {
        return {
          type: t.type || "function",
          name: t.name,
          description: t.description || "",
          parameters: t.parameters || { type: "object", properties: {} },
        };
      }

      return null;
    })
    .filter(Boolean);
}

function extractText(resp) {
  if (resp?.output_text) return resp.output_text;

  for (const item of resp?.output || []) {
    if (item.type === "message") {
      for (const part of item.content || []) {
        if (part.type === "output_text") return part.text;
      }
    }
  }
  return "";
}

/**
 * Поддерживаем оба формата tool calls:
 * - { type:"tool_call", id, function:{name, arguments} }
 * - { type:"function_call", call_id, name, arguments }
 */
function extractToolCalls(resp) {
  const calls = [];
  for (const item of resp?.output || []) {
    if (item.type === "tool_call" || item.type === "function_call") calls.push(item);
  }
  return calls;
}
