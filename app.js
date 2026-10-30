"use strict";

// Data lives in meals.json. This file controls presentation only.
const DAILY_LIMIT = 1800;
const REFRESH_MS = 60_000;
const ORDER = { Morning: 1, Breakfast: 2, "Breakfast & Lunch": 3, Lunch: 4, Afternoon: 5, Snack: 6, Dinner: 7 };
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const formatDate = date => { const [y, m, d] = date.split("-"); return `${Number(d)}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]}-${y}`; };
const shortDate = date => { const [, m, d] = date.split("-"); return `${Number(d)}/${Number(m)}`; };
const shiftDate = (iso, days) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d + days)); return dt.toISOString().slice(0, 10); };

let meals = [];
let days = [];
let selectedDate = null;

function validate(data) {
  return Array.isArray(data) && data.length <= 10000 && data.every(m =>
    m && /^\d{4}-\d{2}-\d{2}$/.test(m.date) &&
    [m.meal, m.food, m.breakdown].every(s => typeof s === "string") &&
    [m.calories, m.protein].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)
  );
}

function groupDays(data) {
  const map = new Map();
  for (const meal of data) {
    if (!map.has(meal.date)) map.set(meal.date, []);
    map.get(meal.date).push(meal);
  }
  return [...map].map(([date, items]) => {
    items.sort((a, b) => (ORDER[a.meal] ?? 99) - (ORDER[b.meal] ?? 99));
    const calories = items.reduce((sum, m) => sum + m.calories, 0);
    const protein = items.reduce((sum, m) => sum + m.protein, 0);
    return { date, items, calories, protein, remaining: DAILY_LIMIT - calories };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function renderHero(day) {
  $("heroTitle").textContent = formatDate(day.date);
  $("heroSubtitle").textContent = day.remaining < 0
    ? `Over the 1,800 kcal target by ${fmt(-day.remaining)} kcal.`
    : `${fmt(day.remaining)} kcal left within the 1,800 kcal target.`;
  $("caloriesValue").textContent = fmt(day.calories);
  $("remainingValue").textContent = fmt(day.remaining);
  $("remainingText").textContent = day.remaining < 0 ? `Over by ${fmt(-day.remaining)} kcal` : "Within budget";
  $("proteinValue").textContent = fmt(day.protein);
  $("mealsValue").textContent = day.items.length;
  $("statusText").textContent = day.remaining < 0 ? "Over limit" : "Under limit";
  const percent = 100 * day.calories / DAILY_LIMIT;
  $("progressPct").textContent = `${percent.toFixed(1)}%`;
  $("progressBar").style.width = `${Math.min(100, percent)}%`;
  $("progressBar").classList.toggle("over", day.remaining < 0);
  $("progressTrack").setAttribute("aria-valuenow", String(Math.min(DAILY_LIMIT, day.calories)));
}

function renderSummary() {
  const avgCal = days.reduce((a, d) => a + d.calories, 0) / days.length;
  const avgP = days.reduce((a, d) => a + d.protein, 0) / days.length;
  const avgRemaining = DAILY_LIMIT - avgCal;
  $("averageBadge").textContent = `Average · ${fmt(avgCal)} kcal · ${fmt(avgP)}g protein`;
  $("summaryBody").innerHTML = days.map(d => `<tr class="${d.date === selectedDate ? 'selected' : ''}">
    <td><button type="button" class="date-link" data-date="${d.date}">${formatDate(d.date)}</button></td>
    <td>${fmt(d.calories)}</td><td>${fmt(d.protein)}</td><td>${fmt(DAILY_LIMIT)}</td><td>${fmt(d.remaining)}</td>
    <td><span class="pill ${d.remaining < 0 ? 'over' : 'ok'}">${d.remaining < 0 ? 'OVER LIMIT' : 'UNDER LIMIT'}</span></td></tr>`).join("") +
    `<tr class="average"><td>Average</td><td>${fmt(avgCal)}</td><td>${fmt(avgP)}</td><td>${fmt(DAILY_LIMIT)}</td><td>${fmt(avgRemaining)}</td><td><span class="pill ${avgRemaining < 0 ? 'over' : 'ok'}">${avgRemaining < 0 ? 'OVER LIMIT' : 'ON TRACK'}</span></td></tr>`;
  $("summaryBody").querySelectorAll("button[data-date]").forEach(button => {
    button.addEventListener("click", () => { selectedDate = button.dataset.date; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  });
}


function renderTrends(id, kind) {
  const lookup = new Map(days.map(d => [d.date, d]));

  // Get the available date range
  const allDates = [...lookup.keys()].sort();
  const firstDate = allDates[0];
  const lastDate = allDates[allDates.length - 1];

  // Center selected date within a 7-day window
  let startDate = shiftDate(selectedDate, -3);

  // Shift window at the beginning or end of history
  if (startDate < firstDate) {
    startDate = firstDate;
  }

  if (shiftDate(startDate, 6) > lastDate) {
    startDate = shiftDate(lastDate, -6);
  }

  // Keep the window within available history
  if (startDate < firstDate) {
    startDate = firstDate;
  }

  const dates = Array.from(
    { length: 7 },
    (_, i) => shiftDate(startDate, i)
  );

  const values = dates.map(
    date => lookup.get(date)?.[kind] ?? null
  );

  const maximum = Math.max(
    kind === "calories" ? DAILY_LIMIT : 100,
    ...values.filter(v => v !== null)
  ) * 1.08;

  $(id).innerHTML = dates.map((date, i) => {
    const val = values[i];

    const height = val === null
      ? 0
      : Math.min(100, (val / maximum) * 100);

    const classes = [
      "trend-bar",
      kind === "protein" ? "protein" : "",
      kind === "calories" && val > DAILY_LIMIT ? "over" : "",
      val === null ? "missing" : ""
    ].join(" ");

    return `
      <div class="trend-col ${date === selectedDate ? "selected" : ""}"
           title="${formatDate(date)}: ${val === null ? "No data" : fmt(val)}">
        <div class="trend-value">${val === null ? "—" : fmt(val)}</div>
        <div class="trend-track">
          <div class="${classes}" style="height:${height}%"></div>
        </div>
        <div class="trend-date">${shortDate(date)}</div>
      </div>
    `;
  }).join("");
}

function renderMeals(day) {
  $("detailBadge").textContent = `${day.items.length} meal${day.items.length === 1 ? '' : 's'}`;
  $("detailsGrid").innerHTML = day.items.map(m => {
    const lines = m.breakdown.split(/\n+/).filter(Boolean).map(line => `<li>${escapeHTML(line.replace(/^\s*-\s*/, ''))}</li>`).join("");
    return `<article class="meal-card"><div class="meal-top"><div><span class="meal-tag">${escapeHTML(m.meal)}</span>
      <h3 class="meal-title">${escapeHTML(m.food)}</h3></div><div class="meal-totals"><strong>${fmt(m.calories)} kcal</strong><span>${fmt(m.protein)}g protein</span></div></div>
      <ul class="breakdown-list">${lines}</ul></article>`;
  }).join("");
}

function render() {
  if (!days.length) return;
  if (!days.some(d => d.date === selectedDate)) selectedDate = days[0].date;
  const index = days.findIndex(d => d.date === selectedDate);
  const select = $("dateSelect");
  select.innerHTML = days.map(d => `<option value="${d.date}">${formatDate(d.date)}</option>`).join("");
  select.value = selectedDate;
  $("prevDay").disabled = index === days.length - 1;
  $("nextDay").disabled = index === 0;
  const day = days[index];
  renderHero(day); renderSummary(); renderTrends("calorieTrend", "calories"); renderTrends("proteinTrend", "protein"); renderMeals(day);
}

async function loadMeals() {
  try {
    const response = await fetch(`meals.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const latest = await response.json();
    if (!validate(latest)) throw new Error("Invalid meals.json structure");
    if (JSON.stringify(latest) !== JSON.stringify(meals)) { meals = latest; days = groupDays(meals); render(); }
    $("loadMessage").textContent = "";
  } catch (error) {
    $("loadMessage").textContent = days.length
      ? "Cannot refresh meals.json. Showing the last loaded data."
      : "Could not load meals.json. Open this project with VS Code Live Server, not as a file:// page.";
    console.error("Meal data loading failed:", error);
  }
}

$("prevDay").addEventListener("click", () => { const i = days.findIndex(d => d.date === selectedDate); if (i < days.length - 1) { selectedDate = days[i + 1].date; render(); } });
$("nextDay").addEventListener("click", () => { const i = days.findIndex(d => d.date === selectedDate); if (i > 0) { selectedDate = days[i - 1].date; render(); } });
$("dateSelect").addEventListener("change", e => { selectedDate = e.target.value; render(); });
loadMeals();
setInterval(loadMeals, REFRESH_MS);


// Publishing via authenticated GitHub Issues: no credentials are stored in the website.
const REPOSITORY = "DeFranzo/daily-fuel-tracker";
const todayLocal = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
$("entryDate").value = todayLocal();
$("mealEntryForm").addEventListener("submit", event => {
  event.preventDefault();
  const date = $("entryDate").value;
  const meal = $("entryType").value;
  const calories = Number($("entryCalories").value);
  const protein = Number($("entryProtein").value);
  const description = $("entryDescription").value.trim();
  const lines = description.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !lines.length ||
    !Number.isFinite(calories) || calories < 0 || calories > 15000 ||
    !Number.isFinite(protein) || protein < 0 || protein > 500) {
    alert("Vui lòng kiểm tra ngày, calories, protein và mô tả.");
    return;
  }
  const item = {
    date, meal,
    food: lines[0].slice(0, 350),
    breakdown: (lines.length > 1 ? lines.slice(1) : lines).join("\n"),
    calories, protein
  };
  const body = `Submit this issue to add a meal to Daily Fuel.\n\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\`\n`;
  const url = new URL(`https://github.com/${REPOSITORY}/issues/new`);
  url.searchParams.set("title", `[Meal Log] ${date} ${meal}`);
  url.searchParams.set("body", body);
  // Same-window navigation works reliably in iOS Safari and in-app browsers.
  window.location.assign(url.toString());
});
