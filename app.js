/* global L */

const els = {
  userId: document.getElementById('userId'),
  btnLocate: document.getElementById('btnLocate'),
  btnStop: document.getElementById('btnStop'),
  searchId: document.getElementById('searchId'),
  btnSearch: document.getElementById('btnSearch'),
  btnStopView: document.getElementById('btnStopView'),
  status: document.getElementById('status'),
};

let map;
let marker;
let searchedMarker;
let watchId = null;
let sharingKey = null;
let shareSession = 0;
let saveAbortController = null;
let viewTimer = null;
let viewingKey = null;

async function saveLocationToServer(id, lat, lng, signal) {
  const resp = await fetch('/api/location/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, lat, lng }),
    signal,
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const parts = [];
    if (data?.error) parts.push(data.error);
    if (data?.key) parts.push(`key=${data.key}`);
    if (data?.status) parts.push(`upstreamStatus=${data.status}`);
    if (data?.details) parts.push(`details=${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)}`);
    const detail = parts.length ? parts.join(' | ') : `HTTP ${resp.status}`;
    throw new Error(detail);
  }

  return data;
}

async function deleteLocationFromServer(id) {
  const resp = await fetch('/api/location/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const parts = [];
    if (data?.error) parts.push(data.error);
    if (data?.key) parts.push(`key=${data.key}`);
    if (data?.status) parts.push(`upstreamStatus=${data.status}`);
    if (data?.details) parts.push(`details=${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)}`);
    const detail = parts.length ? parts.join(' | ') : `HTTP ${resp.status}`;
    throw new Error(detail);
  }

  return data;
}

async function getLocationFromServer(id) {
  const resp = await fetch(`/api/location/get?id=${encodeURIComponent(id)}`, {
    method: 'GET',
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const parts = [];
    if (data?.error) parts.push(data.error);
    if (data?.status) parts.push(`upstreamStatus=${data.status}`);
    if (data?.details) parts.push(`details=${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)}`);
    const detail = parts.length ? parts.join(' | ') : `HTTP ${resp.status}`;
    const err = new Error(detail);
    err.httpStatus = resp.status;
    throw err;
  }

  return data;
}

function setStatus(msg) {
  els.status.textContent = msg;
}

function normalizeId(raw) {
  return String(raw ?? '').trim();
}

function ensureMap() {
  if (map) return;

  map = L.map('map', {
    zoomControl: true,
  }).setView([14.5995, 120.9842], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
}

function setUserMarker(lat, lng, id) {
  ensureMap();

  const label = id ? `ID: ${id}` : 'Your location';

  if (!marker) {
    marker = L.marker([lat, lng]).addTo(map);
  } else {
    marker.setLatLng([lat, lng]);
  }

  marker.bindPopup(label).openPopup();
  map.setView([lat, lng], 16);
}

function setSearchedMarker(lat, lng, id) {
  ensureMap();

  const label = id ? `Searched ID: ${id}` : 'Searched location';

  if (!searchedMarker) {
    searchedMarker = L.marker([lat, lng]).addTo(map);
  } else {
    searchedMarker.setLatLng([lat, lng]);
  }

  searchedMarker.bindPopup(label).openPopup();
  map.setView([lat, lng], 16);
}

function stopViewing() {
  if (viewTimer !== null) {
    clearInterval(viewTimer);
  }
  viewTimer = null;
  viewingKey = null;
  if (els.btnStopView) els.btnStopView.disabled = true;
}

function getLocation() {
  const id = normalizeId(els.userId.value);

  if (!id) {
    setStatus('Please enter an ID first.');
    els.userId.focus();
    return;
  }

  if (!('geolocation' in navigator)) {
    setStatus('Geolocation is not supported in this browser.');
    return;
  }

  if (watchId !== null) {
    setStatus('Already sharing location. Click “Stop Sharing” to stop.');
    return;
  }

  els.btnLocate.disabled = true;
  setStatus('Requesting location permission...');

  shareSession += 1;
  const session = shareSession;

  sharingKey = id;
  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      if (session !== shareSession) return;

      const { latitude, longitude, accuracy } = pos.coords;

      setUserMarker(latitude, longitude, id);
      setStatus(`Sharing live location for ID "${id}" (±${Math.round(accuracy)}m). Updating...`);

      try {
        if (saveAbortController) saveAbortController.abort();
        saveAbortController = new AbortController();
        await saveLocationToServer(id, latitude, longitude, saveAbortController.signal);
        setStatus(`Sharing live location for ID "${id}" (±${Math.round(accuracy)}m).`);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setStatus(`Sharing is ON but update failed: ${e?.message || 'Unknown error'}`);
      }

      if (els.btnStop) els.btnStop.disabled = false;
      els.btnLocate.disabled = false;
    },
    (err) => {
      let msg = 'Unable to get your location.';
      if (err?.code === err.PERMISSION_DENIED) msg = 'Permission denied. Please allow location access.';
      if (err?.code === err.POSITION_UNAVAILABLE) msg = 'Position unavailable.';
      if (err?.code === err.TIMEOUT) msg = 'Location request timed out.';
      setStatus(msg);

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = null;
      sharingKey = null;
      els.btnLocate.disabled = false;
      if (els.btnStop) els.btnStop.disabled = true;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    },
  );
}

async function stopSharing() {
  if (watchId === null) {
    setStatus('Not currently sharing.');
    return;
  }

  const id = sharingKey;

  shareSession += 1;
  if (saveAbortController) {
    saveAbortController.abort();
    saveAbortController = null;
  }

  navigator.geolocation.clearWatch(watchId);
  watchId = null;
  sharingKey = null;
  if (els.btnStop) els.btnStop.disabled = true;

  if (!id) {
    setStatus('Stopped sharing.');
    return;
  }

  setStatus(`Stopping sharing for ID "${id}"...`);
  try {
    await deleteLocationFromServer(id);
    setStatus(`Stopped sharing and deleted ID "${id}" from store.`);
  } catch (e) {
    setStatus(`Stopped sharing but failed to delete: ${e?.message || 'Unknown error'}`);
  }
}

async function searchIdLocation() {
  const id = normalizeId(els.searchId?.value);
  if (!id) {
    setStatus('Please enter an ID to search.');
    els.searchId?.focus();
    return;
  }

  stopViewing();

  if (els.btnSearch) els.btnSearch.disabled = true;
  setStatus(`Searching location for ID "${id}"...`);

  try {
    const data = await getLocationFromServer(id);
    const value = data?.value;
    const lat = Number(value?.lat);
    const lng = Number(value?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setStatus(`No valid coordinates stored for ID "${id}".`);
      return;
    }

    setSearchedMarker(lat, lng, id);

    viewingKey = id;
    if (els.btnStopView) els.btnStopView.disabled = false;

    viewTimer = setInterval(async () => {
      if (!viewingKey) return;
      try {
        const d = await getLocationFromServer(viewingKey);
        const v = d?.value;
        const la = Number(v?.lat);
        const ln = Number(v?.lng);
        if (Number.isFinite(la) && Number.isFinite(ln)) {
          setSearchedMarker(la, ln, viewingKey);
        }
      } catch (e) {
        const missing = e?.httpStatus === 404;
        const key = viewingKey;
        stopViewing();
        if (missing) {
          setStatus(`No saved location found for ID "${key}".`);
        } else {
          setStatus(`Viewing stopped: ${e?.message || 'Unknown error'}`);
        }
      }
    }, 1000);

    setStatus(`Viewing ID "${id}" (auto-updating every 1s).`);
  } catch (e) {
    if (e?.httpStatus === 404) {
      setStatus(`No saved location found for ID "${id}".`);
    } else {
      setStatus(`Search failed: ${e?.message || 'Unknown error'}`);
    }
  } finally {
    if (els.btnSearch) els.btnSearch.disabled = false;
  }
}

function init() {
  ensureMap();

  els.btnLocate.addEventListener('click', getLocation);
  els.btnStop?.addEventListener('click', stopSharing);
  els.userId.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') getLocation();
  });

  els.btnSearch?.addEventListener('click', searchIdLocation);
  els.btnStopView?.addEventListener('click', () => {
    stopViewing();
    setStatus('Stopped viewing.');
  });
  els.searchId?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchIdLocation();
  });

  setStatus('Enter your ID to save your location, or search an ID to show its saved location.');
}

init();
