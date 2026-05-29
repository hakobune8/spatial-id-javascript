(() => {
  const DEFAULT_LAT = 35.7300467;
  const DEFAULT_LNG = 139.7474538;
  const DEFAULT_ALT = 0;
  const DEFAULT_ZOOM = 20;

  const MIN_ALT = -33554432;
  const MAX_ALT = 33554432;
  const MIN_LAT = -85.05112878;
  const MAX_LAT = 85.05112878;
  const MIN_LNG = -180;
  const MAX_LNG = 180;
  const MIN_Z = 0;
  const MAX_Z = 25;
  const DECIMAL_DIGITS = 7;
  const DEBOUNCE_MS = 250;

  const messages = {
    ja: {
      libraryMissing: "ライブラリが読み込めていません。",
      mapMissing: "地図ライブラリが読み込めていません。",
      invalidLat: `緯度は ${MIN_LAT} ～ ${MAX_LAT} の範囲で入力してください。`,
      invalidLng: `経度は ${MIN_LNG} ～ ${MAX_LNG} の範囲で入力してください。`,
      invalidAlt: `標高は ${MIN_ALT} ～ ${MAX_ALT} m の範囲で入力してください。`,
      invalidZoom: `ズームレベルは ${MIN_Z} ～ ${MAX_Z} の整数で入力してください。`,
      calcError: "計算中にエラーが発生しました。"
    },
    en: {
      libraryMissing: "Spatial ID library is not loaded.",
      mapMissing: "Map library is not loaded.",
      invalidLat: `Latitude must be between ${MIN_LAT} and ${MAX_LAT}.`,
      invalidLng: `Longitude must be between ${MIN_LNG} and ${MAX_LNG}.`,
      invalidAlt: `Altitude must be between ${MIN_ALT} and ${MAX_ALT} meters.`,
      invalidZoom: `Zoom level must be an integer between ${MIN_Z} and ${MAX_Z}.`,
      calcError: "An error occurred during calculation."
    }
  };

  const translations = {
    ja: {
      pageTitle: "空間ID試行環境",
      pageDesc:
        "緯度・経度・標高・ズームレベルから空間ID（z/f/x/y）を算出できます。\n地図をクリックして座標を入力することもできます。",
      inputTitle: "入力",
      latLabel: "緯度（10進度）",
      lngLabel: "経度（10進度）",
      altLabel: "標高（m）",
      zoomLabel: "ズームレベル",
      resultTitle: "出力",
      resultLabel: "空間ID",
      mapTitle: "地図",
      mapHelp: "地図をクリックすると緯度・経度欄に反映されます。",
      linksTitle: "関連情報",
      guidelineLink: "4次元時空間情報利活用のための空間IDガイドライン",
      repoLink: "Open Data Spaces 4次元時空間ID 関連リポジトリ",
      footerNote:
        "本画面は試行環境です。表示結果は利用者の責任においてご確認ください。"
    },
    en: {
      pageTitle: "Spatial ID Demo",
      pageDesc:
        "Calculate a Spatial ID (z/f/x/y) from latitude, longitude, altitude, and zoom level.\nYou can also click the map to fill in the coordinates.",
      inputTitle: "Input",
      latLabel: "Latitude (decimal degrees)",
      lngLabel: "Longitude (decimal degrees)",
      altLabel: "Altitude (m)",
      zoomLabel: "Zoom level",
      resultTitle: "Output",
      resultLabel: "Spatial ID",
      mapTitle: "Map",
      mapHelp: "Click the map to update latitude and longitude.",
      linksTitle: "Related links",
      guidelineLink:
        "Spatial ID Guideline for Utilization of 4D Spatio-Temporal Information",
      repoLink: "Open Data Spaces Spatial ID Related Repositories",
      footerNote:
        "This page is provided as a trial environment. Please verify the results at your own responsibility."
    }
  };

  function start() {
    const msgEl = document.getElementById("msg");

    if (!window.SpatialId || !window.SpatialId.Space) {
      if (msgEl) msgEl.textContent = messages.ja.libraryMissing;
      return;
    }

    if (!window.L) {
      if (msgEl) msgEl.textContent = messages.ja.mapMissing;
      return;
    }

    const Space = window.SpatialId.Space;

    function $(id) {
      return document.getElementById(id);
    }

    const form = $("calc-form");
    const latEl = $("lat");
    const lngEl = $("lng");
    const hEl = $("h");
    const zEl = $("z");
    const zfxyEl = $("zfxy");
    const langSelect = $("lang-select");

    let currentLang = "ja";
    let debounceTimer = null;
    let currentLayer = null;
    let currentMarker = null;

    latEl.value = formatCoord(DEFAULT_LAT);
    lngEl.value = formatCoord(DEFAULT_LNG);
    hEl.value = String(DEFAULT_ALT);
    zEl.value = String(DEFAULT_ZOOM);

    const map = L.map("map").setView([DEFAULT_LAT, DEFAULT_LNG], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    function applyTranslations(lang) {
      currentLang = lang;
      const dict = translations[lang];
      document.documentElement.lang = lang;

      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.textContent = dict[key];
      });
    }

    function formatCoord(value) {
      return Number(value).toFixed(DECIMAL_DIGITS);
    }

    function toNumber(el) {
      if (el.value === "") return NaN;
      return Number(el.value);
    }

    function isInRange(value, min, max) {
      return Number.isFinite(value) && value >= min && value <= max;
    }

    function validateInputs() {
      const lat = toNumber(latEl);
      const lng = toNumber(lngEl);
      const alt = hEl.value === "" ? 0 : toNumber(hEl);
      const z = toNumber(zEl);

      if (!isInRange(lat, MIN_LAT, MAX_LAT)) {
        return { ok: false, message: messages[currentLang].invalidLat };
      }

      if (!isInRange(lng, MIN_LNG, MAX_LNG)) {
        return { ok: false, message: messages[currentLang].invalidLng };
      }

      if (!isInRange(alt, MIN_ALT, MAX_ALT)) {
        return { ok: false, message: messages[currentLang].invalidAlt };
      }

      if (!Number.isInteger(z) || !isInRange(z, MIN_Z, MAX_Z)) {
        return { ok: false, message: messages[currentLang].invalidZoom };
      }

      return { ok: true, lat, lng, alt, z };
    }

    function setValidity(state) {
      latEl.setCustomValidity("");
      lngEl.setCustomValidity("");
      hEl.setCustomValidity("");
      zEl.setCustomValidity("");

      if (state.ok) return;

      if (state.message === messages[currentLang].invalidLat) {
        latEl.setCustomValidity(state.message);
      }

      if (state.message === messages[currentLang].invalidLng) {
        lngEl.setCustomValidity(state.message);
      }

      if (state.message === messages[currentLang].invalidAlt) {
        hEl.setCustomValidity(state.message);
      }

      if (state.message === messages[currentLang].invalidZoom) {
        zEl.setCustomValidity(state.message);
      }
    }

    function getTile(space) {
      if (space.zfxy) return space.zfxy;
      if (space.zfxyTile) return space.zfxyTile;
      return null;
    }

    function getZfxyString(space) {
      if (typeof space.zfxyStr === "string") {
        return space.zfxyStr.replace(/^\//, "");
      }

      const tile = getTile(space);

      if (tile) {
        return `${tile.z}/${tile.f}/${tile.x}/${tile.y}`;
      }

      return "-";
    }

    function getCenter(space, input) {
      if (
        space.center &&
        Number.isFinite(space.center.lat) &&
        Number.isFinite(space.center.lng)
      ) {
        return space.center;
      }

      return {
        lat: input.lat,
        lng: input.lng
      };
    }

    function updateOutput(space) {
      zfxyEl.textContent = getZfxyString(space);
    }

    function resetOutput() {
      zfxyEl.textContent = "-";
      clearDrawings();
    }

    function clearDrawings() {
      if (currentLayer) map.removeLayer(currentLayer);
      if (currentMarker) map.removeLayer(currentMarker);

      currentLayer = null;
      currentMarker = null;
    }

    function draw(space, input) {
      clearDrawings();

      const geo = space.toGeoJSON();
      const center = getCenter(space, input);

      currentLayer = L.geoJSON(geo, {
        style: {
          color: "#2457d6",
          weight: 2,
          fillOpacity: 0.2
        }
      }).addTo(map);

      currentMarker = L.marker([center.lat, center.lng]).addTo(map);

      const bounds = currentLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 18
        });
      }
    }

    function calculate() {
      const state = validateInputs();
      setValidity(state);

      if (!state.ok) {
        msgEl.textContent = state.message;
        resetOutput();
        return;
      }

      try {
        const space = Space.getSpaceByLocation(
          {
            lat: state.lat,
            lng: state.lng,
            alt: state.alt
          },
          state.z
        );

        updateOutput(space);
        draw(space, state);
        msgEl.textContent = "";
      } catch (error) {
        msgEl.textContent = `${messages[currentLang].calcError} ${
          error.message || ""
        }`.trim();
        resetOutput();
      }
    }

    function scheduleCalculate() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        calculate();
      }, DEBOUNCE_MS);
    }

    function applyMapClick(latlng) {
      latEl.value = formatCoord(latlng.lat);
      lngEl.value = formatCoord(latlng.lng);
      calculate();
    }

    if (form) {
      form.addEventListener("submit", e => {
        e.preventDefault();
        calculate();
      });
    }

    [latEl, lngEl, hEl, zEl].forEach(el => {
      el.addEventListener("input", scheduleCalculate);
      el.addEventListener("change", calculate);
    });

    [latEl, lngEl].forEach(el => {
      el.addEventListener("blur", () => {
        const value = Number(el.value);

        if (Number.isFinite(value)) {
          el.value = formatCoord(value);
          calculate();
        }
      });
    });

    if (langSelect) {
      langSelect.addEventListener("change", e => {
        applyTranslations(e.target.value);
        calculate();
      });
    }

    map.on("click", e => {
      applyMapClick(e.latlng);
    });

    applyTranslations("ja");

    // 初期表示時にも出力を表示する
    calculate();
  }

  document.addEventListener("DOMContentLoaded", start);
})();
