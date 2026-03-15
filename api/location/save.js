export const config = {
  runtime: 'edge',
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
  const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

  if (!EDGE_CONFIG_ID) return json({ error: 'Missing EDGE_CONFIG_ID' }, { status: 500 });
  if (!VERCEL_API_TOKEN) return json({ error: 'Missing VERCEL_API_TOKEN' }, { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = String(body?.id ?? '').trim();
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (!id) return json({ error: 'id is required' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: 'lat and lng must be numbers' }, { status: 400 });
  }

  const value = {
    lat,
    lng,
    updatedAt: new Date().toISOString(),
  };

  const url = new URL(`https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`);
  if (VERCEL_TEAM_ID) url.searchParams.set('teamId', VERCEL_TEAM_ID);

  const resp = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          operation: 'upsert',
          key: id,
          value,
        },
      ],
    }),
  });

  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!resp.ok) {
    return json(
      {
        error: 'Failed to update Edge Config',
        status: resp.status,
        details: data,
      },
      { status: 500 },
    );
  }

  return json({ status: 'ok', id, value });
}
