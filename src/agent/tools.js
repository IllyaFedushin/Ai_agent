import { crmClient } from '../crm/crmClient.js';
import { CONFIG } from '../config.js';

/**
 * ✅ Tools format for OpenAI Responses API:
 * Each tool must have:
 * - type: "function"
 * - name: "toolName"        <-- IMPORTANT (top-level)
 * - description
 * - parameters (JSON Schema)
 */
export const TOOL_DEFS = [
  {
    type: "function",
    name: "getWorkingHours",
    description: "Рабочие часы клиники",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "getPriceList",
    description: "Прайс-лист",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "checkAppointmentsByPhone",
    description: "Найти записи по телефону",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Телефон клиента в любом формате" }
      },
      required: ["phone"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "createAppointment",
    description: "Создать запись",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Телефон клиента" },
        name: { type: "string", description: "Имя клиента" },
        service: { type: "string", description: "Услуга/процедура" },
        startISO: { type: "string", description: "Начало записи в ISO (например 2026-01-21T10:00:00+02:00)" },
        endISO: { type: "string", description: "Конец записи в ISO (например 2026-01-21T10:30:00+02:00)" },
        notes: { type: "string", description: "Комментарий/примечания" }
      },
      required: ["phone", "service", "startISO", "endISO"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "rescheduleAppointment",
    description: "Перенести запись",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "ID записи" },
        startISO: { type: "string", description: "Новое начало в ISO" },
        endISO: { type: "string", description: "Новой конец в ISO" }
      },
      required: ["appointmentId", "startISO", "endISO"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "cancelAppointment",
    description: "Отменить запись",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "ID записи" }
      },
      required: ["appointmentId"],
      additionalProperties: false
    }
  }
];

export async function runToolCall(name, args = {}) {
  switch (name) {
    case "getWorkingHours":
      return CONFIG.clinic.workingHours;

    case "getPriceList":
      return CONFIG.clinic.priceList;

    case "checkAppointmentsByPhone":
      return await crmClient.listAppointmentsByPhone(args.phone);

    case "createAppointment":
      return await crmClient.createAppointment(args);

    case "rescheduleAppointment":
      return await crmClient.rescheduleAppointment(args);

    case "cancelAppointment":
      return await crmClient.cancelAppointment(args.appointmentId);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
