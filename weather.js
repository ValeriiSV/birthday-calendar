const $ = selector => document.querySelector(selector);
const state = () => window.BirthdayApp.getState();
const lang = () => state().lang;
const t = key => window.I18N?.[lang()]?.[key] || key;
const notify = message => window.BirthdayApp.notify(message);

const WEATHER_LOC_KEY = "birthday-weather-loc-v1";
const WEATHER_CACHE_KEY = "birthday-weather-cache-v1";

function loadLocation() {
  try { return JSON.parse(localStorage.getItem(WEATHER_LOC_KEY)); } catch { return null; }
}
function saveLocation(loc) { localStorage.setItem(WEATHER_LOC_KEY, JSON.stringify(loc)); }

function birthdayDays(date) {
  const [, month, day] = String(date).split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), month - 1, day);
  if (next < today) next = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((next - today) / 86400000);
}

const WEATHER_CODES = {
  0: { icon: "☀️", ro: "Cer senin", ru: "Ясно" },
  1: { icon: "🌤️", ro: "Parțial senin", ru: "Малооблачно" },
  2: { icon: "⛅", ro: "Înnorat parțial", ru: "Облачно с прояснениями" },
  3: { icon: "☁️", ro: "Înnorat", ru: "Пасмурно" },
  45: { icon: "🌫️", ro: "Ceață", ru: "Туман" },
  48: { icon: "🌫️", ro: "Ceață cu chiciură", ru: "Изморозь" },
  51: { icon: "🌦️", ro: "Burniță ușoară", ru: "Лёгкая морось" },
  53: { icon: "🌦️", ro: "Burniță", ru: "Морось" },
  55: { icon: "🌧️", ro: "Burniță intensă", ru: "Сильная морось" },
  61: { icon: "🌧️", ro: "Ploaie ușoară", ru: "Небольшой дождь" },
  63: { icon: "🌧️", ro: "Ploaie", ru: "Дождь" },
  65: { icon: "🌧️", ro: "Ploaie puternică", ru: "Сильный дождь" },
  71: { icon: "🌨️", ro: "Ninsoare ușoară", ru: "Небольшой снег" },
  73: { icon: "🌨️", ro: "Ninsoare", ru: "Снег" },
  75: { icon: "❄️", ro: "Ninsoare puternică", ru: "Сильный снег" },
  80: { icon: "🌦️", ro: "Averse", ru: "Ливень" },
  81: { icon: "🌧️", ro: "Averse puternice", ru: "Сильный ливень" },
  82: { icon: "⛈️", ro: "Averse violente", ru: "Очень сильный ливень" },
  95: { icon: "⛈️", ro: "Furtună", ru: "Гроза" },
  96: { icon: "⛈️", ro: "Furtună cu grindină", ru: "Гроза с градом" },
  99: { icon: "⛈️", ro: "Furtună severă", ru: "Сильная гроза" }
};
function weatherInfo(code) {
  const entry = WEATHER_CODES[code] || WEATHER_CODES[3];
  return { icon: entry.icon, label: entry[lang()] || entry.ro };
}

const RAIN_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
const SNOW_CODES = [71, 73, 75];

function outfitSuggestion(tmax, code, precipProb) {
  if (SNOW_CODES.includes(code) || tmax <= 0) return t("weatherOutfitSnow");
  if (RAIN_CODES.includes(code) || precipProb >= 50) return t("weatherOutfitRain");
  if (tmax <= 5) return t("weatherOutfitCold");
  if (tmax <= 14) return t("weatherOutfitCool");
  if (tmax <= 23) return t("weatherOutfitMild");
  return t("weatherOutfitHot");
}

function venueSuggestion(tmax, code, precipProb) {
  const bad = RAIN_CODES.includes(code) || SNOW_CODES.includes(code) || precipProb >= 50 || tmax <= 3 || tmax >= 33;
  return bad ? t("weatherVenueIndoor") : t("weatherVenueOutdoor");
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang()}`);
    const data = await res.json();
    return data.city || data.locality || data.principalSubdivision || "";
  } catch {
    return "";
  }
}

async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=8`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("WEATHER_FETCH_FAILED");
  return res.json();
}

function cacheKey(lat, lon) {
  const today = new Date().toISOString().slice(0, 10);
  return `${WEATHER_CACHE_KEY}:${lat.toFixed(2)},${lon.toFixed(2)}:${today}`;
}

async function getForecastCached(lat, lon) {
  const key = cacheKey(lat, lon);
  const cached = localStorage.getItem(key);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fall through to fetch */ }
  }
  const data = await fetchForecast(lat, lon);
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}

function upcomingItems() {
  return state().items
    .map(item => ({ ...item, days: birthdayDays(item.date) }))
    .filter(item => item.days >= 0 && item.days <= 7)
    .sort((a, b) => a.days - b.days);
}

function dayLabel(days) {
  if (days === 0) return t("weatherToday");
  if (days === 1) return t("weatherTomorrow");
  return t("weatherInDays").replace("{days}", days);
}

function requestLocation() {
  if (!("geolocation" in navigator)) { notify(t("weatherUnsupported")); return; }
  const body = $("#weatherBody");
  if (body) body.innerHTML = `<p class="weather-loading">${t("weatherLocating")}</p>`;
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords;
    const label = await reverseGeocode(latitude, longitude);
    saveLocation({ lat: latitude, lon: longitude, label });
    renderWeather();
  }, () => {
    notify(t("weatherPermissionDenied"));
    renderWeather();
  }, { timeout: 10000, maximumAge: 600000 });
}

async function renderWeather() {
  const body = $("#weatherBody");
  if (!body) return;
  const upcoming = upcomingItems();

  if (!upcoming.length) {
    body.innerHTML = `<p class="weather-empty">${t("weatherEmpty")}</p><small class="weather-empty-hint">${t("weatherEmptyHint")}</small>`;
    return;
  }

  const loc = loadLocation();
  if (!loc) {
    body.innerHTML = `<p class="weather-empty">${t("weatherLocationPrompt")}</p><button class="save-button full" id="weatherEnableLocation" type="button">📍 ${t("weatherEnableLocationBtn")}</button>`;
    $("#weatherEnableLocation").onclick = requestLocation;
    return;
  }

  body.innerHTML = `<p class="weather-loading">${t("weatherLoading")}</p>`;
  try {
    const forecast = await getForecastCached(loc.lat, loc.lon);
    const daily = forecast.daily || {};
    const codes = daily.weather_code || daily.weathercode || [];
    const list = upcoming.map(item => {
      if (item.days >= codes.length) return "";
      const code = codes[item.days];
      const tmax = Math.round(daily.temperature_2m_max[item.days]);
      const tmin = Math.round(daily.temperature_2m_min[item.days]);
      const precip = daily.precipitation_probability_max?.[item.days] ?? 0;
      const info = weatherInfo(code);
      const outfit = outfitSuggestion(tmax, code, precip);
      const venue = venueSuggestion(tmax, code, precip);
      return `<div class="weather-item"><span class="weather-icon">${info.icon}</span><div class="weather-info"><b>${item.name} · ${dayLabel(item.days)}</b><small>${info.label} · ${tmin}°–${tmax}° · 💧${precip}%</small><small class="weather-tip">${outfit} ${venue}</small></div></div>`;
    }).filter(Boolean).join("");
    body.innerHTML = `<div class="weather-location-row"><span>📍 ${loc.label || t("weatherLocationGeneric")}</span><button type="button" id="weatherChangeLocation">${t("weatherChangeLocation")}</button></div><div class="weather-list">${list || `<p class="weather-empty">${t("weatherNoData")}</p>`}</div>`;
    $("#weatherChangeLocation").onclick = requestLocation;
  } catch (err) {
    body.innerHTML = `<p class="weather-empty">${t("weatherError")}</p><button class="save-button full" id="weatherRetry" type="button">↻ ${t("weatherRetry")}</button>`;
    $("#weatherRetry").onclick = renderWeather;
  }
}

$("#openWeatherWow").onclick = () => { $("#weatherDialog").showModal(); renderWeather(); };
