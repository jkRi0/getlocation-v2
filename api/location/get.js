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
  if (req.method !== 'GET') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
  const EDGE_CONFIG_READ_TOKEN = process.env.EDGE_CONFIG_READ_TOKEN;

  if (!EDGE_CONFIG_ID) return json({ error: 'Missing EDGE_CONFIG_ID' }, { status: 500 });
  if (!EDGE_CONFIG_READ_TOKEN) return json({ error: 'Missing EDGE_CONFIG_READ_TOKEN' }, { status: 500 });

  const url = new URL(req.url);
  const id = String(url.searchParams.get('id') ?? '').trim();

  if (!id) return json({ error: 'id is required' }, { status: 400 });

  const readUrl = `https://edge-config.vercel.com/${EDGE_CONFIG_ID}/item/${encodeURIComponent(id)}`;

  const resp = await fetch(readUrl, {
    headers: {
      Authorization: `Bearer ${EDGE_CONFIG_READ_TOKEN}`,
    },
  });

  const text = await resp.text();

  if (!resp.ok) {
    return json(
      {
        error: 'Failed to read from Edge Config',
        status: resp.status,
        details: text,
      },
      { status: 500 },
    );
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = text;
  }

  return json({ status: 'ok', id, value });
}
