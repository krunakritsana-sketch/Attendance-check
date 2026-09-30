
/*************************************************************************************
 * script.html — JS Client 1  (ฉบับปรับปรุง : Safe Binding + Load Guard)
 * -----------------------------------------------------------------------------------
 * หน้าที่ :
 *   1. State กลางของแอป (APP) และค่าสีประจำสถานะ
 *   2. Utilities : api(), Loading, Toast, Alert, escape, แปลงวันที่ไทย
 *   3. ระบบ Tab แบบ SPA
 *   4. Bootstrap ระบบ (init) + ตรวจสอบว่าไฟล์สคริปต์อื่นโหลดครบหรือไม่
 *   5. หน้าบันทึกการเข้าแถว (Attendance)
 *   6. หน้าสรุปรายวัน (Daily Summary) + Modal รายชื่อแยกสถานะ
 *
 * หมายเหตุสำคัญ :
 *   ไฟล์นี้ "ไม่ใช้" onclick แบบ inline ที่ต้อง escape เครื่องหมายคำพูดอีกต่อไป
 *   เปลี่ยนมาใช้ data-attribute + Event Delegation ทั้งหมด
 *   เพื่อป้องกัน Syntax Error ที่เกิดจากการคัดลอกโค้ด
 *************************************************************************************/

/** ===================================================================================
 *  ส่วนที่ 1 : STATE กลางของแอปพลิเคชัน
 * =================================================================================== **/
var APP = {
  classes: [],                                                        // รายชื่อชุด/กลุ่มเรียนทั้งหมด
  statusList: ['มา', 'สาย', 'ลาป่วย', 'ลากิจ', 'ลาชั่วกาล', 'ขาดแถว'],  // สถานะการเข้าแถว
  statusShort: {                                                      // ตัวย่อสำหรับตารางปฏิทิน
    'มา': 'ม', 'สาย': 'ส', 'ลาป่วย': 'ลป',
    'ลากิจ': 'ลก', 'ลาชั่วกาล': 'ลช', 'ขาดแถว': 'ข'
  },
  today: '',                 // วันที่ปัจจุบันจากเซิร์ฟเวอร์ (yyyy-MM-dd)
  adminPass: null,           // รหัสแอดมิน เก็บในหน่วยความจำเท่านั้น (ไม่ลง localStorage)
  adminStudents: [],         // ข้อมูลนักเรียนสำหรับหน้าแอดมิน
  atdStudents: [],           // รายชื่อนักเรียนที่กำลังเช็คชื่ออยู่
  atdState: {},              // { studentId : { status, note } }
  cache: {                   // แคชผลลัพธ์รายงานฝั่ง Client (ใช้ตอน Export CSV / Modal)
    dashLoaded: false,
    daily: null,
    range: null,
    monthly: null,
    individual: null
  }
};

/** สีประจำสถานะ (Tailwind class + hex สำหรับ SweetAlert2) */
var ST_COLOR = {
  'มา':        { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700', hex: '#10b981' },
  'สาย':       { bg: 'bg-amber-500',   hover: 'hover:bg-amber-600',   light: 'bg-amber-50',   text: 'text-amber-700',   hex: '#f59e0b' },
  'ลาป่วย':    { bg: 'bg-sky-500',     hover: 'hover:bg-sky-600',     light: 'bg-sky-50',     text: 'text-sky-700',     hex: '#0ea5e9' },
  'ลากิจ':     { bg: 'bg-violet-500',  hover: 'hover:bg-violet-600',  light: 'bg-violet-50',  text: 'text-violet-700',  hex: '#8b5cf6' },
  'ลาชั่วกาล': { bg: 'bg-teal-500',    hover: 'hover:bg-teal-600',    light: 'bg-teal-50',    text: 'text-teal-700',    hex: '#14b8a6' },
  'ขาดแถว':    { bg: 'bg-rose-500',    hover: 'hover:bg-rose-600',    light: 'bg-rose-50',    text: 'text-rose-700',    hex: '#f43f5e' }
};

/** ===================================================================================
 *  ส่วนที่ 2 : UTILITIES พื้นฐาน
 * =================================================================================== **/

/**
 * เรียกฟังก์ชันฝั่ง Backend (Google Apps Script) แบบ Promise
 * ใช้แทน google.script.run โดยตรง เพื่อให้เขียน .then() / .catch() ได้สะดวก
 * ตัวอย่าง : api('getDashboard', '2026-08-31').then(res => {...})
 */
/** URL ของ Apps Script Web App (ลงท้ายด้วย /exec) */
var API_URL = 'วาง URL /exec ที่นี่';

/**
 * เรียก Backend (Apps Script) ผ่าน fetch แบบ Promise
 * ใช้ Content-Type แบบ text/plain เพื่อเลี่ยง CORS preflight
 */
function api(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args }),
    redirect: 'follow'
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (j) {
    if (!j || !j.__ok) throw new Error((j && j.error) ? j.error : 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง');
    return j.data;
  });
}

/** แสดง Loading Spinner (SweetAlert2) */
function showLoading(text) {
  Swal.fire({
    title: text || 'กำลังโหลดข้อมูล...',
    html: '<div style="font-size:13px;color:#64748b">กรุณารอสักครู่</div>',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: function () { Swal.showLoading(); }
  });
}

/** ปิด Loading */
function closeLoading() {
  Swal.close();
}

/** แจ้งเตือนแบบ Toast มุมขวาบน */
function toast(icon, title) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: icon,
    title: title,
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true
  });
}

/** Popup แจ้งผลสำเร็จ */
function alertOk(title, text) {
  return Swal.fire({ icon: 'success', title: title, text: text, confirmButtonColor: '#1e3a8a' });
}

/** Popup แจ้งข้อผิดพลาด */
function alertErr(title, text) {
  return Swal.fire({ icon: 'error', title: title, text: text, confirmButtonColor: '#1e3a8a' });
}

/** ป้องกัน XSS : แปลงอักขระพิเศษก่อนใส่ลง innerHTML */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ชื่อเดือนภาษาไทย (index 0 = มกราคม) */
var TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

/** แปลง yyyy-MM-dd → "31 สิงหาคม 2569" */
function thDate(s) {
  if (!s) return '-';
  var p = String(s).split('-');
  if (p.length !== 3) return s;
  return parseInt(p[2], 10) + ' ' + TH_MONTH[parseInt(p[1], 10) - 1] + ' ' + (parseInt(p[0], 10) + 543);
}

/** แปลง yyyy-MM-dd → "31/8/2569" */
function thDateShort(s) {
  if (!s) return '-';
  var p = String(s).split('-');
  if (p.length !== 3) return s;
  return parseInt(p[2], 10) + '/' + parseInt(p[1], 10) + '/' + (parseInt(p[0], 10) + 543);
}

/** วันที่วันนี้ของเครื่อง Client ในรูปแบบ yyyy-MM-dd (ใช้เป็น fallback) */
function todayISO() {
  var d = new Date();
  return d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getDate()).slice(-2);
}

/** อ่านค่าจาก element อย่างปลอดภัย (กัน null) */
function val(id, fallback) {
  var el = document.getElementById(id);
  return (el && el.value) ? el.value : (fallback || '');
}

/** ===================================================================================
 *  ส่วนที่ 3 : ระบบ TAB แบบ SPA
 * =================================================================================== **/
function switchTab(name) {
  var btns = document.querySelectorAll('.tab-btn');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].dataset.tab === name) btns[i].classList.add('active');
    else btns[i].classList.remove('active');
  }
  var panes = document.querySelectorAll('.tab-pane');
  for (var j = 0; j < panes.length; j++) {
    if (panes[j].id === 'tab-' + name) panes[j].classList.add('active');
    else panes[j].classList.remove('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Lazy Load : โหลด Dashboard เฉพาะครั้งแรกที่เข้าแท็บ
  if (name === 'dashboard' && !APP.cache.dashLoaded) {
    APP.cache.dashLoaded = true;
    if (typeof loadDashboard === 'function') loadDashboard();
  }
}

/** ===================================================================================
 *  ส่วนที่ 4 : BOOTSTRAP — เริ่มต้นระบบ
 * =================================================================================== **/
document.addEventListener('DOMContentLoaded', init);

/**
 * ตรวจสอบว่าฟังก์ชันจากไฟล์สคริปต์อื่นถูกโหลดครบหรือไม่
 * ป้องกันอาการ "xxx is not defined" โดยแจ้งชื่อไฟล์ที่หายไปให้ชัดเจน
 */
function checkModules() {
  var required = [
    { fn: 'loadDashboard',      file: 'script2.html' },
    { fn: 'adminLogin',         file: 'script2.html' },
    { fn: 'loadRangeSummary',   file: 'script1.html' },
    { fn: 'loadMonthly',        file: 'script1.html' },
    { fn: 'printReport',        file: 'script1.html' },
    { fn: 'reloadStudentOptions', file: 'script1.html' }
  ];
  var missingFiles = [];
  for (var i = 0; i < required.length; i++) {
    if (typeof window[required[i].fn] !== 'function') {
      if (missingFiles.indexOf(required[i].file) === -1) missingFiles.push(required[i].file);
      console.error('[MODULE MISSING] ไม่พบฟังก์ชัน ' + required[i].fn + ' (ควรอยู่ใน ' + required[i].file + ')');
    }
  }
  return missingFiles;
}

function init() {
  // ปีในส่วนท้ายเว็บ
  var ftYear = document.getElementById('ftYear');
  if (ftYear) ftYear.textContent = new Date().getFullYear() + 543;

  // ผูก Event ให้ปุ่ม Tab ทั้งหมด
  var btns = document.querySelectorAll('.tab-btn');
  for (var i = 0; i < btns.length; i++) {
    (function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    })(btns[i]);
  }

  // ผูก Event Delegation ทั้งหมด (ทำครั้งเดียว)
  bindGlobalEvents();

  // ตรวจสอบไฟล์สคริปต์ก่อนเริ่มทำงาน
  var missing = checkModules();
  if (missing.length) {
    Swal.fire({
      icon: 'error',
      title: 'โหลดสคริปต์ไม่ครบ',
      html: 'ไม่พบไฟล์ต่อไปนี้ หรือไฟล์มี Syntax Error :<br><b>' + missing.join('<br>') + '</b>' +
            '<div style="font-size:12px;color:#64748b;margin-top:8px">' +
            'กรุณาตรวจสอบว่าไฟล์อยู่โฟลเดอร์เดียวกับ index.html และชื่อไฟล์ตรงกับที่ระบุใน &lt;script src&gt; ท้าย index.html' +
'</div>',
      confirmButtonColor: '#1e3a8a',
      width: 520
    });
    // ไม่ return — ยังให้ระบบทำงานต่อในส่วนที่โหลดได้
  }

  // ดึงข้อมูลตั้งต้นจาก Backend
  showLoading('กำลังเริ่มต้นระบบ...');
  api('getInitialData').then(function (res) {
    closeLoading();

    if (!res || !res.ok) {
      alertErr('เริ่มต้นระบบไม่สำเร็จ', 'ไม่ได้รับข้อมูลตั้งต้นจากเซิร์ฟเวอร์ กรุณารัน setupSystem() ก่อน');
      return;
    }

    APP.classes     = res.classes     || [];
    APP.statusList  = res.statusList  || APP.statusList;
    APP.statusShort = res.statusShort || APP.statusShort;
    APP.today       = res.today       || todayISO();

    var hd = document.getElementById('hdToday');
    if (hd) hd.textContent = thDate(APP.today);

    fillAllDates();
    fillAllClassSelects();
    fillMonthYear();

    // โหลด Dashboard ครั้งแรก (พร้อม Guard)
    APP.cache.dashLoaded = true;
    if (typeof loadDashboard === 'function') {
      loadDashboard();
    } else {
      console.error('script2.html ไม่ถูกโหลด : loadDashboard undefined');
      var dashTable = document.getElementById('dashTable');
      if (dashTable) {
        dashTable.innerHTML =
          '<div style="padding:32px;text-align:center;color:#94a3b8;font-size:14px">' +
          'ไม่สามารถแสดงแดชบอร์ดได้ เนื่องจากไฟล์ script2.html ไม่ถูกโหลด</div>';
      }
    }

  }).catch(function (err) {
    closeLoading();
    var msg = (err && err.message) ? err.message : String(err);
    alertErr('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', msg);
    console.error('getInitialData failed:', err);
  });
}

/** เติมค่าวันที่เริ่มต้นให้ทุกช่อง */
function fillAllDates() {
  var t = APP.today;
  var todayFields = ['dashDate', 'atdDate', 'dailyDate', 'rangeEnd', 'indEnd'];
  for (var i = 0; i < todayFields.length; i++) {
    var el = document.getElementById(todayFields[i]);
    if (el) el.value = t;
  }

  // ช่วงวันที่เริ่มต้น = ย้อนหลัง 30 วัน
  var d = new Date(t);
  d.setDate(d.getDate() - 29);
  var s = d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getDate()).slice(-2);

  var startFields = ['rangeStart', 'indStart'];
  for (var j = 0; j < startFields.length; j++) {
    var el2 = document.getElementById(startFields[j]);
    if (el2) el2.value = s;
  }
}

/** เติมรายการชุด/กลุ่มเรียนลงใน dropdown ทุกตัว */
function fillAllClassSelects() {
  var optionsAll = APP.classes.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');

  // Dropdown ที่มีตัวเลือก "ทุกชุด"
  var withAll = ['dailyClass', 'rangeClass', 'monClass', 'indClass', 'admFilter'];
  for (var i = 0; i < withAll.length; i++) {
    var el = document.getElementById(withAll[i]);
    if (el) el.innerHTML = '<option value="ALL">— ทุกชุด/กลุ่มเรียน —</option>' + optionsAll;
  }

  // Dropdown หน้าบันทึกเข้าแถว (ต้องเลือกชุดเสมอ)
  var atd = document.getElementById('atdClass');
  if (atd) atd.innerHTML = '<option value="">— เลือกชุด/กลุ่มเรียน —</option>' + optionsAll;

  // โหลดรายชื่อนักเรียนสำหรับหน้าสรุปรายบุคคล
  if (typeof reloadStudentOptions === 'function') reloadStudentOptions();
}

/** เติมตัวเลือกเดือนและปีในหน้าสรุปรายเดือน */
function fillMonthYear() {
  var now = new Date(APP.today);

  var mSel = document.getElementById('monMonth');
  if (mSel) {
    mSel.innerHTML = TH_MONTH.map(function (m, i) {
      return '<option value="' + (i + 1) + '"' + (i === now.getMonth() ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
  }

  var ySel = document.getElementById('monYear');
  if (ySel) {
    var html = '';
    for (var y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
      html += '<option value="' + y + '"' + (y === now.getFullYear() ? ' selected' : '') + '>' +
              (y + 543) + ' (' + y + ')</option>';
    }
    ySel.innerHTML = html;
  }
}

/** ===================================================================================
 *  ส่วนที่ 4.1 : EVENT DELEGATION กลาง
 *  ผูก listener ที่ container เพียงครั้งเดียว แล้วอ่านคำสั่งจาก data-attribute
 *  ข้อดี : ไม่ต้องเขียน onclick แบบ inline ที่ต้อง escape quote (ต้นเหตุ Syntax Error)
 *          และไม่ต้องผูก event ใหม่ทุกครั้งที่ re-render
 * =================================================================================== **/
function bindGlobalEvents() {

  // ---------- รายการเช็คชื่อ : ปุ่มสถานะ + ช่องหมายเหตุ ----------
  var atdList = document.getElementById('atdList');
  if (atdList) {
    atdList.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-act="pick"]');
      if (!btn) return;
      pickStatus(btn.getAttribute('data-id'), btn.getAttribute('data-status'));
    });

    atdList.addEventListener('input', function (ev) {
      var inp = ev.target.closest('input[data-act="note"]');
      if (!inp) return;
      setNote(inp.getAttribute('data-id'), inp.value);
    });
  }

  // ---------- ปุ่มตั้งค่าเร็ว (มาทั้งหมด / ขาดทั้งหมด / ...) ----------
  var quickBtns = document.querySelectorAll('[data-setall]');
  for (var i = 0; i < quickBtns.length; i++) {
    (function (b) {
      b.addEventListener('click', function () { setAll(b.getAttribute('data-setall')); });
    })(quickBtns[i]);
  }

  // ---------- การ์ดสถานะในหน้าสรุปรายวัน (คลิกเพื่อดูรายชื่อ) ----------
  var dailyBox = document.getElementById('dailyPrint');
  if (dailyBox) {
    dailyBox.addEventListener('click', function (ev) {
      var card = ev.target.closest('[data-act="statusmodal"]');
      if (!card) return;
      showStatusModal(card.getAttribute('data-status'));
    });
  }
}

/** ===================================================================================
 *  ส่วนที่ 5 : หน้าบันทึกการเข้าแถว (ATTENDANCE)
 * =================================================================================== **/

/** ดึงรายชื่อนักเรียนตามวันที่และชุดที่เลือก พร้อม Prefill ข้อมูลเดิม (ถ้ามี) */
function loadAttendanceList() {
  var date = val('atdDate');
  var cls  = val('atdClass');

  if (!date || !cls) {
    toast('warning', 'กรุณาเลือกวันที่และชุด/กลุ่มเรียน');
    return;
  }

  showLoading('กำลังดึงรายชื่อนักเรียน...');
  api('getSessionData', date, cls).then(function (res) {
    closeLoading();

    if (!res || !res.ok) {
      alertErr('ดึงข้อมูลไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
      return;
    }

    // ไม่พบนักเรียนในชุดนี้
    if (!res.students || !res.students.length) {
      var panel = document.getElementById('atdPanel');
      var empty = document.getElementById('atdEmpty');
      if (panel) panel.classList.add('hidden');
      if (empty) {
        empty.classList.remove('hidden');
        empty.textContent = 'ไม่พบนักเรียนในชุด/กลุ่ม "' + cls + '" กรุณาเพิ่มข้อมูลที่แท็บจัดการนักเรียน';
      }
      return;
    }

    // เตรียม State
    APP.atdStudents = res.students;
    APP.atdState = {};
    for (var i = 0; i < res.students.length; i++) {
      var s = res.students[i];
      var rec = res.records ? res.records[s.id] : null;
      APP.atdState[s.id] = {
        status: rec ? rec.status : '',
        note:   rec ? rec.note   : ''
      };
    }

    // เนื้อหาการอบรม
    var contentEl = document.getElementById('atdContent');
    if (contentEl) contentEl.value = res.content || '';

    // ป้ายเตือนว่าเคยบันทึกแล้ว
    var badge = document.getElementById('atdSavedBadge');
    if (badge) {
      if (res.saved) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    var emptyBox = document.getElementById('atdEmpty');
    var panelBox = document.getElementById('atdPanel');
    if (emptyBox) emptyBox.classList.add('hidden');
    if (panelBox) panelBox.classList.remove('hidden');

    renderAttendanceList();

    if (res.saved) toast('info', 'โหลดข้อมูลที่เคยบันทึกไว้แล้ว');

  }).catch(function (e) {
    closeLoading();
    alertErr('ผิดพลาด', String(e));
  });
}

/**
 * วาดรายการนักเรียนพร้อมปุ่มสถานะ
 * ⭐ ใช้ data-act / data-id / data-status แทน onclick เพื่อความปลอดภัย
 */
function renderAttendanceList() {
  var box = document.getElementById('atdList');
  if (!box) return;

  var html = '';
  for (var idx = 0; idx < APP.atdStudents.length; idx++) {
    var s = APP.atdStudents[idx];
    var st = APP.atdState[s.id] || { status: '', note: '' };

    // ปุ่มสถานะ 6 ปุ่ม
    var buttons = '';
    for (var k = 0; k < APP.statusList.length; k++) {
      var v = APP.statusList[k];
      var c = ST_COLOR[v];
      var on = (st.status === v);
      var cls = on
        ? (c.bg + ' text-white border-transparent shadow-sm')
        : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400';
      buttons +=
        '<button type="button" data-act="pick" data-id="' + esc(s.id) + '" data-status="' + esc(v) + '" ' +
        'class="st-btn px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold border ' + cls + '">' +
        esc(v) + '</button>';
    }

    var cardBorder = st.status ? 'border-slate-200' : 'border-amber-200';

    html +=
      '<div class="bg-white rounded-xl border ' + cardBorder + ' p-3 shadow-sm">' +
        '<div class="flex items-start gap-3">' +
          '<div class="w-8 h-8 shrink-0 rounded-lg bg-navy-50 text-navy-700 font-bold text-xs flex items-center justify-center">' +
            (idx + 1) +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="font-semibold text-sm truncate">' + esc(s.prefix) + esc(s.name) + '</p>' +
            '<p class="text-[11px] text-slate-400">รหัส ' + esc(s.id) + ' • ' + esc(s.cls) + '</p>' +
            '<div class="flex flex-wrap gap-1.5 mt-2">' + buttons + '</div>' +
            '<input type="text" data-act="note" data-id="' + esc(s.id) + '" value="' + esc(st.note) + '" ' +
              'placeholder="หมายเหตุ (ถ้ามี)" ' +
              'class="mt-2 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-navy-500">' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  box.innerHTML = html;
  updateProgress();
}

/**
 * เลือกสถานะให้นักเรียน 1 คน
 * ⭐ อัปเดตเฉพาะปุ่มของแถวนั้น (ไม่ re-render ทั้งหมด) เพื่อไม่ให้ช่องหมายเหตุเสียโฟกัส
 */
function pickStatus(id, status) {
  if (!APP.atdState[id]) APP.atdState[id] = { status: '', note: '' };

  // กดซ้ำสถานะเดิม = ยกเลิกสถานะ
  APP.atdState[id].status = (APP.atdState[id].status === status) ? '' : status;
  var current = APP.atdState[id].status;

  // อัปเดตหน้าตาปุ่มเฉพาะของนักเรียนคนนี้
  var btns = document.querySelectorAll('button[data-act="pick"][data-id="' + id.replace(/"/g, '\\"') + '"]');
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i];
    var v = b.getAttribute('data-status');
    var c = ST_COLOR[v];
    b.className = 'st-btn px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold border ' +
      ((v === current)
        ? (c.bg + ' text-white border-transparent shadow-sm')
        : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400');
    // ปรับสีกรอบการ์ด
    var card = b.closest('.bg-white.rounded-xl');
    if (card) {
      card.classList.remove('border-amber-200', 'border-slate-200');
      card.classList.add(current ? 'border-slate-200' : 'border-amber-200');
    }
  }

  updateProgress();
}

/** บันทึกหมายเหตุรายบุคคลลง State */
function setNote(id, value) {
  if (!APP.atdState[id]) APP.atdState[id] = { status: '', note: '' };
  APP.atdState[id].note = value;
}

/** ตั้งสถานะให้นักเรียนทุกคนพร้อมกัน (ส่ง '' = ล้างทั้งหมด) */
function setAll(status) {
  for (var i = 0; i < APP.atdStudents.length; i++) {
    var s = APP.atdStudents[i];
    if (!APP.atdState[s.id]) APP.atdState[s.id] = { status: '', note: '' };
    APP.atdState[s.id].status = status;
  }
  renderAttendanceList();
  toast('success', status ? ('ตั้งค่าเป็น "' + status + '" ทั้งหมดแล้ว') : 'ล้างสถานะทั้งหมดแล้ว');
}

/** อัปเดตตัวเลขความคืบหน้า "เช็คแล้ว x/y" */
function updateProgress() {
  var done = 0;
  for (var i = 0; i < APP.atdStudents.length; i++) {
    var s = APP.atdStudents[i];
    if (APP.atdState[s.id] && APP.atdState[s.id].status) done++;
  }
  var el = document.getElementById('atdProgress');
  if (el) el.textContent = done + '/' + APP.atdStudents.length;
}

/** ตรวจความครบถ้วน แล้วขอรหัสผ่านก่อนบันทึก */
function confirmSaveAttendance() {
  var date = val('atdDate');
  var cls  = val('atdClass');

  if (!APP.atdStudents.length) {
    toast('warning', 'กรุณาดึงรายชื่อนักเรียนก่อน');
    return;
  }

  // หานักเรียนที่ยังไม่ได้เช็ค
  var notDone = [];
  for (var i = 0; i < APP.atdStudents.length; i++) {
    var s = APP.atdStudents[i];
    if (!APP.atdState[s.id] || !APP.atdState[s.id].status) notDone.push(s);
  }

  if (notDone.length) {
    var names = notDone.slice(0, 5).map(function (x) { return esc(x.name); }).join(', ');
    Swal.fire({
      icon: 'warning',
      title: 'เช็คชื่อยังไม่ครบ',
      html: 'เหลืออีก <b>' + notDone.length + '</b> คนที่ยังไม่ได้ระบุสถานะ' +
            '<br><span style="font-size:12px;color:#64748b">' + names + (notDone.length > 5 ? ' ...' : '') + '</span>',
      confirmButtonColor: '#1e3a8a'
    });
    return;
  }

  Swal.fire({
    title: '🔐 ยืนยันการบันทึก',
    html: '<div style="font-size:14px;color:#475569;margin-bottom:6px">' + esc(cls) + ' • ' + thDate(date) + '</div>' +
          '<div style="font-size:12px;color:#94a3b8">กรอกรหัสผ่านหัวหน้านักเรียน/หัวหน้าชุด</div>',
    input: 'password',
    inputPlaceholder: 'รหัสผ่าน',
    inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
    showCancelButton: true,
    confirmButtonText: '💾 บันทึกข้อมูล',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1e3a8a',
    cancelButtonColor: '#94a3b8',
    preConfirm: function (v) {
      if (!v) { Swal.showValidationMessage('กรุณากรอกรหัสผ่าน'); return false; }
      return v;
    }
  }).then(function (r) {
    if (r.isConfirmed) doSaveAttendance(r.value);
  });
}

/** ส่งข้อมูลไปบันทึกที่ Backend (ฝั่งนั้นมี LockService ป้องกันการเซฟทับกัน) */
function doSaveAttendance(password) {
  var items = [];
  for (var i = 0; i < APP.atdStudents.length; i++) {
    var s = APP.atdStudents[i];
    items.push({
      id: s.id,
      prefix: s.prefix,
      name: s.name,
      status: APP.atdState[s.id].status,
      note: APP.atdState[s.id].note || ''
    });
  }

  var payload = {
    password: password,
    date: val('atdDate'),
    className: val('atdClass'),
    content: val('atdContent'),
    items: items
  };

  showLoading('กำลังบันทึกข้อมูล...');
  api('saveAttendance', payload).then(function (res) {
    closeLoading();

    if (!res || !res.ok) {
      alertErr('บันทึกไม่สำเร็จ', res ? res.msg : 'ไม่ได้รับการตอบกลับจากเซิร์ฟเวอร์');
      return;
    }

    // ล้างแคชรายงานฝั่ง Client ทั้งหมด
    APP.cache.daily = null;
    APP.cache.range = null;
    APP.cache.monthly = null;
    APP.cache.individual = null;

    alertOk('บันทึกสำเร็จ', res.msg).then(function () {
      var badge = document.getElementById('atdSavedBadge');
      if (badge) badge.classList.remove('hidden');
      if (typeof loadDashboard === 'function') loadDashboard();
    });

  }).catch(function (e) {
    closeLoading();
    alertErr('ผิดพลาด', String(e));
  });
}

/** ===================================================================================
 *  ส่วนที่ 6 : หน้าสรุปรายวัน (DAILY SUMMARY)
 * =================================================================================== **/
function loadDailySummary() {
  var date = val('dailyDate');
  var cls  = val('dailyClass', 'ALL');

  if (!date) {
    toast('warning', 'กรุณาเลือกวันที่');
    return;
  }

  showLoading('กำลังประมวลผลสรุปรายวัน...');
  api('getDailySummary', date, cls).then(function (res) {
    closeLoading();
    if (!res || !res.ok) { alertErr('ผิดพลาด', 'ดึงข้อมูลสรุปไม่สำเร็จ'); return; }
    APP.cache.daily = res;
    renderDaily(res);
  }).catch(function (e) {
    closeLoading();
    alertErr('ผิดพลาด', String(e));
  });
}

/** กล่องแสดงตัวเลขสถิติ (ใช้ร่วมกับ script1.html ด้วย) */
function statBox(label, value, colorClass) {
  return '<div class="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">' +
    '<p class="text-[11px] text-slate-500">' + label + '</p>' +
    '<p class="text-lg sm:text-xl font-extrabold ' + colorClass + '">' + value + '</p>' +
  '</div>';
}

/** วาดผลสรุปรายวันทั้งหมด */
function renderDaily(d) {
  var target = document.getElementById('dailyPrint');
  if (!target) return;

  // ---------- การ์ดสถานะ 6 ใบ (คลิกเพื่อดูรายชื่อ) ----------
  var cards = '';
  for (var i = 0; i < APP.statusList.length; i++) {
    var s = APP.statusList[i];
    var c = ST_COLOR[s];
    cards +=
      '<button type="button" data-act="statusmodal" data-status="' + esc(s) + '" ' +
      'class="text-left ' + c.light + ' border border-slate-200 rounded-xl p-3 hover:shadow-md transition">' +
        '<p class="text-[11px] font-semibold ' + c.text + '">' + esc(s) + '</p>' +
        '<p class="text-2xl font-extrabold ' + c.text + '">' + d.counts[s] + '</p>' +
        '<p class="text-[11px] text-slate-500">' + d.percents[s] + '% • กดดูรายชื่อ</p>' +
      '</button>';
  }

  // ---------- ตารางรายชื่อ ----------
  var rows = '';
  for (var j = 0; j < d.students.length; j++) {
    var st = d.students[j];
    var sc = ST_COLOR[st.status] || { bg: 'bg-slate-400' };
    rows +=
      '<tr class="border-b hover:bg-slate-50">' +
        '<td class="px-3 py-2 text-center text-slate-400 text-xs">' + (j + 1) + '</td>' +
        '<td class="px-3 py-2 text-xs">' + esc(st.id) + '</td>' +
        '<td class="px-3 py-2 text-sm font-medium">' + esc(st.prefix) + esc(st.name) + '</td>' +
        '<td class="px-3 py-2 text-xs text-slate-500">' + esc(st.cls) + '</td>' +
        '<td class="px-3 py-2 text-center">' +
          '<span class="' + sc.bg + ' text-white text-[11px] font-bold px-2.5 py-1 rounded-full">' + esc(st.status) + '</span>' +
        '</td>' +
        '<td class="px-3 py-2 text-xs text-slate-500">' + esc(st.note || '-') + '</td>' +
      '</tr>';
  }
  if (!rows) {
    rows = '<tr><td colspan="6" class="text-center py-8 text-slate-400 text-sm">ไม่พบข้อมูลการเช็คชื่อของวันนี้</td></tr>';
  }

  // ---------- เนื้อหาการอบรม ----------
  var contentHtml = '';
  if (d.contents && d.contents.length) {
    for (var k = 0; k < d.contents.length; k++) {
      contentHtml +=
        '<div class="bg-navy-50 border-l-4 border-navy-500 rounded-r-lg p-3 mb-2">' +
          '<p class="text-[11px] font-bold text-navy-700 mb-0.5">' + esc(d.contents[k].cls) + '</p>' +
          '<p class="text-sm text-slate-700 whitespace-pre-wrap">' + esc(d.contents[k].content) + '</p>' +
        '</div>';
    }
  } else {
    contentHtml = '<p class="text-sm text-slate-400">— ไม่มีการบันทึกเนื้อหาการอบรม —</p>';
  }

  // ---------- แถบเตือนนักเรียนที่ยังไม่ถูกเช็ค ----------
  var missingHtml = '';
  if (d.missing && d.missing.length) {
    var mNames = d.missing.slice(0, 15).map(function (m) { return esc(m.name); }).join(', ');
    missingHtml =
      '<div class="px-4 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">' +
        '⚠️ ยังไม่ได้เช็คชื่อ ' + d.missing.length + ' คน : ' + mNames + (d.missing.length > 15 ? ' ...' : '') +
      '</div>';
  }

  var titleCls = (d.className === 'ALL') ? 'ทุกชุด/กลุ่มเรียน' : esc(d.className);

  target.innerHTML =
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4">' +
      '<div class="text-center mb-4 pb-3 border-b">' +
        '<h2 class="text-lg font-bold text-navy-800">สรุปการเข้าแถวประจำวัน</h2>' +
        '<p class="text-sm text-slate-500">' + thDate(d.date) + ' • ' + titleCls + '</p>' +
      '</div>' +
      '<div class="grid grid-cols-3 gap-3 mb-4">' +
        statBox('นักเรียนทั้งหมด', d.total + ' คน', 'text-navy-700') +
        statBox('เช็คชื่อแล้ว', d.checked + ' คน', 'text-emerald-600') +
        statBox('อัตราการเข้าแถว', d.attendanceRate + '%', 'text-blue-600') +
      '</div>' +
      '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">' + cards + '</div>' +
      '<h3 class="font-bold text-navy-700 text-sm mb-2">📚 เนื้อหา/กิจกรรมการอบรม</h3>' +
      contentHtml +
    '</div>' +
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">' +
      '<div class="px-4 py-3 bg-slate-50 border-b">' +
        '<h3 class="font-bold text-navy-700 text-sm">รายชื่อนักเรียน (' + d.students.length + ' คน)</h3>' +
      '</div>' +
      '<div class="overflow-x-auto"><table class="w-full min-w-[640px]">' +
        '<thead class="bg-slate-100 text-slate-600 text-xs"><tr>' +
          '<th class="px-3 py-2 w-10">#</th>' +
          '<th class="px-3 py-2 text-left">รหัส</th>' +
          '<th class="px-3 py-2 text-left">ชื่อ-สกุล</th>' +
          '<th class="px-3 py-2 text-left">ชุด/กลุ่ม</th>' +
          '<th class="px-3 py-2">สถานะ</th>' +
          '<th class="px-3 py-2 text-left">หมายเหตุ</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      missingHtml +
    '</div>';
}

/** Modal แสดงรายชื่อนักเรียนแยกตามสถานะที่คลิก */
function showStatusModal(status) {
  var d = APP.cache.daily;
  if (!d) { toast('warning', 'กรุณากดแสดงผลก่อน'); return; }

  var list = (d.byStatus && d.byStatus[status]) ? d.byStatus[status] : [];
  var c = ST_COLOR[status] || { hex: '#1e3a8a' };

  var html;
  if (list.length) {
    html = '<div style="text-align:left;max-height:320px;overflow-y:auto">';
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      html +=
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">' +
          '<span style="font-size:12px;color:#94a3b8;width:24px">' + (i + 1) + '</span>' +
          '<span style="font-size:14px;flex:1">' + esc(s.prefix) + esc(s.name) + '</span>' +
          '<span style="font-size:11px;color:#94a3b8">' + esc(s.cls) + '</span>' +
        '</div>';
      if (s.note) {
        html += '<div style="font-size:11px;color:#94a3b8;padding:0 0 4px 32px">📝 ' + esc(s.note) + '</div>';
      }
    }
    html += '</div>';
  } else {
    html = '<p style="color:#94a3b8;font-size:14px">ไม่มีนักเรียนในสถานะนี้</p>';
  }

  Swal.fire({
    title: '<span style="color:' + c.hex + '">' + esc(status) + ' (' + list.length + ' คน)</span>',
    html: html,
    width: 520,
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#1e3a8a'
  });
}
