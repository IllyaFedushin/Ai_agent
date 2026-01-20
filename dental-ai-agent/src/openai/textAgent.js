import fetch from 'node-fetch';
import { CONFIG } from '../config.js';
import { TOOL_DEFS, runToolCall } from '../agent/tools.js';
import { buildSystemPrompt } from '../agent/systemPromptRu.js';

export async function respondText({ userId, channel, userText, phone }) {
  const system = buildSystemPrompt();
  const baseInput = [
    { role: "system", content: system },
    { role: "user", content: `Канал: ${channel}. Телефон: ${phone || "неизвестно"}\nСообщение: ${userText}` },
  ];

  let resp = await callOpenAI({ input: baseInput, previous_response_id: undefined, tool_outputs: undefined });

  while (true) {
    const toolCalls = extractToolCalls(resp);
    if (!toolCalls.length) break;

    const tool_outputs = [];
    for (const tc of toolCalls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}");
      const result = await runToolCall(name, args);
      tool_outputs.push({ tool_call_id: tc.id, output: JSON.stringify(result) });
    }

    resp = await callOpenAI({ input: baseInput, previous_response_id: resp.id, tool_outputs });
  }

  return extractText(resp) || "Извините, не получилось ответить. Повторите, пожалуйста.";
}

async function callOpenAI({ input, previous_response_id, tool_outputs }) {
  const body = {
    model: CONFIG.openaiTextModel,
    input,
    tools: TOOL_DEFS,
    tool_choice: "auto",
    temperature: 0.4,
  };
  if (previous_response_id) body.previous_response_id = previous_response_id;
  if (tool_outputs) body.tool_outputs = tool_outputs;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${CONFIG.openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  return await res.json();
}

function extractText(resp) {
  if (resp.output_text) return resp.output_text;
  for (const item of (resp.output || [])) {
    if (item.type === "message") {
      for (const part of (item.content || [])) {
        if (part.type === "output_text") return part.text;
      }
    }
  }
  return "";
}

function extractToolCalls(resp) {
  const calls = [];
  for (const item of (resp.output || [])) {
    if (item.type === "tool_call") calls.push(item);
  }
  return calls;
}
