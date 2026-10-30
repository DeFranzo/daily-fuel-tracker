'use strict';
// Daily Fuel targeted maintenance patch: run from repository root with node.
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const jsPath = path.join(root, 'app.js');
const cssPath = path.join(root, 'styles.css');
if (!fs.existsSync(jsPath) || !fs.existsSync(cssPath)) {
  console.error('Run this script inside daily-fuel-tracker (where app.js and styles.css live).');
  process.exit(1);
}
let js = fs.readFileSync(jsPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
const originalJs = js, originalCss = css;
function replaceOnce(source, find, replacement, name) {
  const start = source.indexOf(find);
  if (start < 0) throw Error(`Pattern not found: ${name}. No files modified.`);
  if (source.indexOf(find, start + find.length) !== -1) throw Error(`Multiple matches: ${name}. No files modified.`);
  return source.slice(0, start) + replacement + source.slice(start + find.length);
}
try {
  // Pause background refresh while there are unsaved edits (including a pending delete/update).
  // Manual post-save loadMeals() remains unaffected.
  js = replaceOnce(js,
    'setInterval(() => { if (currentUser) loadMeals(); }, REFRESH_MS);',
    `setInterval(() => {
      if (!currentUser || document.querySelector('.meal-edit-form')) return;
      loadMeals();
    }, REFRESH_MS);`, 'background refresh guard');
  // The timer can have a response in flight already when Edit starts: never rerender it.
  js = replaceOnce(js,
    "    if (!currentUser) return; // Sign-out may have occurred while loading.",
    `    if (!currentUser) return; // Sign-out may have occurred while loading.
    // Prevent an in-flight background response replacing a currently open editor.
    if (options?.background && document.querySelector('.meal-edit-form')) return;`,
    'in-flight refresh guard');
  js = replaceOnce(js,
    'async function loadMeals() {',
    'async function loadMeals(options = {}) {', 'loadMeals options');
  js = replaceOnce(js,
    `      loadMeals();
    }, REFRESH_MS);`,
    `      loadMeals({ background: true });
    }, REFRESH_MS);`, 'background refresh marker');
  // Guard against failed network calls. Never clear the form unless insert succeeded.
  const startMarker = "  const { error } = await supabaseClient.from('meals').insert(item);";
  const endMarker = "  alert('Meal saved!');";
  const start = js.indexOf(startMarker);
  const end = js.indexOf(endMarker, start);
  if (start < 0 || end < 0 || js.indexOf(startMarker, start + 1) >= 0) throw Error('Save Meal block not found or ambiguous.');
  js = js.slice(0, start) + `  try {
    const { error } = await supabaseClient.from('meals').insert(item);
    if (error) throw error;

    $('entryCalories').value = '';
    $('entryProtein').value = '';
    $('entryDescription').value = '';
    selectedDate = date;
    await loadMeals();
    alert('Meal saved!');
  } catch (error) {
    console.error('Meal saving failed:', error);
    alert('Could not save meal: ' + (error?.message || 'Network error. Please try again.'));
  } finally {
    button.disabled = false;
  }` + js.slice(end + endMarker.length);
  // Remove duplicated mobile brand overrides and keep only one responsive size definition.
  const oversizedBrand = `@media (max-width: 660px) {
  .brand {
    align-items: center;
    gap: 0.875rem;
  }

  .brand-logo-image {
    width: 52px;
    height: 52px;
  }

  .brand h1 {
    font-size: 1.85rem;
    line-height: 1.1;
  }

  .brand p {
    margin-top: 0.2rem;
  }
}`;
  if (css.includes(oversizedBrand)) css = replaceOnce(css, oversizedBrand, '', 'oversized mobile brand');
  const brandOverride = `/* Prevent the old 1.85rem mobile brand override from crowding Account. */
@media (max-width: 660px) {
  .brand h1 { font-size: clamp(.9rem, 3vw, 1.05rem); line-height: 1.23; }
  .brand-logo-image { width: 48px; height: 48px; }
}`;
  if (css.includes(brandOverride)) css = replaceOnce(css, brandOverride, '', 'mobile brand override');
  // Put mobile brand sizing in the main responsive block, once.
  const responsiveBrand = `@media (max-width: 659px) {
  .brand { gap: .875rem; }
  .brand h1 { font-size: clamp(.9rem, 3vw, 1.05rem); line-height: 1.23; }
  .brand-logo-image { width: 48px; height: 48px; }
}`;
  css += '\n' + responsiveBrand + '\n';
  // Obsolete glyph logo style: HTML now uses img.brand-logo-image.
  css = css.replace(/\.brand-logo\s*\{[^{}]*\}\s*/g, '');
  // Remove redundant base .brand block when it repeats same display + align already configured.
  const extraBrand = `.brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}`;
  if (css.includes(extraBrand)) css = replaceOnce(css, extraBrand, '', 'repeated brand styling');
  // CSS-specific duplicate rules for the edit date input are subsumed by the generalized date selector.
  const extraDateInput = `.meal-edit-form .date-input-wrapper input[type="date"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  max-width: 100%;
  opacity: 0;
}`;
  if (css.includes(extraDateInput)) css = replaceOnce(css, extraDateInput, '', 'redundant edit date input');
  // The supplied CSS contained a duplicated/unclosed focus-within block. Normalize its entire region.
  const cssBegin = css.indexOf('.date-input-wrapper:focus-within');
  const cssEnd = css.indexOf('/* Authentication */', cssBegin);
  if (cssBegin < 0 || cssEnd < 0) throw Error('Could not locate CSS date/auth boundary.');
  css = css.slice(0, cssBegin) + `.date-input-wrapper:focus-within {
  border-color: var(--green);
  box-shadow: 0 0 0 3px #2f6b4f1a;
}

/* Prevent horizontal overflow in Edit Meal */
.meal-edit-form,
.meal-edit-form .entry-row,
.meal-edit-form label,
.meal-edit-form .date-input-wrapper {
  min-width: 0;
  max-width: 100%;
}

/* Authentication */` + css.slice(cssEnd + '/* Authentication */'.length);
  // There may be a second stray Authentication marker and brace from the earlier broken patch.
  css = css.replace(/\/\* Authentication \*\/\s*\}\s*\/\* Authentication \*\//, '/* Authentication */');
  // Ensure all braces balance, ignore comment contents and quoted strings.
  let stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
  let depth = 0;
  for (const ch of stripped) { if (ch === '{') depth++; if (ch === '}') depth--; if (depth < 0) throw Error('CSS braces invalid.'); }
  if (depth !== 0) throw Error('CSS braces unbalanced.');
  fs.writeFileSync(jsPath + '.bak', originalJs);
  fs.writeFileSync(cssPath + '.bak', originalCss);
  fs.writeFileSync(jsPath, js);
  fs.writeFileSync(cssPath, css);
  console.log('Updated app.js and styles.css. Backups: app.js.bak and styles.css.bak');
  console.log('Next: node --check app.js && git diff --check');
} catch (err) {
  console.error('Patch aborted:', err.message);
  process.exitCode = 1;
}
