const $ = (id) => document.getElementById(id);

async function loadConfig() {
  const keys = $('keys').value.trim();
  const url = keys ? `/api/config?keys=${encodeURIComponent(keys)}` : '/api/config';

  $('load').disabled = true;
  $('error').hidden = true;
  $('status').textContent = 'Loading…';

  try {
    const res = await fetch(url, {
      headers: {
        'accept': 'application/json',
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.ok !== true) {
      const msg = json?.details || json?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    $('output').textContent = JSON.stringify(json.data, null, 2);
    $('status').textContent = 'Loaded.';
  } catch (e) {
    $('output').textContent = '';
    $('status').textContent = '';
    $('error').textContent = `Error: ${e?.message || String(e)}`;
    $('error').hidden = false;
  } finally {
    $('load').disabled = false;
  }
}

$('load').addEventListener('click', loadConfig);
