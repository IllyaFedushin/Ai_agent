import { crmClient } from '../crm/crmClient.js';
import { CONFIG } from '../config.js';

export const TOOL_DEFS = [
  { type: "function", function: { name: "getWorkingHours", description: "Рабочие часы клиники", parameters: { type:"object", properties:{} } } },
  { type: "function", function: { name: "getPriceList", description: "Прайс-лист", parameters: { type:"object", properties:{} } } },
  { type: "function", function: { name: "checkAppointmentsByPhone", description: "Найти записи по телефону", parameters: { type:"object", properties:{ phone:{type:"string"} }, required:["phone"] } } },
  { type: "function", function: { name: "createAppointment", description: "Создать запись", parameters: { type:"object", properties:{
      phone:{type:"string"}, name:{type:"string"}, service:{type:"string"}, startISO:{type:"string"}, endISO:{type:"string"}, notes:{type:"string"}
    }, required:["phone","service","startISO","endISO"] } } },
  { type: "function", function: { name: "rescheduleAppointment", description: "Перенести запись", parameters: { type:"object", properties:{
      appointmentId:{type:"string"}, startISO:{type:"string"}, endISO:{type:"string"}
    }, required:["appointmentId","startISO","endISO"] } } },
  { type: "function", function: { name: "cancelAppointment", description: "Отменить запись", parameters: { type:"object", properties:{ appointmentId:{type:"string"} }, required:["appointmentId"] } } },
];

export async function runToolCall(name, args) {
  switch (name) {
    case "getWorkingHours": return CONFIG.clinic.workingHours;
    case "getPriceList": return CONFIG.clinic.priceList;
    case "checkAppointmentsByPhone": return await crmClient.listAppointmentsByPhone(args.phone);
    case "createAppointment": return await crmClient.createAppointment(args);
    case "rescheduleAppointment": return await crmClient.rescheduleAppointment(args);
    case "cancelAppointment": return await crmClient.cancelAppointment(args.appointmentId);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
