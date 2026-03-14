// Mini markdown renderer
export function renderMd(text) {
  if (!text) return '';
  let html = '';
  let inList = false;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('### '))     { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${inline(t.slice(4))}</h3>`; }
    else if (t.startsWith('## ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${inline(t.slice(3))}</h2>`; }
    else if (t.startsWith('- '))  { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(t.slice(2))}</li>`; }
    else if (t === '')            { if (inList) { html += '</ul>'; inList = false; } }
    else                          { if (inList) { html += '</ul>'; inList = false; } html += `<p>${inline(t)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}

function inline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/==yellow==(.*?)==\/yellow==/g, '<mark style="background:#fef08a;padding:1px 3px;border-radius:2px">$1</mark>')
    .replace(/==green==(.*?)==\/green==/g, '<mark style="background:#bbf7d0;padding:1px 3px;border-radius:2px">$1</mark>')
    .replace(/==blue==(.*?)==\/blue==/g, '<mark style="background:#bfdbfe;padding:1px 3px;border-radius:2px">$1</mark>')
    .replace(/==red==(.*?)==\/red==/g, '<mark style="background:#fecaca;padding:1px 3px;border-radius:2px">$1</mark>')
    .replace(/==purple==(.*?)==\/purple==/g, '<mark style="background:#e9d5ff;padding:1px 3px;border-radius:2px">$1</mark>')
    .replace(/==(.*?)==/g, '<mark style="background:#fef08a;padding:1px 3px;border-radius:2px">$1</mark>');
}

// Status helpers
const STATUS_LABELS = {
  todo:'○ To do', inprog:'◑ In progress', done:'✓ Done',
  blocked:'✗ Blocked', settled:'✓ Settled', provisional:'◑ Provisional',
  revisit:'⚠ Revisit', open:'● Open', resolved:'✓ Resolved', wontfix:'— Won\'t fix'
};
export function statusLabel(s) { return STATUS_LABELS[s] || s; }

const CHECK_ICONS = { done:'✓', inprog:'◑', todo:'○', blocked:'✗' };
export function checkIcon(s) { return CHECK_ICONS[s] || '○'; }

// Date helpers
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function daysFromToday(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
