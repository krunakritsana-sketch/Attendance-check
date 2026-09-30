
/*************************************************************************************
 * script1.js — JS Client 2
 * สรุปชุด/กลุ่ม (ช่วงวัน) / สรุปรายเดือน (กริด 31 วัน) / สรุปรายบุคคล / Print / CSV
 *************************************************************************************/

/** =====================================================================
 *  4) สรุปชุด/กลุ่มเรียน ตามช่วงวันที่ + Progress Bar
 * ===================================================================== **/
function loadRangeSummary(){
  const cls = document.getElementById('rangeClass').value;
  const s = document.getElementById('rangeStart').value;
  const e = document.getElementById('rangeEnd').value;
  if(!s || !e){ toast('warning','กรุณาเลือกช่วงวันที่'); return; }
  if(s > e){ toast('warning','วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'); return; }

  showLoading('กำลังประมวลผลสถิติ...');
  api('getClassRangeSummary', cls, s, e).then(res => {
    closeLoading();
    if(!res.ok){ alertErr('ผิดพลาด',''); return; }
    APP.cache.range = res;
    renderRange(res);
  }).catch(err => { closeLoading(); alertErr('ผิดพลาด', String(err)); });
}

function renderRange(d){
  const rows = d.students.map((s,i) => {
    const barColor = s.percent >= 80 ? 'bg-emerald-500' : (s.percent >= 60 ? 'bg-amber-500' : 'bg-rose-500');
    const cells = APP.statusList.map(st => '<td class="px-2 py-2 text-center text-xs">'+s.counts[st]+'</td>').join('');
    return '<tr class="border-b hover:bg-slate-50">'+
      '<td class="px-2 py-2 text-center text-xs text-slate-400">'+(i+1)+'</td>'+
      '<td class="px-2 py-2 text-xs">'+esc(s.id)+'</td>'+
      '<td class="px-2 py-2 text-sm font-medium whitespace-nowrap">'+esc(s.prefix)+esc(s.name)+'</td>'+
      '<td class="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">'+esc(s.cls)+'</td>'+
      cells +
      '<td class="px-2 py-2 text-center text-xs font-semibold">'+s.days+'</td>'+
      '<td class="px-2 py-2 min-w-[130px]">'+
        '<div class="flex items-center gap-2">'+
          '<div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-full '+barColor+' rounded-full" style="width:'+Math.min(s.percent,100)+'%"></div></div>'+
          '<span class="text-[11px] font-bold w-11 text-right">'+s.percent+'%</span>'+
        '</div>'+
      '</td>'+
    '</tr>';
  }).join('');

  const totalCells = APP.statusList.map(st => '<td class="px-2 py-2 text-center text-xs font-bold">'+d.totalCounts[st]+'</td>').join('');

  document.getElementById('rangePrint').innerHTML =
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4">'+
      '<div class="text-center mb-4 pb-3 border-b">'+
        '<h2 class="text-lg font-bold text-navy-800">สรุปสถิติการเข้าแถวตามช่วงวันที่</h2>'+
        '<p class="text-sm text-slate-500">'+(d.className==='ALL'?'ทุกชุด/กลุ่มเรียน':esc(d.className))+' • '+thDate(d.startDate)+' ถึง '+thDate(d.endDate)+'</p>'+
      '</div>'+
      '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+
        statBox('จำนวนนักเรียน', d.totalStudents+' คน','text-navy-700')+
        statBox('จำนวนวันที่บันทึก', d.totalDays+' วัน','text-slate-700')+
        statBox('รายการทั้งหมด', d.totalRecords+' รายการ','text-slate-700')+
        statBox('อัตราเข้าแถวเฉลี่ย', d.avgRate+'%','text-emerald-600')+
      '</div>'+
    '</div>'+
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">'+
      '<div class="overflow-x-auto"><table class="w-full min-w-[900px]">'+
        '<thead class="bg-navy-600 text-white text-xs"><tr>'+
          '<th class="px-2 py-2.5 w-10">#</th><th class="px-2 py-2.5 text-left">รหัส</th>'+
          '<th class="px-2 py-2.5 text-left">ชื่อ-สกุล</th><th class="px-2 py-2.5 text-left">ชุด/กลุ่ม</th>'+
          APP.statusList.map(s => '<th class="px-2 py-2.5">'+s+'</th>').join('')+
          '<th class="px-2 py-2.5">รวมวัน</th><th class="px-2 py-2.5">อัตราเข้าแถว</th>'+
        '</tr></thead>'+
        '<tbody>'+(rows || '<tr><td colspan="12" class="text-center py-8 text-slate-400 text-sm">ไม่พบข้อมูล</td></tr>')+'</tbody>'+
        '<tfoot class="bg-slate-100"><tr>'+
          '<td colspan="4" class="px-3 py-2.5 text-right text-xs font-bold text-navy-700">รวมทั้งสิ้น</td>'+
          totalCells+
          '<td class="px-2 py-2.5 text-center text-xs font-bold">'+d.totalRecords+'</td>'+
          '<td class="px-2 py-2.5 text-center text-xs font-bold text-emerald-700">'+d.avgRate+'%</td>'+
        '</tr></tfoot>'+
      '</table></div>'+
    '</div>';
}

/** =====================================================================
 *  5) สรุปรายเดือน — ตารางกริด 1..31 วัน
 *  หมายเหตุ : Backend ส่ง days[] มาให้แล้ว (ปรับตามจำนวนวันจริงของเดือน)
 *  แต่ละช่องคือ grid[day] ที่เป็นตัวย่อ (ม/ส/ลป/ลก/ลช/ข)
 * ===================================================================== **/
function loadMonthly(){
  const cls = document.getElementById('monClass').value;
  const m = document.getElementById('monMonth').value;
  const y = document.getElementById('monYear').value;

  showLoading('กำลังสร้างตารางรายเดือน...');
  api('getMonthlySummary', cls, y, m).then(res => {
    closeLoading();
    if(!res.ok){ alertErr('ผิดพลาด',''); return; }
    APP.cache.monthly = res;
    renderMonthly(res);
  }).catch(err => { closeLoading(); alertErr('ผิดพลาด', String(err)); });
}

/** สีพื้นหลังของตัวย่อในตารางกริด */
function shortColor(code){
  switch(code){
    case 'ม':  return 'bg-emerald-100 text-emerald-700';
    case 'ส':  return 'bg-amber-100 text-amber-700';
    case 'ลป': return 'bg-sky-100 text-sky-700';
    case 'ลก': return 'bg-violet-100 text-violet-700';
    case 'ลช': return 'bg-teal-100 text-teal-700';
    case 'ข':  return 'bg-rose-100 text-rose-700';
    default:   return 'text-slate-300';
  }
}

function renderMonthly(d){
  // ---- หัวตาราง : วันที่ 1..จำนวนวันของเดือน ----
  const dayHead = d.days.map(day => {
    const active = d.activeDays.indexOf(day) > -1;
    return '<th class="px-1 py-1.5 text-[10px] font-bold '+(active ? 'bg-navy-700' : 'bg-navy-500/70 text-blue-200')+'">'+day+'</th>';
  }).join('');

  // ---- แถวนักเรียน ----
  const rows = d.students.map((s,i) => {
    const dayCells = d.days.map(day => {
      const code = s.grid[day] || '';
      return '<td class="px-0.5 py-1 text-center text-[10px] font-bold '+shortColor(code)+'">'+(code||'·')+'</td>';
    }).join('');
    const stCells = APP.statusList.map(st => '<td class="px-1.5 py-1 text-center text-[11px]">'+s.counts[st]+'</td>').join('');
    return '<tr class="hover:bg-slate-50">'+
      '<td class="px-1.5 py-1 text-center text-[10px] text-slate-400 sticky left-0 bg-white">'+(i+1)+'</td>'+
      '<td class="px-2 py-1 text-[11px] whitespace-nowrap sticky left-8 bg-white font-medium">'+esc(s.prefix)+esc(s.name)+'</td>'+
      dayCells + stCells +
      '<td class="px-1.5 py-1 text-center text-[11px] font-bold '+(s.percent>=80?'text-emerald-600':(s.percent>=60?'text-amber-600':'text-rose-600'))+'">'+s.percent+'%</td>'+
    '</tr>';
  }).join('');

  const totalCells = APP.statusList.map(st => '<td class="px-1.5 py-2 text-center text-[11px] font-bold">'+d.totalCounts[st]+'</td>').join('');

  const legend = APP.statusList.map(s => {
    const code = APP.statusShort[s];
    return '<span class="inline-flex items-center gap-1 mr-3 mb-1"><span class="'+shortColor(code)+' px-1.5 py-0.5 rounded text-[10px] font-bold">'+code+'</span><span class="text-[11px] text-slate-500">'+s+'</span></span>';
  }).join('');

  document.getElementById('monPrint').innerHTML =
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4">'+
      '<div class="text-center mb-3 pb-3 border-b">'+
        '<h2 class="text-lg font-bold text-navy-800">ตารางสรุปการเข้าแถวรายเดือน</h2>'+
        '<p class="text-sm text-slate-500">เดือน'+TH_MONTH[d.month-1]+' พ.ศ. '+(d.year+543)+' • '+(d.className==='ALL'?'ทุกชุด/กลุ่มเรียน':esc(d.className))+' ('+d.daysInMonth+' วัน)</p>'+
      '</div>'+
      '<div class="flex flex-wrap">'+legend+'</div>'+
      '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">'+
        statBox('นักเรียน', d.students.length+' คน','text-navy-700')+
        statBox('บันทึกแล้ว', d.activeDays.length+' วัน','text-slate-700')+
        statBox('รายการรวม', d.totalRecords+'','text-slate-700')+
        statBox('เข้าแถวเฉลี่ย', d.avgRate+'%','text-emerald-600')+
      '</div>'+
    '</div>'+
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">'+
      '<div class="overflow-x-auto"><table class="grid31 w-full text-slate-700" style="min-width:'+(420 + d.daysInMonth*26)+'px">'+
        '<thead class="bg-navy-600 text-white"><tr>'+
          '<th class="px-1 py-1.5 text-[10px] sticky left-0 bg-navy-600 w-8">#</th>'+
          '<th class="px-2 py-1.5 text-[11px] text-left sticky left-8 bg-navy-600">ชื่อ-สกุล</th>'+
          dayHead +
          APP.statusList.map(s => '<th class="px-1.5 py-1.5 text-[10px]">'+APP.statusShort[s]+'</th>').join('')+
          '<th class="px-1.5 py-1.5 text-[10px]">%</th>'+
        '</tr></thead>'+
        '<tbody>'+(rows || '<tr><td colspan="'+(d.daysInMonth+9)+'" class="text-center py-8 text-slate-400 text-sm">ไม่พบข้อมูล</td></tr>')+'</tbody>'+
        '<tfoot class="bg-slate-100"><tr>'+
          '<td colspan="'+(2 + d.daysInMonth)+'" class="px-3 py-2 text-right text-[11px] font-bold text-navy-700">รวมทั้งสิ้น</td>'+
          totalCells+
          '<td class="px-1.5 py-2 text-center text-[11px] font-bold text-emerald-700">'+d.avgRate+'%</td>'+
        '</tr></tfoot>'+
      '</table></div>'+
    '</div>';
}

/** =====================================================================
 *  6) สรุปรายบุคคล
 * ===================================================================== **/
function reloadStudentOptions(){
  const cls = document.getElementById('indClass') ? document.getElementById('indClass').value : 'ALL';
  api('getStudentOptions', cls).then(res => {
    const sel = document.getElementById('indStudent');
    if(!sel) return;
    sel.innerHTML = res.students.length
      ? res.students.map(s => '<option value="'+esc(s.id)+'">'+esc(s.id)+' — '+esc(s.prefix)+esc(s.name)+'</option>').join('')
      : '<option value="">— ไม่พบนักเรียน —</option>';
  }).catch(()=>{});
}

function loadIndividual(){
  const id = document.getElementById('indStudent').value;
  const s = document.getElementById('indStart').value;
  const e = document.getElementById('indEnd').value;
  if(!id){ toast('warning','กรุณาเลือกนักเรียน'); return; }

  showLoading('กำลังดึงประวัติการเข้าแถว...');
  api('getStudentHistory', id, s, e).then(res => {
    closeLoading();
    if(!res.ok){ alertErr('ผิดพลาด', res.msg||''); return; }
    APP.cache.individual = res;
    renderIndividual(res);
  }).catch(err => { closeLoading(); alertErr('ผิดพลาด', String(err)); });
}

function renderIndividual(d){
  const cards = APP.statusList.map(s => {
    const c = ST_COLOR[s];
    return '<div class="'+c.light+' border border-slate-200 rounded-xl p-3 text-center">'+
      '<p class="text-[11px] font-semibold '+c.text+'">'+s+'</p>'+
      '<p class="text-xl font-extrabold '+c.text+'">'+d.counts[s]+'</p>'+
      '<p class="text-[10px] text-slate-500">'+d.percents[s]+'%</p></div>';
  }).join('');

  const rows = d.records.map((r,i) => {
    const c = ST_COLOR[r.status] || {bg:'bg-slate-400'};
    return '<tr class="border-b hover:bg-slate-50 align-top">'+
      '<td class="px-3 py-2 text-center text-xs text-slate-400">'+(i+1)+'</td>'+
      '<td class="px-3 py-2 text-xs whitespace-nowrap">'+thDateShort(r.date)+'</td>'+
      '<td class="px-3 py-2 text-center"><span class="'+c.bg+' text-white text-[11px] font-bold px-2.5 py-1 rounded-full">'+esc(r.status)+'</span></td>'+
      '<td class="px-3 py-2 text-xs text-slate-600">'+esc(r.note||'-')+'</td>'+
      '<td class="px-3 py-2 text-xs text-slate-500">'+esc(r.content||'-')+'</td>'+
    '</tr>';
  }).join('');

  const rateColor = d.attendanceRate >= 80 ? 'text-emerald-600' : (d.attendanceRate >= 60 ? 'text-amber-600' : 'text-rose-600');

  document.getElementById('indPrint').innerHTML =
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4">'+
      '<div class="text-center mb-4 pb-3 border-b">'+
        '<h2 class="text-lg font-bold text-navy-800">สรุปการเข้าแถวรายบุคคล</h2>'+
        '<p class="text-base font-semibold text-slate-700 mt-1">'+esc(d.student.prefix)+esc(d.student.name)+'</p>'+
        '<p class="text-sm text-slate-500">รหัส '+esc(d.student.id)+' • '+esc(d.student.cls)+'</p>'+
        '<p class="text-xs text-slate-400 mt-1">ช่วง '+thDate(d.startDate)+' ถึง '+thDate(d.endDate)+'</p>'+
      '</div>'+
      '<div class="grid grid-cols-2 gap-3 mb-4">'+
        statBox('จำนวนวันที่บันทึก', d.totalDays+' วัน','text-navy-700')+
        statBox('อัตราการเข้าแถว', d.attendanceRate+'%', rateColor)+
      '</div>'+
      '<div class="h-3 bg-slate-200 rounded-full overflow-hidden mb-4">'+
        '<div class="h-full '+(d.attendanceRate>=80?'bg-emerald-500':(d.attendanceRate>=60?'bg-amber-500':'bg-rose-500'))+'" style="width:'+Math.min(d.attendanceRate,100)+'%"></div>'+
      '</div>'+
      '<div class="grid grid-cols-3 sm:grid-cols-6 gap-2">'+cards+'</div>'+
    '</div>'+
    '<div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">'+
      '<div class="px-4 py-3 bg-slate-50 border-b"><h3 class="font-bold text-navy-700 text-sm">ประวัติรายวัน</h3></div>'+
      '<div class="overflow-x-auto"><table class="w-full min-w-[700px]">'+
        '<thead class="bg-slate-100 text-slate-600 text-xs"><tr>'+
          '<th class="px-3 py-2 w-10">#</th><th class="px-3 py-2 text-left">วันที่</th><th class="px-3 py-2">สถานะ</th>'+
          '<th class="px-3 py-2 text-left">หมายเหตุ</th><th class="px-3 py-2 text-left">เนื้อหา/กิจกรรมการอบรม</th>'+
        '</tr></thead><tbody>'+(rows||'<tr><td colspan="5" class="text-center py-8 text-slate-400 text-sm">ไม่พบข้อมูลในช่วงเวลานี้</td></tr>')+'</tbody>'+
      '</table></div>'+
    '</div>';
}

/** =====================================================================
 *  ระบบพิมพ์ (Print) — จัดหน้า A4 อัตโนมัติผ่าน hidden iframe
 *  ใช้ iframe แทน window.open เพราะ GAS รันในโหมด sandbox iframe
 * ===================================================================== **/
function printReport(elementId, title){
  const el = document.getElementById(elementId);
  if(!el || !el.innerHTML.trim()){ toast('warning','ยังไม่มีข้อมูลให้พิมพ์ กรุณากดแสดงผลก่อน'); return; }

  const css = `
    @page { size: A4 landscape; margin: 10mm; }
    *{font-family:'Sarabun',sans-serif;box-sizing:border-box;}
    body{margin:0;color:#0f172a;font-size:11px;}
    .doc-head{text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:12px;}
    .doc-head h1{font-size:16px;margin:0;color:#1e3a8a;}
    .doc-head p{font-size:11px;margin:2px 0 0;color:#475569;}
    table{width:100%;border-collapse:collapse;margin-bottom:10px;}
    th,td{border:1px solid #94a3b8;padding:3px 5px;font-size:10px;}
    thead th{background:#1e3a8a !important;color:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    tfoot td{background:#e2e8f0 !important;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    button{display:none !important;}
    .sign{margin-top:26px;display:flex;justify-content:flex-end;gap:60px;font-size:11px;text-align:center;}
    div[class*="grid"]{display:flex;flex-wrap:wrap;gap:6px;}
    div[class*="rounded"]{border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;}
    * { background-image:none !important; box-shadow:none !important; }
  `;

  const now = new Date();
  const stamp = now.toLocaleDateString('th-TH', {day:'numeric', month:'long', year:'numeric'}) + ' เวลา ' + now.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});

  const html =
    '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">'+
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">'+
    '<style>'+css+'</style></head><body>'+
      '<div class="doc-head">'+
        '<h1>โรงเรียนสารบรรณ กรมสารบรรณทหารเรือ</h1>'+
        '<p>'+esc(title)+'</p>'+
        '<p style="font-size:10px;color:#64748b;">พิมพ์เมื่อ '+esc(stamp)+'</p>'+
      '</div>'+
      el.innerHTML +
      '<div class="sign"><div>ลงชื่อ.............................................<br>(...........................................)<br>ผู้รายงาน</div>'+
      '<div>ลงชื่อ.............................................<br>(...........................................)<br>ผู้ตรวจสอบ</div></div>'+
    '</body></html>';

  const frame = document.getElementById('printFrame');
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); }, 700);
}

/** =====================================================================
 *  ระบบ Export CSV (รองรับภาษาไทยด้วย UTF-8 BOM)
 * ===================================================================== **/
function csvCell(v){
  const s = String(v == null ? '' : v);
  return '"' + s.replace(/"/g,'""') + '"';
}

function downloadCSV(filename, rows){
  const content = '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');  // BOM กันภาษาไทยเพี้ยนใน Excel
  const blob = new Blob([content], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  toast('success','ดาวน์โหลดไฟล์ CSV แล้ว');
}

function exportDailyCSV(){
  const d = APP.cache.daily;
  if(!d){ toast('warning','กรุณากดแสดงผลก่อน'); return; }
  const rows = [
    ['สรุปการเข้าแถวประจำวัน '+thDate(d.date)+' ('+(d.className==='ALL'?'ทุกชุด':d.className)+')'],
    ['เช็คชื่อแล้ว', d.checked, 'จากทั้งหมด', d.total, 'อัตราเข้าแถว', d.attendanceRate+'%'],
    [],
    ['ลำดับ','รหัสนักเรียน','คำหน้า','ชื่อ-สกุล','ชุด/กลุ่มเรียน','สถานะ','หมายเหตุ']
  ];
  d.students.forEach((s,i) => rows.push([i+1, s.id, s.prefix, s.name, s.cls, s.status, s.note]));
  rows.push([]);
  rows.push(['สรุปจำนวน'].concat(APP.statusList));
  rows.push([''].concat(APP.statusList.map(s => d.counts[s])));
  downloadCSV('สรุปรายวัน_'+d.date+'.csv', rows);
}

function exportRangeCSV(){
  const d = APP.cache.range;
  if(!d){ toast('warning','กรุณากดแสดงผลก่อน'); return; }
  const rows = [
    ['สรุปการเข้าแถวช่วงวันที่ '+thDate(d.startDate)+' ถึง '+thDate(d.endDate)],
    ['ชุด/กลุ่มเรียน', d.className==='ALL'?'ทุกชุด':d.className, 'จำนวนวัน', d.totalDays],
    [],
    ['ลำดับ','รหัสนักเรียน','คำหน้า','ชื่อ-สกุล','ชุด/กลุ่มเรียน'].concat(APP.statusList).concat(['รวมวัน','อัตราเข้าแถว(%)'])
  ];
  d.students.forEach((s,i) =>
    rows.push([i+1, s.id, s.prefix, s.name, s.cls].concat(APP.statusList.map(x => s.counts[x])).concat([s.days, s.percent]))
  );
  rows.push(['','','','','รวมทั้งสิ้น'].concat(APP.statusList.map(x => d.totalCounts[x])).concat([d.totalRecords, d.avgRate]));
  downloadCSV('สรุปชุด_'+d.startDate+'_ถึง_'+d.endDate+'.csv', rows);
}

function exportMonthlyCSV(){
  const d = APP.cache.monthly;
  if(!d){ toast('warning','กรุณากดแสดงผลก่อน'); return; }
  const head = ['ลำดับ','รหัสนักเรียน','ชื่อ-สกุล','ชุด/กลุ่มเรียน']
    .concat(d.days.map(x => String(x)))
    .concat(APP.statusList).concat(['อัตราเข้าแถว(%)']);
  const rows = [
    ['ตารางสรุปการเข้าแถวเดือน'+TH_MONTH[d.month-1]+' พ.ศ. '+(d.year+543)],
    ['ชุด/กลุ่มเรียน', d.className==='ALL'?'ทุกชุด':d.className],
    ['ตัวย่อ: ม=มา, ส=สาย, ลป=ลาป่วย, ลก=ลากิจ, ลช=ลาชั่วกาล, ข=ขาดแถว'],
    [], head
  ];
  d.students.forEach((s,i) =>
    rows.push([i+1, s.id, s.prefix+s.name, s.cls]
      .concat(d.days.map(day => s.grid[day] || ''))
      .concat(APP.statusList.map(x => s.counts[x]))
      .concat([s.percent]))
  );
  rows.push(['','','รวมทั้งสิ้น',''].concat(d.days.map(()=>''))
    .concat(APP.statusList.map(x => d.totalCounts[x])).concat([d.avgRate]));
  downloadCSV('สรุปรายเดือน_'+d.year+'-'+('0'+d.month).slice(-2)+'.csv', rows);
}

function exportIndividualCSV(){
  const d = APP.cache.individual;
  if(!d){ toast('warning','กรุณากดแสดงผลก่อน'); return; }
  const rows = [
    ['สรุปการเข้าแถวรายบุคคล'],
    ['ชื่อ-สกุล', d.student.prefix+d.student.name, 'รหัส', d.student.id, 'ชุด', d.student.cls],
    ['ช่วงวันที่', thDate(d.startDate)+' ถึง '+thDate(d.endDate), 'อัตราเข้าแถว', d.attendanceRate+'%'],
    [],
    ['ลำดับ','วันที่','ชุด/กลุ่มเรียน','สถานะ','หมายเหตุ','เนื้อหา/กิจกรรมการอบรม']
  ];
  d.records.forEach((r,i) => rows.push([i+1, r.date, r.cls, r.status, r.note, r.content]));
  rows.push([]);
  rows.push(['สรุปจำนวน'].concat(APP.statusList));
  rows.push([''].concat(APP.statusList.map(s => d.counts[s])));
  downloadCSV('สรุปรายบุคคล_'+d.student.id+'.csv', rows);
}
