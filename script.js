// Simple CSV search using PapaParse and client-side filtering.
// Adjust `CSV_PATH` if your CSV is in a different location.
const CSV_PATH = './afigames.csv';
let rows = [];      // array of objects (header -> value)
let headers = [];   // ordered list of columns
let columnOptionsHTML = '<option value="__all__">All columns</option>';

const el = {
  searchInput: document.getElementById('searchInput'),
  columnSelect: document.getElementById('columnSelect'),
  caseCheckbox: document.getElementById('caseCheckbox'),
  regexCheckbox: document.getElementById('regexCheckbox'),
  resultsHead: document.getElementById('resultsHead'),
  resultsBody: document.getElementById('resultsBody'),
  rowsCount: document.getElementById('rowsCount'),
  addFilterBtn: document.getElementById('addFilterBtn'),
  filtersWrap: document.getElementById('filtersWrap'),
  matchMode: document.getElementById('matchMode'),
};

function fetchAndParseCSV() {
  fetch(CSV_PATH)
    .then(r => {
      if (!r.ok) throw new Error('Failed to fetch CSV: ' + r.status + ' ' + r.statusText);
      return r.text();
    })
    .then(text => {
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      });
      rows = parsed.data;
      headers = parsed.meta.fields || [];
      buildColumnOptions();
      renderColumnOptions();
      renderTable(rows);
    })
    .catch(err => {
      el.resultsBody.innerHTML = `<tr><td colspan="100%">Error loading CSV: ${err.message}</td></tr>`;
      console.error(err);
    });
}

function buildColumnOptions() {
  // Build HTML for selects so we can reuse for each filter row
  columnOptionsHTML = '<option value="__all__">All columns</option>';
  headers.forEach(h => {
    columnOptionsHTML += `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`;
  });
}

function renderColumnOptions() {
  // populate the main column selector
  el.columnSelect.innerHTML = columnOptionsHTML;
  // update any existing filter selects
  const selects = el.filtersWrap.querySelectorAll('select.filter-col');
  selects.forEach(s => {
    const current = s.value;
    s.innerHTML = columnOptionsHTML;
    if ([...s.options].some(o => o.value === current)) {
      s.value = current;
    }
  });
}

function escapeHtml(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderTable(data) {
  // header
  el.resultsHead.innerHTML = '';
  const headRow = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  el.resultsHead.appendChild(headRow);

  // body
  el.resultsBody.innerHTML = '';
  if (!data.length) {
    el.resultsBody.innerHTML = '<tr><td colspan="100%">No results</td></tr>';
  } else {
    const fragment = document.createDocumentFragment();
    for (const row of data) {
      const tr = document.createElement('tr');
      for (const h of headers) {
        const td = document.createElement('td');
        td.textContent = row[h] ?? '';
        tr.appendChild(td);
      }
      fragment.appendChild(tr);
    }
    el.resultsBody.appendChild(fragment);
  }

  el.rowsCount.textContent = `${data.length} rows`;
}

function buildMatcher(query, options) {
  if (!query) return () => true;
  if (options.regex) {
    try {
      const flags = options.caseSensitive ? 'g' : 'gi';
      const re = new RegExp(query, flags);
      return (value) => re.test(String(value ?? ''));
    } catch (e) {
      // invalid regex -> no matches
      return () => false;
    }
  } else {
    const q = options.caseSensitive ? query : query.toLowerCase();
    return (value) => {
      const v = String(value ?? '');
      return options.caseSensitive ? v.includes(q) : v.toLowerCase().includes(q);
    };
  }
}

function getAdvancedFilters() {
  // returns array of { column, query } for each non-empty filter input
  const filters = [];
  const rows = el.filtersWrap.querySelectorAll('.filter-row');
  rows.forEach(r => {
    const col = r.querySelector('select.filter-col').value;
    const val = r.querySelector('input.filter-input').value.trim();
    if (val) filters.push({ column: col, query: val });
  });
  return filters;
}

function filterRows() {
  const options = {
    caseSensitive: el.caseCheckbox.checked,
    regex: el.regexCheckbox.checked,
  };

  const advanced = getAdvancedFilters();
  const matchMode = el.matchMode.value || 'all'; // all = AND, any = OR
  // If there are advanced filters, use them; otherwise fallback to single input & single column select
  if (advanced.length) {
    // Build matchers per filter
    const matchers = advanced.map(f => ({ column: f.column, matcher: buildMatcher(f.query, options) }));

    const filtered = rows.filter(row => {
      if (matchMode === 'any') {
        // return true if any filter matches
        return matchers.some(m => {
          if (m.column === '__all__') {
            for (const h of headers) if (m.matcher(row[h])) return true;
            return false;
          } else {
            return m.matcher(row[m.column]);
          }
        });
      } else {
        // AND: require every filter to match
        return matchers.every(m => {
          if (m.column === '__all__') {
            for (const h of headers) if (m.matcher(row[h])) return true;
            return false;
          } else {
            return m.matcher(row[m.column]);
          }
        });
      }
    });

    renderTable(filtered);
    return;
  }

  // No advanced filters: old single-search behavior
  const q = el.searchInput.value.trim();
  const column = el.columnSelect.value;
  const match = buildMatcher(q, options);
  if (!q) {
    renderTable(rows);
    return;
  }

  const filtered = rows.filter(row => {
    if (column === '__all__') {
      for (const h of headers) {
        if (match(row[h])) return true;
      }
      return false;
    } else {
      return match(row[column]);
    }
  });
  renderTable(filtered);
}

// debounce helper
function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const debouncedFilter = debounce(filterRows, 180);

// Advanced filters UI helpers
function addFilterRow(initialCol = '__all__', initialValue = '') {
  const row = document.createElement('div');
  row.className = 'filter-row';

  const sel = document.createElement('select');
  sel.className = 'filter-col';
  sel.innerHTML = columnOptionsHTML;
  sel.value = initialCol;

  const input = document.createElement('input');
  input.className = 'filter-input';
  input.type = 'text';
  input.placeholder = 'Filter value';
  input.value = initialValue;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'filter-remove';
  removeBtn.title = 'Remove filter';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    row.remove();
    filterRows();
  });

  // wire events
  input.addEventListener('input', debouncedFilter);
  sel.addEventListener('change', filterRows);

  row.appendChild(sel);
  row.appendChild(input);
  row.appendChild(removeBtn);

  el.filtersWrap.appendChild(row);
  return row;
}

// Allow adding a filter via button
el.addFilterBtn.addEventListener('click', () => addFilterRow());

// wire events for existing controls
el.searchInput.addEventListener('input', debouncedFilter);
el.columnSelect.addEventListener('change', filterRows);
el.caseCheckbox.addEventListener('change', filterRows);
el.regexCheckbox.addEventListener('change', filterRows);
el.matchMode.addEventListener('change', filterRows);

// Guard: show a clear message if PapaParse failed to load
if (typeof window.Papa === 'undefined') {
  console.error('PapaParse is not loaded. Ensure papaparse.min.js is included before script.js and remove/fix the integrity attribute.');
  const tbody = document.getElementById('resultsBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="100%">Error: PapaParse failed to load. Check the papaparse script tag and ensure it is included before script.js.</td></tr>';
  }
} else {
  // initial load
  fetchAndParseCSV();
}
