/* global L */

const els = {
  userId: document.getElementById('userId'),
  btnLocate: document.getElementById('btnLocate'),
  status: document.getElementById('status'),
};

const STORAGE_KEY = 'getlocation.userId';

let map;
let marker;

async function saveLocationToServer(id, lat, lng) {
  const resp = await fetch('/api/location/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, lat, lng }),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detail = data?.error || `HTTP ${resp.status}`;
    throw new Error(detail);
  }

  return data;
}

function setStatus(msg) {
  els.status.textContent = msg;
}

function normalizeId(raw) {
  return String(raw ?? '').trim();
}

function loadSavedId() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) els.userId.value = saved;
  } catch {
    // ignore
  }
}

function saveId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
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

function getLocation() {
  const id = normalizeId(els.userId.value);

  if (!id) {
    setStatus('Please enter an ID first.');
    els.userId.focus();
    return;
  }

  saveId(id);

  if (!('geolocation' in navigator)) {
    setStatus('Geolocation is not supported in this browser.');
    return;
  }

  els.btnLocate.disabled = true;
  setStatus('Requesting location permission...');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setStatus(`Location acquired (±${Math.round(accuracy)}m). Saving...`);
      setUserMarker(latitude, longitude, id);

      try {
        await saveLocationToServer(id, latitude, longitude);
        setStatus(`Saved for ID "${id}" (±${Math.round(accuracy)}m). Showing on map.`);
      } catch (e) {
        setStatus(`Location acquired but failed to save: ${e?.message || 'Unknown error'}`);
      }

      els.btnLocate.disabled = false;
    },
    (err) => {
      let msg = 'Unable to get your location.';
      if (err?.code === err.PERMISSION_DENIED) msg = 'Permission denied. Please allow location access.';
      if (err?.code === err.POSITION_UNAVAILABLE) msg = 'Position unavailable.';
      if (err?.code === err.TIMEOUT) msg = 'Location request timed out.';
      setStatus(msg);
      els.btnLocate.disabled = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    },
  );
}

function init() {
  loadSavedId();
  ensureMap();

  els.btnLocate.addEventListener('click', getLocation);
  els.userId.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') getLocation();
  });

  setStatus('Enter an ID, then click “Get My Location”.');
}

init();
