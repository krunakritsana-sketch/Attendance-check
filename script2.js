
/*************************************************************************************
 * script2.js — JS Client 3 (ฉบับแก้ไข : ปลอดภัยจาก Syntax Error)
 * Dashboard Renderer / Admin Login / จัดการนักเรียน (CRUD)
 *************************************************************************************/

/** =====================================================================
 *  DASHBOARD
 * ===================================================================== **/
function loadDashboard(){
  var dateEl = document.getElementById('dashDate');
  var date = (dateEl && dateEl.value) ? dateEl.value : APP.today;
  showLoading('กำลังโหลดแดชบอร์ด...');
  api('getDashboard', date).then(function(res){
    closeLoading();
    if(!res || !res.ok){ alertErr('โหลดข้อมูลไม่สำเร็จ',''); return; }
    renderDashboard(res);
  }).catch(function(e){ closeLoading(); alertErr('ผิดพลาด', String(e)); });
}

/** ปุ่มรีเฟรช : สั่งล้าง Cache ฝั่ง Server แล้วดึงใหม่ */
function forceRefreshDashboard(){
  var dateEl = document.getElementById('dashDate');
  var date = (dateEl && dateEl.value) ? dateEl.value : APP.today;
  showLoading('กำลังล้างแคชและดึงข้อมูลล่าสุด...');
  api('refreshDashboard', date).then(function(res){
    closeLoading();
    APP.cache.daily = null; APP.cache.range = null;
    APP.cache.monthly = null; APP.cache.individual = null;
    renderDashboard(res);
    toast('success','ดึงข้อมูลล่าสุดเรียบร้อยแล้ว');
  }).catch(function(e){ closeLoading(); alertErr('ผิดพลาด', String(e)); });
}

function renderDashboard(d){
  // ---- Card สรุปหลัก 4 ใบ ----
  var cards = [
    { label:'นักเรียนทั้งหมด',  val:d.totalStudents,   unit:'คน', icon:'👥', color:'from-navy-700 to-navy-500' },
    { label:'เช็คชื่อแล้ววันนี้', val:d.checked,        unit:'คน', icon:'✅', color:'from-emerald-600 to-emerald-400' },
    { label:'ยังไม่เช็คชื่อ',    val:d.notChecked,      unit:'คน', icon:'⏳', color:'from-amber-500 to-amber-400' },
    { label:'อัตราเข้าแถวเฉลี่ย', val:d.attendanceRate, unit:'%',  icon:'📈', color:'from-blue-600 to-sky-400' }
  ];
  document.getElementById('dashCards').innerHTML = cards.map(function(c){
    return '<div class="bg-gradient-to-br ' + c.color + ' text-white rounded-2xl p-4 shadow-md">' +
      '<div class="text-xl">' + c.icon + '</div>' +
      '<p class="text-2xl sm:text-3xl font-extrabold mt-1">' + c.val +
        '<span class="text-sm font-semibold ml-1">' + c.unit + '</span></p>' +
      '<p class="text-[11px] sm:text-xs text-white/85 mt-0.5">' + c.label + '</p>' +
    '</div>';
  }).join('');

  // ---- Card แยกสถานะ 6 ใบ ----
  document.getElementById('dashStatus').innerHTML = APP.statusList.map(function(s){
    var c = ST_COLOR[s];
    var w = Math.min(d.percents[s], 100);
    return '<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">' +
      '<div class="flex items-center gap-2 mb-1">' +
        '<span class="w-2.5 h-2.5 rounded-full ' + c.bg + '"></span>' +
        '<span class="text-[11px] font-semibold text-slate-600">' + s + '</span>' +
      '</div>' +
      '<p class="text-xl font-extrabold ' + c.text + '">' + d.counts[s] + '</p>' +
      '<div class="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">' +
        '<div class="h-full ' + c.bg + '" style="width:' + w + '%"></div></div>' +
      '<p class="text-[10px] text-slate-400 mt-1">' + d.percents[s] + '% ของจำนวนนักเรียนทั้งหมด</p>' +
    '</div>';
  }).join('');

  // ---- ตารางแยกตามชุด/กลุ่ม + แถวรวมท้ายตาราง ----
  var rows = d.breakdown.map(function(b, i){
    var cells = APP.statusList.map(function(s){
      return '<td class="px-2 py-2.5 text-center text-xs">' + b.counts[s] + '</td>';
    }).join('');
    var badge = b.saved
      ? '<span class="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">บันทึกแล้ว</span>'
      : '<span class="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">ยังไม่บันทึก</span>';
    var rateCls = b.rate >= 80 ? 'text-emerald-600' : (b.rate >= 60 ? 'text-amber-600' : 'text-rose-600');
    return '<tr class="border-b hover:bg-slate-50">' +
      '<td class="px-3 py-2.5 text-center text-xs text-slate-400">' + (i + 1) + '</td>' +
      '<td class="px-3 py-2.5 text-sm font-semibold whitespace-nowrap">' + esc(b.cls) + '</td>' +
      '<td class="px-2 py-2.5 text-center text-xs">' + b.total + '</td>' +
      '<td class="px-2 py-2.5 text-center text-xs font-semibold text-navy-700">' + b.checked + '</td>' +
      cells +
      '<td class="px-2 py-2.5 text-center text-xs font-bold ' + rateCls + '">' + b.rate + '%</td>' +
      '<td class="px-2 py-2.5 text-center">' + badge + '</td>' +
    '</tr>';
  }).join('');

  var gCells = APP.statusList.map(function(s){
    return '<td class="px-2 py-2.5 text-center text-xs font-bold">' + d.grand.counts[s] + '</td>';
  }).join('');

  var head = '<thead class="bg-navy-600 text-white text-xs"><tr>' +
      '<th class="px-3 py-2.5 w-10">#</th>' +
      '<th class="px-3 py-2.5 text-left">ชุด/กลุ่มเรียน</th>' +
      '<th class="px-2 py-2.5">ทั้งหมด</th>' +
      '<th class="px-2 py-2.5">เช็คแล้ว</th>' +
      APP.statusList.map(function(s){ return '<th class="px-2 py-2.5">' + s + '</th>'; }).join('') +
      '<th class="px-2 py-2.5">อัตรา</th><th class="px-2 py-2.5">สถานะ</th>' +
    '</tr></thead>';

  var empty = '<tr><td colspan="13" class="text-center py-8 text-slate-400 text-sm">ไม่พบข้อมูล</td></tr>';

  document.getElementById('dashTable').innerHTML =
    '<table class="w-full min-w-[820px]">' + head +
      '<tbody>' + (rows || empty) + '</tbody>' +
      '<tfoot class="bg-slate-100"><tr>' +
        '<td colspan="2" class="px-3 py-2.5 text-right text-xs font-bold text-navy-700">รวมทั้งสิ้น</td>' +
        '<td class="px-2 py-2.5 text-center text-xs font-bold">' + d.grand.total + '</td>' +
        '<td class="px-2 py-2.5 text-center text-xs font-bold">' + d.grand.checked + '</td>' +
        gCells +
        '<td class="px-2 py-2.5 text-center text-xs font-bold text-emerald-700">' + d.grand.rate + '%</td>' +
        '<td class="px-2 py-2.5 text-center text-[10px] text-slate-500">' + d.savedClassCount + '/' + d.classCount + ' ชุด</td>' +
      '</tr></tfoot>' +
    '</table>';

  var tag = document.getElementById('dashCacheTag');
  if(tag) tag.textContent = (d.fromCache ? '⚡ จากแคช • ' : '🔄 ข้อมูลสด • ') + thDate(d.date);
}

/** =====================================================================
 *  ADMIN : LOGIN
 * ===================================================================== **/
function adminLogin(){
  Swal.fire({
    title: '🔐 เข้าสู่ระบบผู้ดูแล',
    text: 'กรุณากรอกรหัสผ่านผู้ดูแลระบบ',
    input: 'password',
    inputPlaceholder: 'รหัสผ่านแอดมิน',
    showCancelButton: true,
    confirmButtonText: 'เข้าสู่ระบบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1e3a8a',
    cancelButtonColor: '#94a3b8',
    preConfirm: function(v){
      if(!v){ Swal.showValidationMessage('กรุณากรอกรหัสผ่าน'); return false; }
      return v;
    }
  }).then(function(r){
    if(!r.isConfirmed) return;
    showLoading('กำลังตรวจสอบสิทธิ์...');
    api('verifyPassword', 'admin', r.value).then(function(res){
      closeLoading();
      if(!res.ok){ alertErr('เข้าสู่ระบบไม่สำเร็จ', res.msg); return; }
      APP.adminPass = r.value;
      document.getElementById('adminLoginBox').classList.add('hidden');
      document.getElementById('adminPanel').classList.remove('hidden');
      toast('success', 'เข้าสู่ระบบผู้ดูแลสำเร็จ');
      loadAdminStudents();
    }).catch(function(e){ closeLoading(); alertErr('ผิดพลาด', String(e)); });
  });
}

function adminLogout(){
  APP.adminPass = null;
  APP.adminStudents = [];
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('adminLoginBox').classList.remove('hidden');
  toast('info', 'ออกจากระบบผู้ดูแลแล้ว');
}

/** =====================================================================
 *  ADMIN : STUDENT CRUD
 * ===================================================================== **/
function loadAdminStudents(){
  if(!APP.adminPass) return;
  showLoading('กำลังโหลดข้อมูลนักเรียน...');
  api('adminGetStudents', APP.adminPass, '', 'ALL').then(function(res){
    closeLoading();
    if(!res.ok){ alertErr('ผิดพลาด', res.msg); adminLogout(); return; }
    APP.adminStudents = res.students;
    renderAdminTable();
  }).catch(function(e){ closeLoading(); alertErr('ผิดพลาด', String(e)); });
}

function renderAdminTable(){
  var kwEl = document.getElementById('admSearch');
  var fltEl = document.getElementById('admFilter');
  var kw = kwEl ? String(kwEl.value || '').trim().toLowerCase() : '';
  var flt = fltEl ? fltEl.value : 'ALL';

  var list = APP.adminStudents.slice();
  if(flt !== 'ALL'){ list = list.filter(function(s){ return s.cls === flt; }); }
  if(kw){
    list = list.filter(function(s){
      return (s.id + ' ' + s.prefix + ' ' + s.name).toLowerCase().indexOf(kw) > -1;
    });
  }

  // ⭐ ใช้ data-attribute แทน onclick inline → ไม่ต้อง escape quote (กัน Syntax Error)
  var rows = list.map(function(s, i){
    return '<tr class="border-b hover:bg-slate-50">' +
      '<td class="px-3 py-2.5 text-center text-xs text-slate-400">' + (i + 1) + '</td>' +
      '<td class="px-3 py-2.5 text-xs font-mono">' + esc(s.id) + '</td>' +
      '<td class="px-3 py-2.5 text-xs">' + esc(s.prefix) + '</td>' +
      '<td class="px-3 py-2.5 text-sm font-medium">' + esc(s.name) + '</td>' +
      '<td class="px-3 py-2.5 text-xs"><span class="bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full font-semibold">' + esc(s.cls) + '</span></td>' +
      '<td class="px-3 py-2.5 text-center whitespace-nowrap">' +
        '<button type="button" data-act="edit" data-id="' + esc(s.id) + '" class="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg mr-1">✏️ แก้ไข</button>' +
        '<button type="button" data-act="del" data-id="' + esc(s.id) + '" data-name="' + esc(s.name) + '" class="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">🗑️ ลบ</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  var empty = '<tr><td colspan="6" class="text-center py-10 text-slate-400 text-sm">ไม่พบข้อมูลนักเรียน</td></tr>';

  document.getElementById('admTable').innerHTML =
    '<table class="w-full min-w-[720px]">' +
      '<thead class="bg-navy-600 text-white text-xs"><tr>' +
        '<th class="px-3 py-2.5 w-10">#</th>' +
        '<th class="px-3 py-2.5 text-left">รหัสนักเรียน</th>' +
        '<th class="px-3 py-2.5 text-left">คำหน้า</th>' +
        '<th class="px-3 py-2.5 text-left">ชื่อ-สกุล</th>' +
        '<th class="px-3 py-2.5 text-left">ชุด/กลุ่มเรียน</th>' +
        '<th class="px-3 py-2.5 w-40">จัดการ</th>' +
      '</tr></thead>' +
      '<tbody>' + (rows || empty) + '</tbody>' +
      '<tfoot class="bg-slate-100"><tr><td colspan="6" class="px-3 py-2 text-xs text-slate-600 font-semibold">แสดง ' + list.length + ' รายการ จากทั้งหมด ' + APP.adminStudents.length + ' คน</td></tr></tfoot>' +
    '</table>';
}

/** Event Delegation : ผูก listener ครั้งเดียวกับตารางแอดมิน */
document.addEventListener('DOMContentLoaded', function(){
  var box = document.getElementById('admTable');
  if(!box) return;
  box.addEventListener('click', function(ev){
    var btn = ev.target.closest('button[data-act]');
    if(!btn) return;
    var act = btn.getAttribute('data-act');
    var id  = btn.getAttribute('data-id');
    if(act === 'edit') openStudentForm(id);
    if(act === 'del')  removeStudent(id, btn.getAttribute('data-name'));
  });
});

/** ฟอร์มเพิ่ม/แก้ไขนักเรียน (ไม่ส่ง id = เพิ่มใหม่) */
function openStudentForm(id){
  var isEdit = !!id;
  var st = { id:'', prefix:'', name:'', cls:'' };
  if(isEdit){
    var found = APP.adminStudents.filter(function(x){ return x.id === id; })[0];
    if(!found){ toast('error', 'ไม่พบข้อมูลนักเรียน'); return; }
    st = found;
  }

  var clsOptions = APP.classes.map(function(c){
    return '<option value="' + esc(c) + '"' + (st.cls === c ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');

  var prefixes = ['นาย','นาง','นางสาว','พลฯ','จ.อ.','จ.ท.','จ.ต.','พ.จ.อ.','พ.จ.ท.','พ.จ.ต.'];
  var prefixOptions = prefixes.map(function(p){
    return '<option value="' + p + '"' + (st.prefix === p ? ' selected' : '') + '>' + p + '</option>';
  }).join('');

  var inputCls = 'width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;font-family:Sarabun,sans-serif;';
  var labelCls = 'display:block;font-size:12px;font-weight:600;color:#64748b;margin:8px 0 4px;';

  Swal.fire({
    title: isEdit ? '✏️ แก้ไขข้อมูลนักเรียน' : '➕ เพิ่มนักเรียนใหม่',
    html:
      '<div style="text-align:left">' +
        '<label style="' + labelCls + '">รหัสนักเรียน *</label>' +
        '<input id="fId" value="' + esc(st.id) + '" style="' + inputCls + '" placeholder="เช่น 64001">' +
        '<label style="' + labelCls + '">คำหน้า</label>' +
        '<select id="fPrefix" style="' + inputCls + '"><option value="">— เลือก —</option>' + prefixOptions + '</select>' +
        '<label style="' + labelCls + '">ชื่อ-สกุล *</label>' +
        '<input id="fName" value="' + esc(st.name) + '" style="' + inputCls + '" placeholder="เช่น สมชาย ใจดี">' +
        '<label style="' + labelCls + '">ชุด/กลุ่มเรียน *</label>' +
        '<select id="fCls" style="' + inputCls + '"><option value="">— เลือก —</option>' + clsOptions + '</select>' +
      '</div>',
    width: 460,
    showCancelButton: true,
    confirmButtonText: isEdit ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มนักเรียน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#1e3a8a',
    cancelButtonColor: '#94a3b8',
    preConfirm: function(){
      var data = {
        id: document.getElementById('fId').value.trim(),
        prefix: document.getElementById('fPrefix').value,
        name: document.getElementById('fName').value.trim(),
        cls: document.getElementById('fCls').value
      };
      if(!data.id){ Swal.showValidationMessage('กรุณากรอกรหัสนักเรียน'); return false; }
      if(!data.name){ Swal.showValidationMessage('กรุณากรอกชื่อ-สกุล'); return false; }
      if(!data.cls){ Swal.showValidationMessage('กรุณาเลือกชุด/กลุ่มเรียน'); return false; }
      return data;
    }
  }).then(function(r){
    if(!r.isConfirmed) return;
    showLoading(isEdit ? 'กำลังบันทึกการแก้ไข...' : 'กำลังเพิ่มนักเรียน...');
    var call = isEdit
      ? api('adminUpdateStudent', APP.adminPass, id, r.value)
      : api('adminAddStudent', APP.adminPass, r.value);

    call.then(function(res){
      closeLoading();
      if(!res.ok){ alertErr('ไม่สำเร็จ', res.msg); return; }
      toast('success', res.msg);
      loadAdminStudents();
      refreshAfterStudentChange();
    }).catch(function(e){ closeLoading(); alertErr('ผิดพลาด', String(e)); });
  });
}

function removeStudent(id, name){
  Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการลบ',
    html: 'ต้องการลบ <b>' + esc(name) + '</b> (รหัส ' + esc(id) + ') ใช่หรือไม่?' +
          '<br><span style="font-size:12px;color:#64748b">ประวัติการเข้าแถวเดิมจะยังคงอยู่ในระบบ</span>',
    showCancelButton: true,
    confirmButtonText: '🗑️ ลบข้อมูล',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#94a3b8'
  }).then(function(r){
    if(!r.isConfirmed) return;
    showLoading('กำลังลบข้อมูล...');
    api('adminDeleteStudent', APP.adminPass, id).then(function(res){
      closeLoading();
      if(!res.ok){ alertErr('ลบไม่สำเร็จ', res.msg); return; }
      toast('success', res.msg);
      loadAdminStudents();
      refreshAfterStudentChange();
    }).catch(function(e){ closeLoading(); alertErr('ผิดพลาด', String(e)); });
  });
}

/** หลังแก้ไขทะเบียนนักเรียน : ดึงข้อมูลตั้งต้นใหม่ให้ทุกหน้าใช้ข้อมูลล่าสุดทันที */
function refreshAfterStudentChange(){
  api('getInitialData').then(function(res){
    if(!res || !res.ok) return;
    APP.classes = res.classes || APP.classes;

    var ids = ['dailyClass','rangeClass','monClass','indClass','admFilter','atdClass'];
    var keep = {};
    ids.forEach(function(k){
      var el = document.getElementById(k);
      keep[k] = el ? el.value : '';
    });

    fillAllClassSelects();

    ids.forEach(function(k){
      var el = document.getElementById(k);
      if(el && keep[k]) el.value = keep[k];
    });

    loadDashboard();
  }).catch(function(){});
}
