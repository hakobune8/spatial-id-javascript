(() => {
  const DEFAULT_LAT = 35.7300467;
  const DEFAULT_LNG = 139.7474538;
  const DEFAULT_ALT = 0;
  const DEFAULT_ZOOM = 20;

  const ROOT_MIN_ALT = -33554432;
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
      invalidAlt: min => `標高は ${min} m以上、${MAX_ALT} m未満で入力してください。`,
      invalidZoom: `ズームレベルは ${MIN_Z} ～ ${MAX_Z} の整数で入力してください。`,
      calcError: "計算中にエラーが発生しました。"
    },
    en: {
      libraryMissing: "Spatial ID library is not loaded.",
      mapMissing: "Map library is not loaded.",
      invalidLat: `Latitude must be between ${MIN_LAT} and ${MAX_LAT}.`,
      invalidLng: `Longitude must be between ${MIN_LNG} and ${MAX_LNG}.`,
      invalidAlt: min => `Altitude must be at least ${min} and less than ${MAX_ALT} meters.`,
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
      floorLabel: "床高度",
      centerAltLabel: "中心高度",
      ceilLabel: "天井高度",
      heightProfileLabel: "鉛直スケール",
      floorShortLabel: "床",
      ceilShortLabel: "天井",
      thicknessLabel: "厚み",
      inputAltLabel: "入力",
      mapHeightNote: "地図は水平範囲のみを表示します。高さはこの鉛直スケールで確認してください。",
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
      floorLabel: "Floor altitude",
      centerAltLabel: "Center altitude",
      ceilLabel: "Ceiling altitude",
      heightProfileLabel: "Vertical scale",
      floorShortLabel: "Floor",
      ceilShortLabel: "Ceiling",
      thicknessLabel: "Thickness",
      inputAltLabel: "Input",
      mapHeightNote: "The map shows only the horizontal extent. Use this vertical scale to inspect height.",
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
    const floorAltEl = $("floor-alt");
    const centerAltEl = $("center-alt");
    const ceilAltEl = $("ceil-alt");
    const voxelThicknessEl = $("voxel-thickness");
    const inputAltMarkerEl = $("input-alt-marker");
    const inputAltLabelEl = $("input-alt-label");
    const langSelect = $("lang-select");

    let currentLang = "ja";
    let debounceTimer = null;
    let currentLayer = null;
    let currentMarker = null;

    latEl.value = formatCoord(DEFAULT_LAT);
    lngEl.value = formatCoord(DEFAULT_LNG);
    hEl.value = String(DEFAULT_ALT);
    zEl.value = String(DEFAULT_ZOOM);

    const map = L.map("map").setView([DEFAULT_LAT, DEFAULT_LNG], 17);

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

    function minimumAltitude(z) {
      return ROOT_MIN_ALT + (MAX_ALT / (2 ** z));
    }

    function validateInputs() {
      const lat = toNumber(latEl);
      const lng = toNumber(lngEl);
      const alt = hEl.value === "" ? 0 : toNumber(hEl);
      const z = toNumber(zEl);

      if (!isInRange(lat, MIN_LAT, MAX_LAT)) {
        return { ok: false, field: "lat", message: messages[currentLang].invalidLat };
      }

      if (!isInRange(lng, MIN_LNG, MAX_LNG)) {
        return { ok: false, field: "lng", message: messages[currentLang].invalidLng };
      }

      if (!Number.isInteger(z) || !isInRange(z, MIN_Z, MAX_Z)) {
        return { ok: false, field: "zoom", message: messages[currentLang].invalidZoom };
      }

      const minAlt = minimumAltitude(z);
      if (!Number.isFinite(alt) || alt < minAlt || alt >= MAX_ALT) {
        return { ok: false, field: "alt", message: messages[currentLang].invalidAlt(minAlt) };
      }

      return { ok: true, lat, lng, alt, z };
    }

    function setValidity(state) {
      latEl.setCustomValidity("");
      lngEl.setCustomValidity("");
      hEl.setCustomValidity("");
      zEl.setCustomValidity("");

      if (state.ok) return;

      if (state.field === "lat") {
        latEl.setCustomValidity(state.message);
      }

      if (state.field === "lng") {
        lngEl.setCustomValidity(state.message);
      }

      if (state.field === "alt") {
        hEl.setCustomValidity(state.message);
      }

      if (state.field === "zoom") {
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

    function formatAltitude(value) {
      if (!Number.isFinite(value)) return "-";
      return `${new Intl.NumberFormat(currentLang, {
        maximumFractionDigits: 2
      }).format(value)} m`;
    }

    function getAltitudeRange(space) {
      const floor = Number(space.alt);
      const center = Number(space.center && space.center.alt);
      let ceil = NaN;

      if (typeof space.vertices3d === "function") {
        const altitudes = space.vertices3d().map(vertex => Number(vertex[2]));
        ceil = Math.max(...altitudes);
      }

      if (!Number.isFinite(ceil) && Number.isFinite(floor) && Number.isFinite(center)) {
        ceil = center + (center - floor);
      }

      return { floor, center, ceil };
    }

    function updateOutput(space, input) {
      zfxyEl.textContent = getZfxyString(space);
      const range = getAltitudeRange(space);
      const thickness = range.ceil - range.floor;
      const position = thickness > 0
        ? Math.min(100, Math.max(0, ((input.alt - range.floor) / thickness) * 100))
        : 0;

      floorAltEl.textContent = formatAltitude(range.floor);
      centerAltEl.textContent = formatAltitude(range.center);
      ceilAltEl.textContent = formatAltitude(range.ceil);
      voxelThicknessEl.textContent = `${translations[currentLang].thicknessLabel}: ${formatAltitude(thickness)}`;
      inputAltMarkerEl.style.setProperty("--input-position", `${position}%`);
      inputAltLabelEl.textContent = `${translations[currentLang].inputAltLabel}: ${formatAltitude(input.alt)}`;
    }

    function resetOutput() {
      zfxyEl.textContent = "-";
      floorAltEl.textContent = "-";
      centerAltEl.textContent = "-";
      ceilAltEl.textContent = "-";
      voxelThicknessEl.textContent = "-";
      inputAltMarkerEl.style.setProperty("--input-position", "0%");
      inputAltLabelEl.textContent = "-";
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
          weight: 3,
          fillOpacity: 0.24
        }
      }).addTo(map);

      currentMarker = L.circleMarker([center.lat, center.lng], {
        radius: 8,
        color: "#2457d6",
        weight: 3,
        fillColor: "#2457d6",
        fillOpacity: 0.9
      }).addTo(map);

      const bounds = currentLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [36, 36],
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

        updateOutput(space, state);
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

    calculate();
  }

  document.addEventListener("DOMContentLoaded", start);
})();
