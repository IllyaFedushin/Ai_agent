import fetch from 'node-fetch';
import { CONFIG } from '../../config.js';

function squareHeaders() {
  const h = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN || ''}`,
    'Square-Version': process.env.SQUARE_VERSION || '2025-10-16',
  };
  return h;
}

function requiredSquare(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var for Square: ${name}`);
  return v;
}

function getServiceMap() {
  try { return process.env.SQUARE_SERVICE_MAP_JSON ? JSON.parse(process.env.SQUARE_SERVICE_MAP_JSON) : {}; }
  catch { return {}; }
}

function getTeamMemberIds() {
  try { return process.env.SQUARE_TEAM_MEMBER_IDS_JSON ? JSON.parse(process.env.SQUARE_TEAM_MEMBER_IDS_JSON) : []; }
  catch { return []; }
}

async function safeJson(res) {
  const t = await res.text();
  try { return t ? JSON.parse(t) : {}; } catch { return { raw: t }; }
}

function connectUrl(path) {
  return new URL(path, 'https://connect.squareup.com').toString();
}

async function findCustomerIdByPhone(phone) {
  const body = {
    query: {
      filter: {
        phone_number: { exact: phone }
      }
    },
    limit: 1
  };

  const res = await fetch(connectUrl('/v2/customers/search'), {
    method: 'POST',
    headers: squareHeaders(),
    body: JSON.stringify(body),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(`Square SearchCustomers error: ${res.status} ${JSON.stringify(data)}`);
  const c = (data.customers || [])[0];
  return c?.id || null;
}

async function createCustomerIfMissing({ phone, name }) {
  const existing = await findCustomerIdByPhone(phone);
  if (existing) return existing;

  const givenName = (name || '').split(' ')[0] || undefined;
  const familyName = (name || '').split(' ').slice(1).join(' ') || undefined;

  const res = await fetch(connectUrl('/v2/customers'), {
    method: 'POST',
    headers: squareHeaders(),
    body: JSON.stringify({
      given_name: givenName,
      family_name: familyName,
      phone_number: phone,
    }),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(`Square CreateCustomer error: ${res.status} ${JSON.stringify(data)}`);
  return data.customer?.id || null;
}

function isoAddMinutes(startISO, minutes) {
  const d = new Date(startISO);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid startISO: ${startISO}`);
  return new Date(d.getTime() + minutes * 60000).toISOString();
}

export const squareupProvider = {
  /**
   * List bookings for a phone by:
   * 1) search customer by phone
   * 2) list bookings filtered by customer_id (and optionally location_id)
   * Docs: GET /v2/bookings supports customer_id/location_id/start_at_min/start_at_max
   */
  async listAppointmentsByPhone(phone) {
    requiredSquare('SQUARE_ACCESS_TOKEN');
    const locationId = process.env.SQUARE_LOCATION_ID || CONFIG.crm.locationId || '';
    const customerId = await findCustomerIdByPhone(phone);
    if (!customerId) return { items: [] };

    const url = new URL(connectUrl('/v2/bookings'));
    url.searchParams.set('customer_id', customerId);
    if (locationId) url.searchParams.set('location_id', locationId);
    // start_at_min default is "now" per docs; we set it explicitly to include recent/future
    url.searchParams.set('start_at_min', new Date(Date.now() - 7*24*60*60*1000).toISOString());
    url.searchParams.set('start_at_max', new Date(Date.now() + 90*24*60*60*1000).toISOString());
    url.searchParams.set('limit', '50');

    const res = await fetch(url.toString(), { headers: squareHeaders() });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(`Square ListBookings error: ${res.status} ${JSON.stringify(data)}`);

    return {
      customerId,
      items: (data.bookings || []).map(b => ({
        id: b.id,
        startISO: b.start_at,
        status: b.status,
        location_id: b.location_id,
        customer_id: b.customer_id,
      }))
    };
  },

  /**
   * Create booking in Square Bookings API.
   * Requires:
   * - SQUARE_LOCATION_ID
   * - service_variation_id for the chosen service (SQUARE_SERVICE_MAP_JSON)
   * - team_member_id is required by Square booking creation in many cases; if you don't have one,
   *   configure SQUARE_TEAM_MEMBER_IDS_JSON and we will pick the first.
   *
   * Docs: POST /v2/bookings (Create booking)
   */
  async createAppointment({ phone, name, service, startISO, endISO, notes }) {
    requiredSquare('SQUARE_ACCESS_TOKEN');
    const locationId = requiredSquare('SQUARE_LOCATION_ID');

    const serviceMap = getServiceMap();
    const serviceVariationId = serviceMap[service] || serviceMap['default'];
    if (!serviceVariationId) {
      return {
        created: false,
        error: `Не настроен SQUARE_SERVICE_MAP_JSON для услуги "${service}". Нужно указать service_variation_id из Square Catalog.`,
      };
    }

    const teamIds = getTeamMemberIds();
    const teamMemberId = teamIds[0];
    if (!teamMemberId) {
      return {
        created: false,
        error: `Square требует team_member_id. Добавь SQUARE_TEAM_MEMBER_IDS_JSON=["TM..."].`,
      };
    }

    const customerId = await createCustomerIfMissing({ phone, name });

    // Duration in minutes: prefer endISO if provided, else 60
    let durationMin = 60;
    try {
      if (startISO && endISO) {
        const s = new Date(startISO); const e = new Date(endISO);
        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
          durationMin = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
        }
      }
    } catch {}

    const body = {
      idempotency_key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      booking: {
        location_id: locationId,
        start_at: new Date(startISO).toISOString(),
        customer_id: customerId || undefined,
        appointment_segments: [{
          duration_minutes: durationMin,
          service_variation_id: serviceVariationId,
          team_member_id: teamMemberId,
          service_variation_version: undefined,
        }],
        notes: notes || undefined,
      }
    };

    const res = await fetch(connectUrl('/v2/bookings'), {
      method: 'POST',
      headers: squareHeaders(),
      body: JSON.stringify(body),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      return { created: false, squareError: data, status: res.status };
    }
    return { created: true, booking: data.booking };
  },

  /**
   * Reschedule booking: Square has Update booking (PUT/PATCH) and Cancel booking endpoint.
   * We'll use Update booking if available; as a safe default, we cancel + recreate is not ideal.
   * Here we implement Update booking (PATCH /v2/bookings/{booking_id}) if your account allows it.
   */
  async rescheduleAppointment({ appointmentId, startISO, endISO }) {
    requiredSquare('SQUARE_ACCESS_TOKEN');
    // Try Update booking endpoint
    const body = {
      booking: {
        start_at: new Date(startISO).toISOString(),
      }
    };

    const res = await fetch(connectUrl(`/v2/bookings/${encodeURIComponent(appointmentId)}`), {
      method: 'PUT',
      headers: squareHeaders(),
      body: JSON.stringify(body),
    });

    const data = await safeJson(res);
    if (!res.ok) return { updated: false, status: res.status, squareError: data };
    return { updated: true, booking: data.booking };
  },

  async cancelAppointment(appointmentId) {
    requiredSquare('SQUARE_ACCESS_TOKEN');
    const res = await fetch(connectUrl(`/v2/bookings/${encodeURIComponent(appointmentId)}/cancel`), {
      method: 'POST',
      headers: squareHeaders(),
      body: JSON.stringify({}),
    });

    const data = await safeJson(res);
    if (!res.ok) return { cancelled: false, status: res.status, squareError: data };
    return { cancelled: true, booking: data.booking };
  },
};
