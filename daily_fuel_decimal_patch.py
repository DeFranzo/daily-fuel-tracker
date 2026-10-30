#!/usr/bin/env python3
"""Safe, narrowly scoped Daily Fuel patch. Run from repository root."""
from pathlib import Path
import re
import shutil
import sys

root = Path.cwd()
paths = {x: root / x for x in ('index.html', 'app.js', 'styles.css')}
missing = [name for name, p in paths.items() if not p.is_file()]
if missing:
    sys.exit('Missing files in current directory: ' + ', '.join(missing))
old = {name: p.read_text(encoding='utf-8') for name, p in paths.items()}
new = dict(old)

# The native numeric spinner doubles as a validation step constraint. Use step=any
# and custom accessible controls for fixed increment/decrement behavior.
for name, amount, maximum in [('entryCalories', '10', '15000'), ('entryProtein', '1', '500')]:
    pattern = rf'(<input\s+id="{name}"\s+type="number"[^>]*?)\s+step="(?:any|[0-9.]+)"([^>]*>)'
    match = re.search(pattern, new['index.html'])
    if not match:
        sys.exit(f'Expected numeric input {name} not found. Nothing was changed.')
    input_html = match.group(1) + ' step="any"' + match.group(2)
    # Use buttons for reliable fixed increments while allowing arbitrary decimals.
    new_markup = (f'<span class="number-stepper">{input_html}'
        f'<span class="number-stepper-actions">'
        f'<button type="button" data-adjust="-{amount}" data-for="{name}" aria-label="Decrease by {amount}">−</button>'
        f'<button type="button" data-adjust="{amount}" data-for="{name}" aria-label="Increase by {amount}">+</button>'
        f'</span></span>')
    new['index.html'] = new['index.html'][:match.start()] + new_markup + new['index.html'][match.end():]

# An input with step=any accepts decimal precision; values remain within the existing range checks.
marker_match = re.search(r"\$\('mealEntryForm'\)\.addEventListener\('submit',\s*async\s+event\s*=>\s*\{", new['app.js'])
if not marker_match:
    sys.exit('Missing meal form handler in app.js. Nothing was changed.')
marker = marker_match.group(0)
addition = '''// Fixed-size increment buttons without restricting manually entered decimals.
$('mealEntryForm').addEventListener('click', event => {
  const button = event.target.closest('button[data-adjust][data-for]');
  if (!button || !$('mealEntryForm').contains(button)) return;
  const input = $(button.dataset.for);
  if (!input) return;
  const increment = Number(button.dataset.adjust);
  const value = input.value.trim() === '' ? 0 : Number(input.value);
  if (!Number.isFinite(value) || !Number.isFinite(increment)) return;
  const minimum = Number(input.min || 0);
  const maximum = Number(input.max || Number.POSITIVE_INFINITY);
  const next = Math.min(maximum, Math.max(minimum, Math.round((value + increment) * 100) / 100));
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus({ preventScroll: true });
});

'''
if 'Fixed-size increment buttons without restricting manually entered decimals.' not in new['app.js']:
    new['app.js'] = new['app.js'].replace(marker, addition + marker, 1)
else:
    sys.exit('The decimal patch seems already applied to app.js; stop to avoid duplicates.')

new['styles.css'] += '''

/* Precise numeric input with explicit increments; mobile-first and touch-safe. */
.number-stepper {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 13px;
  overflow: hidden;
}
.entry-form .number-stepper input {
  min-width: 0;
  width: 100%;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  appearance: textfield;
  -moz-appearance: textfield;
}
.entry-form .number-stepper input::-webkit-inner-spin-button,
.entry-form .number-stepper input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.number-stepper:focus-within {
  border-color: var(--green);
  box-shadow: 0 0 0 3px #2f6b4f1a;
}
.number-stepper-actions {
  display: flex;
  gap: 1px;
  align-items: stretch;
  background: var(--border);
}
.number-stepper-actions button {
  min-width: 44px;
  min-height: 50px;
  padding: 0 8px;
  border: 0;
  border-radius: 0;
  background: var(--soft);
  color: var(--green);
  font-weight: 800;
  font-size: 1.15rem;
}
.number-stepper-actions button:hover { background: var(--light-green); }
@media (max-width: 360px) {
  .number-stepper-actions button { min-width: 40px; padding: 0 5px; }
}
/* Prevent the old 1.85rem mobile brand override from crowding Account. */
@media (max-width: 660px) {
  .brand h1 { font-size: clamp(.9rem, 3vw, 1.05rem); line-height: 1.23; }
  .brand-logo-image { width: 48px; height: 48px; }
}
'''

for name, dest in paths.items():
    backup = dest.with_suffix(dest.suffix + '.bak')
    shutil.copy2(dest, backup)
    dest.write_text(new[name], encoding='utf-8', newline='\n')
print('Updated index.html, app.js, styles.css. Original files saved as *.bak.')
print('Next: run node --check app.js; then test both manual decimal inputs and +/- buttons.')
