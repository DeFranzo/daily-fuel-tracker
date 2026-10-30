"use strict";

// Private Supabase database. Never put service_role/secret keys in frontend code.
let DAILY_LIMIT = 1800;
const REFRESH_MS = 60_000;
let supabaseClient;
let currentUser = null;
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
    ? `Over the ${fmt(DAILY_LIMIT)} kcal target by ${fmt(-day.remaining)} kcal.`
    : `${fmt(day.remaining)} kcal left within the ${fmt(DAILY_LIMIT)} kcal target.`;
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
  $("progressTrack").setAttribute(
    "aria-valuenow",
    String(Math.max(0, Math.min(DAILY_LIMIT, day.calories)))
  );
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
  const allDates = [...lookup.keys()].sort();
  const first = allDates[0], last = allDates[allDates.length - 1];
  let start = shiftDate(selectedDate, -3);
  if (start < first) start = first;
  if (shiftDate(start, 6) > last) start = shiftDate(last, -6);
  if (start < first) start = first;
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  const values = dates.map(date => lookup.get(date)?.[kind] ?? null);
  const maximum = Math.max(kind === "calories" ? DAILY_LIMIT : 100, ...values.filter(v => v !== null)) * 1.08;
  $(id).innerHTML = dates.map((date, i) => {
    const val = values[i];
    const height = val === null ? 0 : Math.min(100, (val / maximum) * 100);
    const classes = ["trend-bar", kind === "protein" ? "protein" : "", kind === "calories" && val > DAILY_LIMIT ? "over" : "", val === null ? "missing" : ""].join(" ");
    return `<div class="trend-col ${date === selectedDate ? 'selected' : ''}" title="${formatDate(date)}: ${val === null ? 'No data' : fmt(val)}">
      <div class="trend-value">${val === null ? '—' : fmt(val)}</div>
      <div class="trend-track"><div class="${classes}" style="height:${height}%"></div></div>
      <div class="trend-date">${shortDate(date)}</div></div>`;
  }).join("");
}

function renderMeals(day) {
  $("detailBadge").textContent = `${day.items.length} meal${day.items.length === 1 ? '' : 's'}`;
  $("detailsGrid").innerHTML = day.items.map(m => {
    const lines = m.breakdown.split(/\n+/).filter(Boolean).map(line => `<li>${escapeHTML(line.replace(/^\s*-\s*/, ''))}</li>`).join("");
    return `<article class="meal-card"><div class="meal-top"><div><span class="meal-tag">${escapeHTML(m.meal)}</span>
      <h3 class="meal-title">${escapeHTML(m.food)}</h3></div><div class="meal-totals"><strong>${fmt(m.calories)} kcal</strong><span>${fmt(m.protein)}g protein</span>
      <button type="button" class="edit-meal" data-meal-id="${escapeHTML(m.id)}" aria-label="Edit ${escapeHTML(m.meal)} meal">Edit</button></div></div>
      <ul class="breakdown-list">${lines}</ul>
    </article>`;
  }).join("");
}

// Edit a meal in place. No row is deleted or recreated.
$('detailsGrid').addEventListener('click', event => {
  const button = event.target.closest('button.edit-meal');
  if (!button || !currentUser) return;
  const entry = meals.find(m => String(m.id) === button.dataset.mealId);
  if (!entry) return;
  const card = button.closest('.meal-card');
  if (card.querySelector('.meal-edit-form')) return;
  const form = document.createElement('form');
  form.className = 'entry-form meal-edit-form';
  form.innerHTML = `
    <div class="entry-row">
      <label>Date<input name="date" type="date" required></label>
      <label>Meal Type<select name="meal" required>
        ${Object.keys(ORDER).map(type => `<option value="${escapeHTML(type)}">${escapeHTML(type)}</option>`).join('')}
      </select></label>
    </div>
    <div class="entry-row">
      <label>Calories (kcal)<input name="calories" type="number" min="0" max="15000" step="any" inputmode="decimal" required></label>
      <label>Protein (g)<input name="protein" type="number" min="0" max="500" step="any" inputmode="decimal" required></label>
    </div>
    <label>Meal Details<textarea name="description" rows="5" maxlength="6000" required></textarea></label>
    <div class="edit-controls">
      <button type="button" class="delete-meal">Delete meal</button>
      <div class="edit-primary-actions">
        <button type="button" class="secondary-button cancel-edit">Cancel</button>
        <button type="submit" class="entry-submit">Save changes</button>
      </div>
    </div>
    <p class="form-feedback" role="status" aria-live="polite"></p>`;
  card.appendChild(form);
  form.elements.namedItem('date').value = entry.date;
  form.elements.namedItem('meal').value = entry.meal;
  form.elements.namedItem('calories').value = entry.calories;
  form.elements.namedItem('protein').value = entry.protein;
  form.elements.namedItem('description').value = [entry.food, entry.breakdown].filter(Boolean).join('\n');
  button.hidden = true;
  form.querySelector('.cancel-edit').addEventListener('click', () => { form.remove(); button.hidden = false; });
  form.querySelector('.delete-meal').addEventListener('click', async () => {
    if (!currentUser || !supabaseClient) return;
    const confirmed = window.confirm(`Permanently delete this ${entry.meal} meal from ${formatDate(entry.date)}?\n\n${entry.food}\n\nThis cannot be undone.`);
    if (!confirmed) return;
    const feedback = form.querySelector('.form-feedback');
    const buttons = Array.from(form.querySelectorAll('button'));
    buttons.forEach(b => b.disabled = true);
    feedback.textContent = 'Deleting meal…';
    try {
      const { data, error } = await supabaseClient.from('meals')
        .delete()
        .eq('id', entry.id)
        .eq('user_id', currentUser.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('No meal deleted. Check your Supabase DELETE RLS policy.');
      await loadMeals();
      // If the selected date has no more entries, the existing render selects the latest available date.
      form.remove();
    } catch (error) {
      console.error('Meal deletion failed:', error);
      feedback.textContent = 'Could not delete: ' + (error?.message || 'Unknown error');
      buttons.forEach(b => b.disabled = false);
    }
  });

  form.addEventListener('submit', async submitEvent => {
    submitEvent.preventDefault();
    const feedback = form.querySelector('.form-feedback');
    if (!form.reportValidity()) return;
    const fields = form.elements;
    const text = fields.namedItem('description').value.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const cal = Number(fields.namedItem('calories').value), pro = Number(fields.namedItem('protein').value);
    if (!text.length || text[0].length > 350 || !Number.isFinite(cal) || cal < 0 || cal > 15000 || !Number.isFinite(pro) || pro < 0 || pro > 500) {
      feedback.textContent = 'Check the meal name, calories, protein and details.'; return;
    }
    const save = form.querySelector('button[type="submit"]');
    save.disabled = true; feedback.textContent = 'Saving changes…';
    try {
      const update = {
        date: fields.namedItem('date').value, meal: fields.namedItem('meal').value,
        calories: cal, protein: pro, food: text[0], breakdown: text.slice(1).join('\n')
      };
      const { data, error } = await supabaseClient.from('meals').update(update)
        .eq('id', entry.id).eq('user_id', currentUser.id).select('id');
      if (error) throw error;
      if (!data?.length) throw Error('No meal updated. Check the Supabase UPDATE RLS policy.');
      selectedDate = update.date;
      await loadMeals();
    } catch (error) {
      console.error('Meal update failed:', error);
      feedback.textContent = 'Could not save: ' + (error?.message || 'Unknown error');
      save.disabled = false;
    }
  });
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

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



async function loadProfile() {
  if (!currentUser || !supabaseClient) return;

  const userId = currentUser.id;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('daily_calorie_limit')
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  if (currentUser?.id !== userId) return;

  const limit = Number(data.daily_calorie_limit);

  if (!Number.isInteger(limit) || limit < 500 || limit > 10000) {
    throw new Error('Invalid daily calorie target.');
  }

  DAILY_LIMIT = limit;

  $('dailyLimitInput').value = limit;
  $('headerLimitLabel').textContent =
    `${fmt(limit)} kcal daily target`;
  $('trendLimitLabel').textContent =
    `Daily limit · ${fmt(limit)} kcal`;

  $('progressTrack').setAttribute(
    'aria-valuemax',
    String(limit)
  );
}


async function loadMeals() {
  if (!currentUser) return;
  try {
    await loadProfile();
    // Owner-scoped query; Supabase Row Level Security enforces ownership as well.
    const { data, error } = await supabaseClient.from('meals')
      .select('id,date,meal,food,breakdown,calories,protein')
      .order('date', { ascending: false }).limit(10000);
    if (error) throw error;
    if (!currentUser) return; // Sign-out may have occurred while loading.
    const parsed = (data || []).map(m => ({ ...m, calories: Number(m.calories), protein: Number(m.protein) }));
    if (!validate(parsed)) throw Error('Unexpected nutrition records');
    meals = parsed;
    days = groupDays(meals);
    if (days.length) render();
    else {
      $('summaryBody').replaceChildren();
      $('detailsGrid').textContent = 'No meals yet. Add your first meal below.';
      $('calorieTrend').replaceChildren(); $('proteinTrend').replaceChildren();
      $('averageBadge').textContent = 'No data yet';
      $('heroTitle').textContent = 'No meals yet';
      for (const k of ['caloriesValue', 'remainingValue', 'proteinValue', 'mealsValue', 'progressPct']) $(k).textContent = '—';
      $('detailBadge').textContent = '0 meals';
    }
    $('loadMessage').textContent = '';
  } catch (error) { $('loadMessage').textContent = 'Could not load private meals: ' + error.message; }
}

function todayLocal() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
$('entryDate').value = todayLocal();
$('prevDay').addEventListener('click', () => { const i = days.findIndex(d => d.date === selectedDate); if (i < days.length - 1) { selectedDate = days[i + 1].date; render(); } });
$('nextDay').addEventListener('click', () => { const i = days.findIndex(d => d.date === selectedDate); if (i > 0) { selectedDate = days[i - 1].date; render(); } });
$('dateSelect').addEventListener('change', event => { selectedDate = event.target.value; render(); });


function setAuthUI(user) {
  currentUser = user;

  $('authPanel').hidden = !!user;
  $('loginForm').hidden = !!user;
  $('signedInTools').hidden = !user;
  $('privateContent').hidden = !user;

  $('authStatus').textContent = user ? 'Signed in' : 'Private';
  $('signedInEmail').textContent = user?.email || '';

  $('accountMenu').hidden = true;
  $('accountButton').setAttribute('aria-expanded', 'false');

  if (!user) {
    meals = [];
    days = [];
    selectedDate = null;
    DAILY_LIMIT = 1800;

    $('dailyLimitInput').value = '';
    $('goalMessage').textContent = '';

    $('headerLimitLabel').textContent = '1,800 kcal daily target';
    $('trendLimitLabel').textContent = 'Daily limit · 1,800 kcal';
    $('progressTrack').setAttribute('aria-valuemax', '1800');
  }
}


$('accountButton').addEventListener('click', () => {
  const menu = $('accountMenu');
  menu.hidden = !menu.hidden;
  $('accountButton').setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('click', event => {
  if (!$('signedInTools').contains(event.target)) {
    $('accountMenu').hidden = true;
    $('accountButton').setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    $('accountMenu').hidden = true;
    $('accountButton').setAttribute('aria-expanded', 'false');
  }
});

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const message = $('authMessage');
  const button = $('loginButton');
  const emailInput = $('loginEmail'), passwordInput = $('loginPassword');
  const email = emailInput.value.trim(), password = passwordInput.value;
  const emailError = $('emailError'), passwordError = $('passwordError');
  emailError.textContent = ''; passwordError.textContent = ''; message.textContent = '';
  emailInput.removeAttribute('aria-invalid'); passwordInput.removeAttribute('aria-invalid');
  let invalid = false;
  if (!email) { emailError.textContent = 'Email is required.'; invalid = true; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailError.textContent = 'Enter a valid email address.'; invalid = true; }
  if (!password) { passwordError.textContent = 'Password is required.'; invalid = true; }
  if (emailError.textContent) emailInput.setAttribute('aria-invalid', 'true');
  if (passwordError.textContent) passwordInput.setAttribute('aria-invalid', 'true');
  if (invalid) { (emailError.textContent ? emailInput : passwordInput).focus(); return; }
  message.textContent = 'Signing in…';
  button.disabled = true;
  try {
    if (!supabaseClient) throw Error('Supabase is not ready. Refresh the page and retry.');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.user) throw Error('Supabase did not return an authenticated user.');
    $('loginPassword').value = '';
    setAuthUI(data.user);
    message.textContent = 'Signed in.';
    await loadMeals();
  } catch (error) {
    console.error('Sign in failed:', error);
    message.textContent = /invalid login credentials|invalid credentials/i.test(error?.message || '') ? 'Incorrect email or password.' : (error?.message || 'Unable to sign in. Please try again.');
  } finally {
    button.disabled = false;
  }
});

$('signOutButton').addEventListener('click', async () => {
  const button = $('signOutButton');
  const message = $('authMessage');
  button.disabled = true;
  message.textContent = 'Signing out…';
  try {
    if (!supabaseClient) throw Error('Supabase is not ready.');
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setAuthUI(null);
    message.textContent = 'Signed out.';
  } catch (error) {
    console.error('Sign out failed:', error);
    message.textContent = `Could not sign out: ${error?.message || 'Unknown error'}`;
  } finally {
    button.disabled = false;
  }
});

$('mealEntryForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  const date = $('entryDate').value, meal = $('entryType').value;
  const calories = Number($('entryCalories').value), protein = Number($('entryProtein').value);
  const lines = $('entryDescription').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !lines.length || !Number.isFinite(calories) || calories < 0 || calories > 15000 || !Number.isFinite(protein) || protein < 0 || protein > 500) {
    alert('Check date, calories, protein and meal details.'); return;
  }
  const button = event.submitter || $('mealEntryForm').querySelector('button[type=submit]');
  button.disabled = true;
  const item = {
    user_id: currentUser.id, date, meal, food: lines[0].slice(0, 350),
    breakdown: (lines.length > 1 ? lines.slice(1) : lines).join('\n'), calories, protein
  };
  const { error } = await supabaseClient.from('meals').insert(item);
  button.disabled = false;
  if (error) { alert('Could not save meal: ' + error.message); return; }
  $('entryCalories').value = ''; $('entryProtein').value = ''; $('entryDescription').value = '';
  selectedDate = date;
  await loadMeals();
  alert('Meal saved!');
});

$('importButton').addEventListener('click', async () => {
  if (!currentUser) return;
  const file = $('historyFile').files?.[0];
  if (!file) { $('importMessage').textContent = 'Choose a JSON file first.'; return; }
  const label = $('importMessage');
  try {
    const old = JSON.parse(await file.text());
    if (!validate(old)) throw Error('Invalid history JSON');
    const incoming = old.map(m => ({
      user_id: currentUser.id, date: m.date, meal: m.meal, food: m.food,
      breakdown: m.breakdown, calories: m.calories, protein: m.protein,
      legacy_key: `${m.date}|${m.meal}|${m.food}`
    }));
    const unique = new Set(incoming.map(m => m.legacy_key));
    if (unique.size !== incoming.length) throw Error('Duplicate historic meal keys; please check your JSON.');
    if (!confirm(`Import ${incoming.length} historical meals into your private Supabase account?`)) return;
    $('importButton').disabled = true;
    const { error } = await supabaseClient.from('meals').upsert(incoming, {
      onConflict: 'user_id,legacy_key', ignoreDuplicates: true
    });
    if (error) throw error;
    label.textContent = `Imported ${incoming.length} records (existing duplicates ignored).`;
    await loadMeals();
  } catch (e) { label.textContent = e.message; }
  finally { $('importButton').disabled = false; }
});


$('calorieGoalForm').addEventListener('submit', async event => {
  event.preventDefault();

  if (!currentUser || !supabaseClient) return;

  const input = $('dailyLimitInput');
  const message = $('goalMessage');
  const button = event.currentTarget.querySelector(
    'button[type="submit"]'
  );

  const target = Number(input.value);

  if (!Number.isInteger(target) || target < 500 || target > 10000) {
    message.textContent = 'Enter a target between 500 and 10,000 kcal.';
    return;
  }

  button.disabled = true;
  message.textContent = 'Saving...';

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .update({ daily_calorie_limit: target })
      .eq('user_id', currentUser.id)
      .select('daily_calorie_limit')
      .single();

    if (error) throw error;

    DAILY_LIMIT = data.daily_calorie_limit;

    days = groupDays(meals);

    await loadMeals();

    message.textContent = 'Target updated.';
  } catch (error) {
    message.textContent = `Could not save: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});

async function init() {
  try {
    const config = window.DAILY_FUEL_SUPABASE;
    if (!config?.url || !config?.publishableKey || config.url.includes('YOUR_PROJECT')) {
      throw Error('Configure supabase-config.js with your project URL and publishable/anon key.');
    }
    if (!window.supabase?.createClient) throw Error('Supabase library could not load. Check your internet connection.');
    supabaseClient = window.supabase.createClient(config.url, config.publishableKey);
    const { data, error } = await supabaseClient.auth.getUser();
    if (error && !/session missing/i.test(error.message)) throw error;
    setAuthUI(data?.user ?? null);
    if (currentUser) await loadMeals();
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setAuthUI(null);
      if (event === 'SIGNED_IN' && session?.user && session.user.id !== currentUser?.id) {
        setAuthUI(session.user);
        // Avoid blocking auth callback: next event loop handles network request.
        Promise.resolve().then(() => loadMeals());
      }
    });
    setInterval(() => { if (currentUser) loadMeals(); }, REFRESH_MS);
  } catch (error) { $('authMessage').textContent = error.message; }
}
init();
