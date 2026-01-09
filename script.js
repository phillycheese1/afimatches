// Simple CSV search using PapaParse and client-side filtering.
// Adjust `CSV_PATH` if your CSV is in a different location.
const CSV_PATH = '/afigames.csv';
let rows = [];      // array of objects (header -> value)
let headers = [];   // ordered list of columns

const el = {
  searchInput: document.getElementById('searchInput'),
  columnSelect: document.getElementById('columnSelect'),
  caseCheckbox: document.getElementById('caseCheckbox'),
  regexCheckbox: document.getElementById('regexCheckbox'),
  resultsHead: document.getElementById('resultsHead'),
  resultsBody: document.getElementById('resultsBody'),
  rowsCount: document.getElementById('rowsCount'),
};

function fetchAndParseCSV() {
  fetch(CSV_PATH)
    .then(r => {
      if (!r.ok) throw new Error('Failed to fetch CSV: ' + r.statusText);
      return r.text();
    })
    .then(text => {
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      });
      rows = parsed.data;
      headers = parsed.meta.fields || [];
      renderColumnOptions();
      renderTable(rows);
    })
    .catch(err => {
      el.resultsBody.innerHTML = `<tr><td colspan="100%">Error loading CSV: ${err.message}</td></tr>`;
      console.error(err);
    });
}

function renderColumnOptions() {
  // keep "All columns" at top
  el.columnSelect.innerHTML = '<option value="__all__">All columns</option>';
  headers.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    el.columnSelect.appendChild(opt);
  });
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
      // invalid regex
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

function filterRows() {
  const q = el.searchInput.value.trim();
  const column = el.columnSelect.value;
  const options = {
    caseSensitive: el.caseCheckbox.checked,
    regex: el.regexCheckbox.checked,
  };

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

// wire events
el.searchInput.addEventListener('input', debouncedFilter);
el.columnSelect.addEventListener('change', filterRows);
el.caseCheckbox.addEventListener('change', filterRows);
el.regexCheckbox.addEventListener('change', filterRows);

// initial load
fetchAndParseCSV();
