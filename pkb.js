var list = [];
var ctr = {};
var delIdx = -1;
var editIdx = -1;
var isAdmin = false;
var historyList = [];
var currentAdmin = '';
var APP_ID = 'pkb';
var persistTimer = null;

function today() {
  return new Date().toISOString().split('T')[0];
}

function rom(m) {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][m - 1];
}
function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmt(d) {
  if (!d) return '';
  var p = String(d).split('T')[0].split('-');
  var y = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  var day = parseInt(p[2], 10);
  if (!isNaN(y) && !isNaN(m) && !isNaN(day)) return pad2(day) + '/' + pad2(m) + '/' + String(y);
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return pad2(dt.getDate()) + '/' + pad2(dt.getMonth() + 1) + '/' + dt.getFullYear();
}
function cleanSpaces(v) {
  return (v || '').replace(/\s+/g, ' ').trim();
}
function cleanPersonName(v) {
  return cleanSpaces((v || '').replace(/[^0-9A-Za-z\s.,'"-]/g, ''));
}
function filterNameChars(v) {
  return (v || '').replace(/[^0-9A-Za-z\s.,'"-]/g, '');
}
function toProperCase(v) {
  return cleanSpaces(v).toLowerCase().replace(/\b[a-z0-9]/g, function (ch) { return ch.toUpperCase(); });
}
function normNomor(v) {
  return cleanSpaces(v).toUpperCase().replace(/\s*/g, '');
}
function isValidDateStr(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  var p = v.split('-');
  var y = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  var d = parseInt(p[2], 10);
  var dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === (m - 1) && dt.getDate() === d;
}
function isNomorPkbFormat(v) {
  return /^\d{4}\/99\/[IVXLCDM]+\/\d{4}$/i.test(cleanSpaces(v));
}
function fmtDateTime(d) {
  if (!d) return '';
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return pad2(dt.getDate()) + '/' + pad2(dt.getMonth() + 1) + '/' + dt.getFullYear() + ' ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
}
function safeFileStamp() {
  var d = new Date();
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
}
function monthLabel(key) {
  var p = (key || '').split('-');
  var m = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return p.length === 2 ? (m[parseInt(p[1], 10) - 1] + ' ' + p[0]) : key;
}
function activeYear() {
  var val = (document.getElementById('ft') || {}).value;
  return isValidDateStr(val) ? val.split('-')[0] : String(new Date().getFullYear());
}
function escHtml(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function lineVal(v) {
  return cleanSpaces(v || '') || '-';
}
function summarizePkb(item) {
  return [
    'Nomor: ' + lineVal(item.nomor),
    'Tanggal: ' + lineVal(fmt(item.tgl)),
    'Pembuat: ' + lineVal(item.pembuat)
  ].join('\n');
}
function hasDuplicateNomor(nomor, skipIdx) {
  var target = normNomor(nomor);
  return list.some(function (item, i) {
    return i !== skipIdx && normNomor(item.nomor || '') === target;
  });
}
function sanitizeNameInput(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var next = filterNameChars(el.value);
  if (el.value !== next) el.value = next;
}

function queuePersist() {
  if (!(window.cloudStore && cloudStore.isReady())) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(function () {
    persistState().catch(function () {
      toast('Gagal menyimpan ke cloud. Cek koneksi atau konfigurasi cloud.', true);
    });
  }, 160);
}
async function persistState() {
  if (!(window.cloudStore && cloudStore.isReady())) return;
  await cloudStore.saveAppState(APP_ID, { data: list, counters: ctr, history: historyList });
}
function save() {
  queuePersist();
}
function saveHistory() {
  queuePersist();
}
function saveCtr() {
  queuePersist();
}

async function load() {
  if (!(window.cloudStore && cloudStore.isReady())) {
    list = [];
    historyList = [];
    ctr = {};
    throw new Error('Cloud config belum siap. Isi file cloud-config.js');
  }
  var state = await cloudStore.loadAppState(APP_ID);
  list = Array.isArray(state.data) ? state.data : [];
  historyList = Array.isArray(state.history) ? state.history : [];
  ctr = state.counters && typeof state.counters === 'object' && !Array.isArray(state.counters) ? state.counters : {};
  syncCtrWithList();
}

function syncCtrWithList(forceFromList) {
  var next = forceFromList ? {} : Object.assign({}, ctr || {});
  list.forEach(function (item) {
    var p = (item.tgl || '').split('-');
    var key = p[0];
    var n = parseInt((item.nomor || '').split('/')[0], 10);
    if (!key || isNaN(n)) return;
    if (next[key] == null || next[key] === '' || isNaN(parseInt(next[key], 10))) next[key] = 0;
    if (forceFromList || !(key in ctr)) next[key] = Math.max(next[key] || 0, n);
  });
  Object.keys(next).forEach(function (key) {
    var n = parseInt(next[key], 10);
    next[key] = isNaN(n) || n < 0 ? 0 : n;
  });
  ctr = next;
  saveCtr();
}

function mkNomor(tgl, pembuat, seq) {
  if (!tgl || !pembuat || !pembuat.trim()) return '- Lengkapi form di bawah -';
  var p = tgl.split('-');
  var yr = p[0];
  var mo = p[1];
  var key = yr;
  var n = seq !== undefined ? seq : ((ctr[key] || 0) + 1);
  return String(n).padStart(4, '0') + '/99/' + rom(parseInt(mo, 10)) + '/' + yr;
}

function seqOf(item) {
  var n = parseInt(((item && item.nomor) || '').split('/')[0], 10);
  return isNaN(n) ? 0 : n;
}

function upv() {
  var tgl = document.getElementById('ft').value;
  var pembuat = filterNameChars(document.getElementById('fb').value);
  document.getElementById('fb').value = pembuat;
  var box = document.getElementById('previewBox');
  var pv = document.getElementById('pv');
  var pvh = document.getElementById('pvh');
  var ok = !!(tgl && cleanSpaces(pembuat));
  pv.textContent = mkNomor(tgl, cleanSpaces(pembuat));
  box.className = 'preview-box ' + (ok ? 'ready' : 'incomplete');
  pvh.className = 'preview-hint ' + (ok ? 'ok' : 'warn');
  pvh.textContent = ok ? 'Isi Pembuat & kllik Simpan PKB.' : 'Lengkapi tanggal dan pembuat agar preview nomor PKB muncul otomatis.';
}

function toast(msg, err) {
  var t = document.getElementById('toast');
  t.className = 'toast ' + (err ? 'err' : 'ok');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
}

function openAdminLogin() {
  document.getElementById('adminName').value = currentAdmin || '';
  document.getElementById('adminPass').value = '';
  document.getElementById('adminModal').classList.add('show');
  setTimeout(function () { (document.getElementById('adminName').value ? document.getElementById('adminPass') : document.getElementById('adminName')).focus(); }, 30);
}

function closeAdminLogin() {
  document.getElementById('adminModal').classList.remove('show');
}

async function loginAdmin() {
  if (!(window.cloudStore && cloudStore.isReady())) { toast('Cloud belum dikonfigurasi. Isi cloud-config.js', true); return; }
  var email = cleanSpaces(document.getElementById('adminName').value).toLowerCase();
  var pass = document.getElementById('adminPass').value || '';
  document.getElementById('adminName').value = email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Email admin tidak valid', true); return; }
  if (!pass) { toast('Password admin wajib diisi', true); return; }
  try {
    var user = await cloudStore.signIn(email, pass);
    if (!cloudStore.isAdminEmail(user && user.email ? user.email : '')) {
      await cloudStore.signOut();
      toast('Akun ini bukan admin yang diizinkan', true);
      return;
    }
    closeAdminLogin();
    toast('Login admin berhasil');
  } catch (e) {
    toast('Login gagal. Periksa email/password admin', true);
  }
}

async function logoutAdmin() {
  if (window.cloudStore && cloudStore.isReady()) {
    try { await cloudStore.signOut(); } catch (e) {}
  }
  isAdmin = false;
  currentAdmin = '';
  updateAdminUI();
  closeEdit();
  closeHistory();
  closeExportModal();
  render();
  toast('Mode admin dinonaktifkan');
}

function updateAdminUI() {
  document.getElementById('adminBtn').style.display = isAdmin ? 'none' : '';
  document.getElementById('historyBtn').style.display = isAdmin ? '' : 'none';
  document.getElementById('adminLogoutBtn').style.display = isAdmin ? '' : 'none';
  document.getElementById('backupTools').style.display = isAdmin ? 'flex' : 'none';
}
function applyCloudAuth(user) {
  var email = user && user.email ? String(user.email).toLowerCase() : '';
  isAdmin = !!(email && window.cloudStore && cloudStore.isAdminEmail(email));
  currentAdmin = isAdmin ? email : '';
  updateAdminUI();
  render();
}
function addHistoryEntry(action, beforeText, afterText) {
  historyList.unshift({
    action: action || 'Edit',
    at: new Date().toISOString(),
    by: currentAdmin || 'Admin',
    before: beforeText || '-',
    after: afterText || '-'
  });
  if (historyList.length > 100) historyList = historyList.slice(0, 100);
  saveHistory();
}
function addHistoryLog(action, beforeItem, afterItem) {
  addHistoryEntry(action, summarizePkb(beforeItem || {}), afterItem ? summarizePkb(afterItem) : 'Data dihapus');
}
function renderHistory() {
  var box = document.getElementById('historyList');
  if (!box) return;
  if (!historyList.length) {
    box.innerHTML = '<div class="empty-row">Belum ada riwayat aktivitas.</div>';
    return;
  }
  box.innerHTML = historyList.map(function (item) {
    return '<div class="history-item">' +
      '<div class="history-meta">' +
        '<span class="history-badge">' + (item.action || 'Edit') + ' oleh ' + item.by + '</span>' +
        '<span class="history-time">' + fmtDateTime(item.at) + '</span>' +
      '</div>' +
      '<div class="history-grid">' +
        '<div class="history-block"><div class="history-label">Data Lama</div><div class="history-pre">' + item.before + '</div></div>' +
        '<div class="history-block"><div class="history-label">Data Baru</div><div class="history-pre">' + item.after + '</div></div>' +
      '</div>' +
    '</div>';
  }).join('');
}
function downloadBackup() {
  var payload = {
    app: 'pkb',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: list,
    counters: ctr,
    history: historyList
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'backup-pkb-' + safeFileStamp() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Backup JSON berhasil diunduh');
}
function downloadExcel() {
  var selected = (document.getElementById('exportMonth') || {}).value || 'all';
  var filtered = (selected === 'all' ? list : list.filter(function (item) { return (item.tgl || '').slice(0, 7) === selected; })).slice().reverse();
  var rows = filtered.map(function (item, idx) {
    return [
      idx + 1,
      fmt(item.tgl),
      item.nomor || '',
      item.pembuat || ''
    ];
  });
  if (!rows.length) { toast('Tidak ada data pada periode yang dipilih.', true); return; }
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' +
    '<table border="1"><tr><th>No.</th><th>Tanggal</th><th>Nomor PKB</th><th>Pembuat</th></tr>' +
    rows.map(function (row) {
      return '<tr>' + row.map(function (cell) { return '<td>' + escHtml(cell) + '</td>'; }).join('') + '</tr>';
    }).join('') +
    '</table></body></html>';
  var blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'pkb-' + (selected === 'all' ? 'semua' : selected) + '-' + safeFileStamp() + '.xls';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeExportModal();
  toast('Export Excel berhasil diunduh');
}
function openExportModal() {
  if (!isAdmin) { toast('Login sebagai admin untuk export Excel', true); return; }
  if (!list.length) { toast('Belum ada data untuk diexport.', true); return; }
  var select = document.getElementById('exportMonth');
  var map = {};
  list.forEach(function (item) { var k = (item.tgl || '').slice(0, 7); if (k) map[k] = 1; });
  var opts = Object.keys(map).sort().reverse();
  select.innerHTML = '<option value="all">Semua Data</option>' + opts.map(function (k) { return '<option value="' + k + '">' + monthLabel(k) + '</option>'; }).join('');
  document.getElementById('exportModal').classList.add('show');
}
function closeExportModal() {
  var modal = document.getElementById('exportModal');
  if (modal) modal.classList.remove('show');
}
function triggerRestoreInput() {
  var input = document.getElementById('restoreFile');
  if (!input) return;
  input.value = '';
  input.click();
}
function closeJsonMenus() {
  document.querySelectorAll('.json-menu.open').forEach(function (el) { el.classList.remove('open'); });
}
function toggleJsonMenu(event, id) {
  if (event) event.stopPropagation();
  var menu = document.getElementById(id);
  if (!menu) return;
  var willOpen = !menu.classList.contains('open');
  closeJsonMenus();
  if (willOpen) menu.classList.add('open');
}
function jsonActionBackup(id) {
  closeJsonMenus();
  downloadBackup();
}
function jsonActionUpload(id) {
  closeJsonMenus();
  triggerRestoreInput();
}
function handleRestoreFile(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var parsed = JSON.parse(reader.result);
      if (!parsed || parsed.app !== 'pkb' || !Array.isArray(parsed.data)) {
        toast('File backup tidak cocok untuk PKB.', true);
        return;
      }
      list = parsed.data;
      historyList = Array.isArray(parsed.history) ? parsed.history : [];
      ctr = parsed.counters && typeof parsed.counters === 'object' && !Array.isArray(parsed.counters) ? parsed.counters : {};
      save();
      saveHistory();
      syncCtrWithList();
      render();
      stats();
      upv();
      closeHistory();
      toast('Restore JSON PKB berhasil');
    } catch (e) {
      toast('File JSON tidak valid atau gagal dibaca.', true);
    }
  };
  reader.readAsText(file);
}
function openHistory() {
  if (!isAdmin) { toast('Login sebagai admin untuk melihat riwayat aktivitas', true); return; }
  renderHistory();
  document.getElementById('historyModal').classList.add('show');
}
function closeHistory() {
  var modal = document.getElementById('historyModal');
  if (modal) modal.classList.remove('show');
}

function simpan() {
  var tgl = document.getElementById('ft').value;
  var pembuat = toProperCase(cleanPersonName(document.getElementById('fb').value));
  document.getElementById('fb').value = pembuat;
  if (!tgl) { toast('Tanggal wajib diisi', true); return; }
  if (!isValidDateStr(tgl)) { toast('Tanggal tidak valid. Gunakan format tanggal yang benar.', true); return; }
  if (!pembuat) { toast('Pembuat wajib diisi !', true); return; }

  var p = tgl.split('-');
  var key = p[0];
  ctr[key] = (ctr[key] || 0) + 1;

  var nomor = mkNomor(tgl, pembuat, ctr[key]);
  if (hasDuplicateNomor(nomor, -1)) {
    ctr[key] -= 1;
    saveCtr();
    toast('Nomor PKB terdeteksi sudah ada. Periksa data lama atau ubah penomoran terlebih dahulu.', true);
    return;
  }
  list.push({ nomor: nomor, tgl: tgl, pembuat: pembuat });
  saveCtr();
  save();
  render();
  stats();
  toast('PKB disimpan: ' + nomor);
  rst();
}

function rst() {
  document.getElementById('ft').value = today();
  document.getElementById('fb').value = '';
  upv();
}
function resetNomorManual() {
  if (!isAdmin) { toast('Login sebagai admin untuk reset nomor', true); return; }
  var yr = activeYear();
  var next = parseInt(ctr[yr], 10);
  next = isNaN(next) || next < 0 ? 1 : next + 1;
  document.getElementById('resetNomorHint').textContent = 'Atur nomor awal untuk PKB berikutnya pada tahun ' + yr + '. Semua data PKB yang sudah ada akan dihapus.';
  document.getElementById('resetStartNumber').value = String(next);
  document.getElementById('resetConfirm').checked = false;
  document.getElementById('resetNomorModal').classList.add('show');
  setTimeout(function () {
    document.getElementById('resetStartNumber').focus();
    document.getElementById('resetStartNumber').select();
  }, 30);
}

function closeResetNomorModal() {
  document.getElementById('resetNomorModal').classList.remove('show');
}

function applyResetNomor() {
  if (!isAdmin) { toast('Login sebagai admin untuk reset nomor', true); return; }
  var yr = activeYear();
  var el = document.getElementById('resetStartNumber');
  var confirmEl = document.getElementById('resetConfirm');
  var start = Number(el.value);
  if (!Number.isInteger(start) || start < 1 || start > 9999) {
    toast('Nomor start awal harus angka 1 sampai 9999', true);
    el.focus();
    return;
  }
  if (!confirmEl || !confirmEl.checked) {
    toast('Centang "Saya yakin" untuk melanjutkan reset', true);
    return;
  }
  var prev = parseInt(ctr[yr], 10);
  prev = isNaN(prev) || prev < 0 ? 0 : prev;
  var deletedCount = list.length;
  ctr[yr] = start - 1;
  list = [];
  delIdx = -1;
  editIdx = -1;
  save();
  saveCtr();
  closeResetNomorModal();
  render();
  stats();
  upv();
  addHistoryEntry('Reset Nomor', 'Counter tahun ' + yr + ' sebelumnya: ' + String(prev).padStart(4, '0') + ' | Jumlah PKB dihapus: ' + deletedCount, 'Nomor berikutnya tahun ' + yr + ' diatur ke: ' + String(start).padStart(4, '0'));
  toast('Data PKB dihapus dan nomor berikutnya tahun ' + yr + ' diatur ke ' + String(start).padStart(4, '0'));
}

function askHapus(i) {
  if (!isAdmin) { toast('Login sebagai admin untuk menghapus PKB', true); return; }
  delIdx = i;
  document.getElementById('mn').textContent = list[i].nomor;
  document.getElementById('modal').classList.add('show');
}

function closeM() {
  delIdx = -1;
  document.getElementById('modal').classList.remove('show');
}

function doHapus() {
  if (delIdx < 0) return;
  var beforeItem = JSON.parse(JSON.stringify(list[delIdx]));
  list.splice(delIdx, 1);
  var yr = ((beforeItem && beforeItem.tgl) || '').split('-')[0];
  var deletedSeq = seqOf(beforeItem);
  var cur = isNaN(parseInt(ctr[yr], 10)) ? 0 : parseInt(ctr[yr], 10);
  if (yr && deletedSeq > 0 && deletedSeq === cur) {
    var maxRemain = 0;
    list.forEach(function (item) {
      if (((item && item.tgl) || '').split('-')[0] !== yr) return;
      var n = seqOf(item);
      if (n > maxRemain) maxRemain = n;
    });
    ctr[yr] = maxRemain;
    saveCtr();
  }
  closeM();
  save();
  render();
  stats();
  upv();
  addHistoryLog('Hapus', beforeItem, null);
  toast('PKB berhasil dihapus', true);
}

function openEdit(i) {
  if (!isAdmin) { toast('Login sebagai admin untuk mengedit PKB', true); return; }
  editIdx = i;
  var item = list[i];
  document.getElementById('efn').value = item.nomor || '';
  document.getElementById('eft').value = item.tgl || '';
  document.getElementById('efb').value = item.pembuat || '';
  document.getElementById('editModal').classList.add('show');
}

function closeEdit() {
  editIdx = -1;
  document.getElementById('editModal').classList.remove('show');
}

function saveEdit() {
  if (editIdx < 0) return;
  var nomor = cleanSpaces(document.getElementById('efn').value).toUpperCase();
  var tgl = document.getElementById('eft').value;
  var pembuat = toProperCase(cleanPersonName(document.getElementById('efb').value));
  document.getElementById('efn').value = nomor;
  document.getElementById('efb').value = pembuat;
  if (!nomor) { toast('Nomor PKB wajib diisi', true); return; }
  if (!isNomorPkbFormat(nomor)) { toast('Format nomor PKB tidak valid. Gunakan pola seperti 0001/99/IV/2026.', true); return; }
  if (!tgl) { toast('Tanggal wajib diisi', true); return; }
  if (!isValidDateStr(tgl)) { toast('Tanggal tidak valid. Gunakan format tanggal yang benar.', true); return; }
  if (!pembuat) { toast('Pembuat wajib diisi dan hanya boleh memakai karakter huruf, angka, titik, koma, petik, serta tanda hubung.', true); return; }
  if (hasDuplicateNomor(nomor, editIdx)) {
    toast('Nomor PKB sudah digunakan. Gunakan nomor berbeda.', true);
    return;
  }
  var beforeItem = JSON.parse(JSON.stringify(list[editIdx]));
  list[editIdx] = { nomor: nomor, tgl: tgl, pembuat: pembuat };
  var yr = tgl.split('-')[0];
  var seq = seqOf({ nomor: nomor });
  if (yr && !isNaN(seq) && seq > 0) {
    var cur = parseInt(ctr[yr], 10);
    cur = isNaN(cur) || cur < 0 ? 0 : cur;
    if (seq > cur) ctr[yr] = seq;
  }
  addHistoryLog('Edit', beforeItem, list[editIdx]);
  syncCtrWithList();
  saveCtr();
  save();
  render();
  stats();
  upv();
  closeEdit();
  toast('Perubahan PKB berhasil disimpan');
}

function render() {
  var tb = document.getElementById('tb');
  var q = document.getElementById('fs').value.trim().toLowerCase();
  var aksiHead = document.querySelector('th[data-col="aksi"]');
  var aksiCol = document.querySelector('col[data-col="aksi-col"]');
  if (aksiHead) aksiHead.style.display = isAdmin ? '' : 'none';
  if (aksiCol) aksiCol.style.display = isAdmin ? '' : 'none';
  var cols = isAdmin ? 5 : 4;

  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="' + cols + '"><div class="empty-row"><div class="empty-ico"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5z"/></svg></div>Belum ada PKB tercatat</div></td></tr>';
    return;
  }

  var rows = list.map(function (item, idx) {
    return { item: item, idx: idx };
  }).filter(function (row) {
    if (!q) return true;
    return [row.item.nomor, row.item.pembuat, fmt(row.item.tgl)].join(' ').toLowerCase().indexOf(q) !== -1;
  }).reverse();

  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="' + cols + '"><div class="empty-row">Data PKB tidak ditemukan</div></td></tr>';
    return;
  }

  tb.innerHTML = rows.map(function (row) {
    var aksi = isAdmin
      ? '<td class="tc"><div class="act-grp"><button class="act-btn" onclick="openEdit(' + row.idx + ')" title="Edit"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="act-btn del" onclick="askHapus(' + row.idx + ')" title="Hapus"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td>'
      : '';
    return '<tr>' +
      '<td class="tc"><span class="nbadge">' + seqOf(row.item) + '</span></td>' +
      '<td>' + fmt(row.item.tgl) + '</td>' +
      '<td><span class="badge">' + row.item.nomor + '</span></td>' +
      '<td title="' + row.item.pembuat + '">' + row.item.pembuat + '</td>' +
      aksi +
      '</tr>';
  }).join('');
}

function stats() {
  var now = new Date();
  var yr = now.getFullYear().toString();
  var mo = String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById('s-bln').textContent = list.filter(function (item) { return (item.tgl || '').startsWith(yr + '-' + mo); }).length;
  document.getElementById('s-thn').textContent = list.filter(function (item) { return (item.tgl || '').startsWith(yr); }).length;
}

document.getElementById('ft').value = today();
['fb', 'efb'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('input', function () { sanitizeNameInput(id); });
});
['efn'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('input', function () { el.value = cleanSpaces(el.value).toUpperCase(); });
});
async function initApp() {
  document.addEventListener('click', closeJsonMenus);
  upv();
  render();
  stats();
  if (window.cloudStore && cloudStore.isReady()) {
    cloudStore.onAuthStateChanged(function (user) { applyCloudAuth(user); });
    try {
      await load();
    } catch (e) {
      toast(e.message || 'Gagal memuat data cloud', true);
    }
  } else {
    updateAdminUI();
    toast('Cloud belum siap. Isi cloud-config.js lalu refresh halaman.', true);
  }
  render();
  stats();
  upv();
}
initApp();
