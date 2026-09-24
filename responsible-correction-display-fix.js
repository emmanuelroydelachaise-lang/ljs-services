(() => {
  const FIX_VERSION = '20260916-history-fix-2';

  const changed = (sheet, path) => Array.isArray(sheet?.admin_changes) && sheet.admin_changes.includes(path);

  function escFix(value='') {
    return typeof esc === 'function'
      ? esc(value)
      : String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function installStyles() {
    if (document.getElementById('responsibleCorrectionDisplayFixStyle')) return;
    const style = document.createElement('style');
    style.id = 'responsibleCorrectionDisplayFixStyle';
    style.textContent = `
      .rch-fixed-pair{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:7px;padding:7px 9px;border-radius:8px;background:#fff8f7;border:1px solid #efc2bd;font-size:.82rem;line-height:1.25}
      .rch-fixed-old{color:#667480;text-decoration:line-through;text-decoration-thickness:2px;font-weight:700}
      .rch-fixed-new{color:#c40000;font-weight:900}
      .rch-fixed-label{font-size:.72rem;font-weight:800;color:#667480;text-transform:uppercase;letter-spacing:.03em}
      .rch-project-fixed>.rch-pair{display:none!important}
      .rch-absence-fixed .absence-line>.rch-pair{display:none!important}
      @media print{
        .rch-print-old-fix{color:#555!important;text-decoration:line-through!important;text-decoration-thickness:.35mm!important;font-weight:700!important}
        .rch-print-new-fix{color:#d40000!important;font-weight:900!important}
      }
    `;
    document.head.appendChild(style);
  }

  function rawOriginalDay(sheet, di) {
    const days = sheet?.technician_original?.days;
    if (!Array.isArray(days)) return null;
    const current = sheet?.days?.[di];
    return (current?.date && days.find(d => d?.date === current.date)) || days[di] || null;
  }

  function absenceType(day) {
    const raw = String(day?.absence_type || '').toLowerCase();
    if (['cp','arret','absent'].includes(raw)) return raw;
    return day?.absent ? 'absent' : '';
  }

  function absenceLabel(day) {
    const type = absenceType(day);
    if (type === 'cp') return 'CP';
    if (type === 'arret') return 'ARRÊT';
    if (type === 'absent') return 'ABSENT';
    return 'PRÉSENT';
  }

  function projectParts(entry) {
    if (!entry) return { code:'', name:'—', text:'—' };
    const id = entry.project_id || '';
    if (id === OTHER_PROJECT_ID || id === '__other__' || !id) {
      const code = String(entry.manual_project_code || '').trim();
      const name = String(entry.manual_project_name || '').trim() || 'Chantier autre';
      return { code, name, text: code ? `${code} — ${name}` : name };
    }
    const project = (state?.projects || []).find(p => p.id === id);
    if (project) return { code:String(project.code || ''), name:String(project.name || ''), text:`${project.code} — ${project.name}` };
    return { code:'', name:'Chantier historique', text:'Chantier historique' };
  }

  function directProjectChanged(sheet, di, ei) {
    const prefix = `days.${di}.entries.${ei}`;
    return changed(sheet, `${prefix}.project_id`) ||
      changed(sheet, `${prefix}.manual_project_code`) ||
      changed(sheet, `${prefix}.manual_project_name`);
  }

  function addFixedPair(host, oldValue, newValue, kind='') {
    if (!host) return;
    [...host.children].filter(el => el.classList?.contains('rch-fixed-pair') && (!kind || el.dataset.kind === kind)).forEach(el => el.remove());
    const pair = document.createElement('div');
    pair.className = 'rch-fixed-pair';
    if (kind) pair.dataset.kind = kind;
    pair.innerHTML = `<span class="rch-fixed-label">Technicien</span><span class="rch-fixed-old">${escFix(oldValue ?? '—')}</span><span class="rch-fixed-label">Responsable</span><span class="rch-fixed-new">${escFix(newValue ?? '—')}</span>`;
    host.appendChild(pair);
  }

  function enrichOriginalAbsenceTypes(sheet) {
    if (!sheet?.technician_original?.days || !sheet?.days) return;
    sheet.technician_original.days.forEach((oldDay, di) => {
      if (!oldDay || Object.prototype.hasOwnProperty.call(oldDay, 'absence_type')) return;
      const alreadyChanged = changed(sheet, `days.${di}.absence_type`) || changed(sheet, `days.${di}.absent`);
      if (!alreadyChanged) oldDay.absence_type = absenceType(sheet.days[di]);
      else oldDay.absence_type = oldDay.absent ? 'absent' : '';
    });
  }

  function decorateEditor() {
    const sheet = state?.adminSheet;
    const root = document.getElementById('adminEditor');
    if (!sheet || !root || root.classList.contains('hidden') || !sheet.technician_original) return;

    enrichOriginalAbsenceTypes(sheet);
    root.querySelectorAll('.rch-fixed-pair').forEach(el => el.remove());
    root.querySelectorAll('.rch-project-fixed,.rch-absence-fixed').forEach(el => el.classList.remove('rch-project-fixed','rch-absence-fixed'));

    const sections = [...root.querySelectorAll('.admin-day-block')];
    sections.forEach((section, di) => {
      const oldDay = rawOriginalDay(sheet, di);
      const newDay = sheet.days?.[di];
      if (!oldDay || !newDay) return;

      if (changed(sheet, `days.${di}.absence_type`) || changed(sheet, `days.${di}.absent`)) {
        const host = section.querySelector('.absence-options') || section.querySelector('.absence-line')?.parentElement || section;
        host.classList.add('rch-absence-fixed');
        addFixedPair(host, absenceLabel(oldDay), absenceLabel(newDay), 'absence');
      }

      const rows = [...section.querySelectorAll('.admin-work-list .work-row')];
      rows.forEach((row, ei) => {
        if (!directProjectChanged(sheet, di, ei)) return;
        const oldEntry = oldDay.entries?.[ei];
        const newEntry = newDay.entries?.[ei];
        const oldProject = projectParts(oldEntry);
        const newProject = projectParts(newEntry);
        if (oldProject.text === newProject.text) return;
        const field = row.querySelector('.project')?.closest('.admin-field') || row;
        field.classList.add('rch-project-fixed');
        addFixedPair(field, oldProject.text, newProject.text, 'project');
      });
    });
  }

  function decorateTechnician() {
    const sheet = state?.sheet;
    const root = document.getElementById('app');
    if (!sheet || sheet.status !== 'approved' || !sheet.technician_original || !root) return;

    root.querySelectorAll('.rch-fixed-pair').forEach(el => el.remove());
    root.querySelectorAll('.rch-project-fixed,.rch-absence-fixed').forEach(el => el.classList.remove('rch-project-fixed','rch-absence-fixed'));

    const cards = [...root.querySelectorAll('#days .day-card')];
    cards.forEach((card, di) => {
      const oldDay = rawOriginalDay(sheet, di);
      const newDay = sheet.days?.[di];
      if (!oldDay || !newDay) return;

      if (changed(sheet, `days.${di}.absence_type`) || changed(sheet, `days.${di}.absent`)) {
        const host = card.querySelector('.absence-options') || card.querySelector('.absence-line')?.parentElement || card;
        host.classList.add('rch-absence-fixed');
        addFixedPair(host, absenceLabel(oldDay), absenceLabel(newDay), 'absence');
      }

      const rows = [...card.querySelectorAll('.work-list .work-row')];
      rows.forEach((row, ei) => {
        if (!directProjectChanged(sheet, di, ei)) return;
        const oldEntry = oldDay.entries?.[ei];
        const newEntry = newDay.entries?.[ei];
        const oldProject = projectParts(oldEntry);
        const newProject = projectParts(newEntry);
        if (oldProject.text === newProject.text) return;
        const field = row.querySelector('.project')?.parentElement || row;
        field.classList.add('rch-project-fixed');
        addFixedPair(field, oldProject.text, newProject.text, 'project');
      });
    });
  }

  function decoratePrint(sheet) {
    const root = document.querySelector('#printArea .exact-print-sheet');
    if (!root || !sheet?.technician_original) return;
    const current = typeof normalizeSheet === 'function'
      ? normalizeSheet(typeof deepClone === 'function' ? deepClone(sheet) : JSON.parse(JSON.stringify(sheet)), sheet.week_start)
      : sheet;

    const absentEls = [...root.querySelectorAll('.p-absent')];
    let ai = 0;
    (current.days || []).forEach((newDay, di) => {
      if (!newDay.absent) return;
      const el = absentEls[ai++];
      if (!el) return;
      if (!(changed(current, `days.${di}.absence_type`) || changed(current, `days.${di}.absent`))) return;
      const oldDay = rawOriginalDay(current, di) || { absent:false, absence_type:'' };
      el.classList.remove('red-edit');
      el.innerHTML = `<span class="rch-print-old-fix">${escFix(absenceLabel(oldDay))}</span>&nbsp;&nbsp;<span class="rch-print-new-fix">${escFix(absenceLabel(newDay))}</span>`;
    });

    const comments = root.querySelector('.p-comments');
    if (comments && !comments.querySelector('.rch-project-print-fix')) {
      const notes = [];
      (current.days || []).forEach((newDay, di) => {
        const oldDay = rawOriginalDay(current, di);
        if (!oldDay) return;
        (newDay.entries || []).forEach((newEntry, ei) => {
          if (!directProjectChanged(current, di, ei)) return;
          const oldText = projectParts(oldDay.entries?.[ei]).text;
          const newText = projectParts(newEntry).text;
          if (oldText !== newText) notes.push({ oldText, newText });
        });
      });
      notes.slice(0,4).forEach(note => {
        const line = document.createElement('span');
        line.className = 'rch-print-note rch-project-print-fix';
        line.innerHTML = `Chantier : <span class="rch-print-old-fix">${escFix(note.oldText)}</span> <span class="rch-print-new-fix">${escFix(note.newText)}</span>`;
        comments.appendChild(line);
      });
    }
  }

  function scheduleScreenFix() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      decorateEditor();
      decorateTechnician();
    }));
  }

  function wrapFunctions() {
    const renderAdmin = window.renderAdminEditor;
    if (typeof renderAdmin === 'function' && !renderAdmin.__ljsCorrectionDisplayFix) {
      const wrapped = function(...args) {
        const result = renderAdmin.apply(this, args);
        enrichOriginalAbsenceTypes(state?.adminSheet);
        scheduleScreenFix();
        return result;
      };
      wrapped.__ljsCorrectionDisplayFix = true;
      window.renderAdminEditor = wrapped;
    }

    const renderWeekFn = window.renderWeek;
    if (typeof renderWeekFn === 'function' && !renderWeekFn.__ljsCorrectionDisplayFix) {
      const wrapped = function(...args) {
        const result = renderWeekFn.apply(this, args);
        scheduleScreenFix();
        return result;
      };
      wrapped.__ljsCorrectionDisplayFix = true;
      window.renderWeek = wrapped;
    }

    const printFn = window.printTimesheet;
    if (typeof printFn === 'function' && !printFn.__ljsCorrectionDisplayFix) {
      const wrapped = function(sheet, technicianName) {
        const result = printFn.apply(this, arguments);
        requestAnimationFrame(() => requestAnimationFrame(() => decoratePrint(sheet)));
        return result;
      };
      wrapped.__ljsCorrectionDisplayFix = true;
      window.printTimesheet = wrapped;
    }
  }

  installStyles();
  wrapFunctions();
  document.getElementById('app')?.addEventListener('change', scheduleScreenFix, true);
  document.getElementById('app')?.addEventListener('input', scheduleScreenFix, true);
  setTimeout(() => { wrapFunctions(); scheduleScreenFix(); }, 0);
  setTimeout(() => { wrapFunctions(); scheduleScreenFix(); }, 500);

  window.LJS_RESPONSIBLE_CORRECTION_DISPLAY_FIX = FIX_VERSION;
})();
