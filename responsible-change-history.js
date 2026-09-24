(() => {
  const visibleChange = path => path && path !== 'responsible_signature';
  const changed = (sheet, path) => (sheet?.admin_changes || []).includes(path);
  const changedPrefix = (sheet, prefix) => (sheet?.admin_changes || []).some(p => p === prefix || p.startsWith(prefix + '.'));

  function injectStyles() {
    if (document.getElementById('responsibleChangeHistoryStyles')) return;
    const style = document.createElement('style');
    style.id = 'responsibleChangeHistoryStyles';
    style.textContent = `
      .rch-pair{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:7px;padding:7px 9px;border-radius:8px;background:#fff8f7;border:1px solid #efc2bd;font-size:.82rem;line-height:1.25}
      .rch-old{color:#667480;text-decoration:line-through;text-decoration-thickness:2px}
      .rch-new{color:#c40000;font-weight:850}
      .rch-label{font-size:.72rem;font-weight:800;color:#667480;text-transform:uppercase;letter-spacing:.03em}
      .rch-structural{margin-top:10px}
      .rch-history-missing{margin-top:8px;color:#a15c00;font-size:.8rem}
      @media print{
        .rch-print-pair{width:100%;height:100%;display:flex;gap:1mm;align-items:center;justify-content:center;flex-wrap:wrap;background:#fff;padding:.2mm;box-sizing:border-box;line-height:1}
        .rch-print-old{color:#555;text-decoration:line-through;text-decoration-thickness:.35mm;font-weight:650}
        .rch-print-new{color:#d40000;font-weight:900}
        .rch-print-note{display:block;width:100%;font-size:6pt;line-height:1.15;margin-bottom:.5mm}
        .rch-print-note .rch-print-old,.rch-print-note .rch-print-new{display:inline}
      }
    `;
    document.head.appendChild(style);
  }

  function makeSnapshot(sheet) {
    return {
      vehicle_id: sheet.vehicle_id || null,
      general_comment: sheet.general_comment || '',
      days: (sheet.days || []).map(d => ({
        date: d.date,
        zone: Number(d.zone || 0),
        absent: Boolean(d.absent),
        comment: d.comment || '',
        entries: (d.entries || []).map(e => ({
          project_id: e.project_id || '',
          manual_project_code: e.manual_project_code || '',
          manual_project_name: e.manual_project_name || '',
          hours: Number(e.hours || 0)
        }))
      }))
    };
  }

  function ensureSnapshot(sheet) {
    if (!sheet || sheet.technician_original) return;
    const alreadyCorrected = (sheet.admin_changes || []).some(visibleChange);
    if (alreadyCorrected) return;
    sheet.technician_original = makeSnapshot(sheet);
  }

  function originalSheet(sheet) {
    if (!sheet?.technician_original) return null;
    return normalizeSheet({
      week_start: sheet.week_start,
      vehicle_id: sheet.technician_original.vehicle_id || null,
      general_comment: sheet.technician_original.general_comment || '',
      days: deepClone(sheet.technician_original.days || [])
    }, sheet.week_start);
  }

  function vehicleText(id) {
    if (!id) return 'Aucun véhicule';
    const v = vehicleById(id);
    if (!v) return 'Véhicule historique';
    const brand = String(v.brand || '').trim();
    return brand ? `${brand.toUpperCase()} — ${v.registration}` : v.registration;
  }

  function projectText(entry) {
    if (!entry) return '—';
    if (entry.project_id === OTHER_PROJECT_ID || !entry.project_id) {
      const code = String(entry.manual_project_code || '').trim();
      const name = String(entry.manual_project_name || '').trim() || 'Chantier autre';
      return code ? `${code} — ${name}` : name;
    }
    const p = projectById(entry.project_id);
    return p ? `${p.code} — ${p.name}` : 'Chantier historique';
  }

  function entriesText(day) {
    if (!day || day.absent) return day?.absent ? 'Absent' : 'Aucune heure';
    const lines = (day.entries || [])
      .filter(e => Number(e.hours || 0) > 0)
      .map(e => `${projectText(e)} : ${fmtHours(e.hours)}`);
    return lines.length ? lines.join(' · ') : 'Aucune heure';
  }

  function addPair(host, oldValue, newValue, extraClass='') {
    if (!host) return;
    host.querySelectorAll(':scope > .rch-pair').forEach(el => el.remove());
    const pair = document.createElement('div');
    pair.className = `rch-pair ${extraClass}`.trim();
    pair.innerHTML = `<span class="rch-label">Technicien</span><span class="rch-old">${esc(oldValue ?? '—')}</span><span class="rch-label">Responsable</span><span class="rch-new">${esc(newValue ?? '—')}</span>`;
    host.appendChild(pair);
  }

  function clearPairs(root=document) {
    root.querySelectorAll('.rch-pair,.rch-history-missing').forEach(el => el.remove());
  }

  function decorateAdminEditor() {
    const sheet = state?.adminSheet;
    const root = document.getElementById('adminEditor');
    if (!sheet || !root || root.classList.contains('hidden')) return;
    clearPairs(root);
    const original = originalSheet(sheet);
    if (!original) {
      if ((sheet.admin_changes || []).some(visibleChange)) {
        const note = document.createElement('div');
        note.className = 'rch-history-missing';
        note.textContent = 'Ancienne correction : la valeur technicien d’origine n’avait pas encore été enregistrée.';
        root.querySelector('.admin-red-note')?.insertAdjacentElement('afterend', note);
      }
      return;
    }

    if (changed(sheet, 'vehicle_id')) addPair(document.getElementById('adminVehicle')?.closest('.admin-field'), vehicleText(original.vehicle_id), vehicleText(sheet.vehicle_id));
    if (changed(sheet, 'general_comment')) addPair(document.getElementById('adminWeekComment')?.closest('.admin-field'), original.general_comment || 'Aucun commentaire', sheet.general_comment || 'Aucun commentaire');

    const sections = [...root.querySelectorAll('.admin-day-block')];
    sections.forEach((sec, di) => {
      const oldDay = original.days?.[di];
      const newDay = sheet.days?.[di];
      if (!oldDay || !newDay) return;
      if (changed(sheet, `days.${di}.absent`)) addPair(sec.querySelector('.absence-line'), oldDay.absent ? 'Absent' : 'Présent', newDay.absent ? 'Absent' : 'Présent');
      if (changed(sheet, `days.${di}.zone`)) addPair(sec.querySelector('.admin-zone')?.closest('.admin-field'), `Zone ${oldDay.zone}`, `Zone ${newDay.zone}`);

      if (changed(sheet, `days.${di}.entries`)) {
        addPair(sec.querySelector('.admin-work-list')?.parentElement, entriesText(oldDay), entriesText(newDay), 'rch-structural');
        return;
      }

      const rows = [...sec.querySelectorAll('.admin-work-list .work-row')];
      rows.forEach((row, ei) => {
        const oldEntry = oldDay.entries?.[ei];
        const newEntry = newDay.entries?.[ei];
        if (!newEntry) return;
        const prefix = `days.${di}.entries.${ei}`;
        if (changed(sheet, `${prefix}.project_id`)) addPair(row.querySelector('.project')?.closest('.admin-field'), projectText(oldEntry), projectText(newEntry));
        if (changed(sheet, `${prefix}.hours`)) addPair(row.querySelector('.hours')?.closest('.admin-field'), fmtHours(oldEntry?.hours || 0), fmtHours(newEntry.hours || 0));
        if (changed(sheet, `${prefix}.manual_project_code`)) addPair(row.querySelector('.manual-code')?.closest('.admin-field'), oldEntry?.manual_project_code || '—', newEntry.manual_project_code || '—');
        if (changed(sheet, `${prefix}.manual_project_name`)) addPair(row.querySelector('.manual-name')?.closest('.admin-field'), oldEntry?.manual_project_name || '—', newEntry.manual_project_name || '—');
      });
    });
  }

  function decorateTechnicianView() {
    const sheet = state?.sheet;
    if (!sheet || sheet.status !== 'approved') return;
    const original = originalSheet(sheet);
    if (!original) return;
    const appRoot = document.getElementById('app');
    clearPairs(appRoot);

    if (changed(sheet, 'vehicle_id')) addPair(document.getElementById('vehicleSelect')?.parentElement, vehicleText(original.vehicle_id), vehicleText(sheet.vehicle_id));
    if (changed(sheet, 'general_comment')) addPair(document.getElementById('weekComment')?.closest('.card'), original.general_comment || 'Aucun commentaire', sheet.general_comment || 'Aucun commentaire');

    const cards = [...document.querySelectorAll('#days .day-card')];
    cards.forEach((card, di) => {
      const oldDay = original.days?.[di];
      const newDay = sheet.days?.[di];
      if (!oldDay || !newDay) return;
      if (changed(sheet, `days.${di}.absent`)) addPair(card.querySelector('.absence-line'), oldDay.absent ? 'Absent' : 'Présent', newDay.absent ? 'Absent' : 'Présent');
      if (changed(sheet, `days.${di}.zone`)) addPair(card.querySelector('.zone')?.parentElement, `Zone ${oldDay.zone}`, `Zone ${newDay.zone}`);
      if (changed(sheet, `days.${di}.entries`)) {
        addPair(card.querySelector('.work-list')?.parentElement, entriesText(oldDay), entriesText(newDay), 'rch-structural');
        return;
      }
      const rows = [...card.querySelectorAll('.work-list .work-row')];
      rows.forEach((row, ei) => {
        const oldEntry = oldDay.entries?.[ei];
        const newEntry = newDay.entries?.[ei];
        if (!newEntry) return;
        const prefix = `days.${di}.entries.${ei}`;
        if (changed(sheet, `${prefix}.project_id`)) addPair(row.querySelector('.project')?.parentElement, projectText(oldEntry), projectText(newEntry));
        if (changed(sheet, `${prefix}.hours`)) addPair(row.querySelector('.hours')?.parentElement, fmtHours(oldEntry?.hours || 0), fmtHours(newEntry.hours || 0));
        if (changed(sheet, `${prefix}.manual_project_code`)) addPair(row.querySelector('.manual-code')?.parentElement, oldEntry?.manual_project_code || '—', newEntry.manual_project_code || '—');
        if (changed(sheet, `${prefix}.manual_project_name`)) addPair(row.querySelector('.manual-name')?.parentElement, oldEntry?.manual_project_name || '—', newEntry.manual_project_name || '—');
      });
    });
  }

  function setPrintPair(el, oldValue, newValue) {
    if (!el) return;
    el.classList.remove('red-edit');
    el.innerHTML = `<div class="rch-print-pair"><span class="rch-print-old">${esc(oldValue ?? '—')}</span><span class="rch-print-new">${esc(newValue ?? '—')}</span></div>`;
  }

  function projectCorrectionNotes(sheet, original) {
    const notes = [];
    for (let di=0; di<Math.min(sheet.days.length, original.days.length); di++) {
      if (changed(sheet, `days.${di}.entries`)) {
        notes.push({old:entriesText(original.days[di]), now:entriesText(sheet.days[di])});
        continue;
      }
      const count = Math.max(sheet.days[di].entries?.length || 0, original.days[di].entries?.length || 0);
      for (let ei=0; ei<count; ei++) {
        const prefix = `days.${di}.entries.${ei}`;
        if (changed(sheet, `${prefix}.project_id`) || changed(sheet, `${prefix}.manual_project_code`) || changed(sheet, `${prefix}.manual_project_name`)) {
          const oldText = projectText(original.days[di].entries?.[ei]);
          const nowText = projectText(sheet.days[di].entries?.[ei]);
          if (oldText !== nowText) notes.push({old:oldText, now:nowText});
        }
      }
    }
    return notes.slice(0,4);
  }

  function decoratePrintComparison(sheet) {
    const root = printArea?.querySelector('.exact-print-sheet');
    if (!root) return;
    const normalized = normalizeSheet(deepClone(sheet), sheet.week_start);
    const original = originalSheet(normalized);
    if (!original) return;

    if (changed(normalized, 'vehicle_id')) setPrintPair(root.querySelector('.p-field.red-edit'), vehicleText(original.vehicle_id), vehicleText(normalized.vehicle_id));

    const comments = root.querySelector('.p-comments');
    if (comments) {
      const notes = projectCorrectionNotes(normalized, original);
      if (changed(normalized, 'general_comment')) {
        comments.innerHTML = `<span class="rch-print-note"><span class="rch-print-old">${esc(original.general_comment || 'Aucun commentaire')}</span> <span class="rch-print-new">${esc(normalized.general_comment || 'Aucun commentaire')}</span></span>`;
      }
      if (notes.length) {
        comments.innerHTML += notes.map(n => `<span class="rch-print-note">Chantier : <span class="rch-print-old">${esc(n.old)}</span> <span class="rch-print-new">${esc(n.now)}</span></span>`).join('');
      }
    }

    const zoneEls = [...root.querySelectorAll('.p-zone')];
    let zi = 0;
    normalized.days.forEach((day, di) => {
      if (!day.absent && totalDay(day) > 0) {
        const el = zoneEls[zi++];
        if (changed(normalized, `days.${di}.zone`)) setPrintPair(el, String(original.days[di]?.zone ?? 0), String(day.zone ?? 0));
      }
    });

    const projects = getPrintProjects(normalized);
    const hourEls = [...root.querySelectorAll('.p-hours')];
    let hi = 0;
    normalized.days.forEach((day, di) => {
      if (day.absent) return;
      projects.forEach(p => {
        const now = cellHoursForProject(day, p.key);
        if (!now) return;
        const el = hourEls[hi++];
        if (cellChangedForProject(normalized, di, p.key)) {
          const old = cellHoursForProject(original.days[di] || {absent:false,entries:[]}, p.key);
          setPrintPair(el, fmtCellHours(old || 0), fmtCellHours(now));
        }
      });
    });

    const dayTotalEls = [...root.querySelectorAll('.p-day-total')];
    let diEl = 0;
    normalized.days.forEach((day, di) => {
      const now = totalDay(day);
      if (!day.absent && now > 0) {
        const el = dayTotalEls[diEl++];
        if (dayHoursChanged(normalized, di)) setPrintPair(el, fmtCellHours(totalDay(original.days[di]) || 0), fmtCellHours(now));
      }
    });

    const projectTotalEls = [...root.querySelectorAll('.p-project-total')];
    let pti = 0;
    projects.forEach(p => {
      const now = normalized.days.reduce((sum,d)=>sum+cellHoursForProject(d,p.key),0);
      if (!now) return;
      const el = projectTotalEls[pti++];
      const isChanged = normalized.days.some((d,di)=>cellChangedForProject(normalized,di,p.key));
      if (isChanged) {
        const old = original.days.reduce((sum,d)=>sum+cellHoursForProject(d,p.key),0);
        setPrintPair(el, fmtCellHours(old || 0), fmtCellHours(now));
      }
    });

    if ((normalized.admin_changes || []).some(p => p.includes('.entries') || p.endsWith('.absent'))) {
      setPrintPair(root.querySelector('.p-week-total'), fmtCellHours(totalWeek(original)), fmtCellHours(totalWeek(normalized)));
    }

    const absentEls = [...root.querySelectorAll('.p-absent')];
    let ai = 0;
    normalized.days.forEach((day, di) => {
      if (!day.absent) return;
      const el = absentEls[ai++];
      if (changed(normalized, `days.${di}.absent`)) setPrintPair(el, original.days[di]?.absent ? 'ABSENT' : 'PRÉSENT', 'ABSENT');
    });
  }

  function scheduleDecorations() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      decorateAdminEditor();
      decorateTechnicianView();
    }));
  }

  injectStyles();

  const baseOpenAdminSheet = window.openAdminSheet;
  if (typeof baseOpenAdminSheet === 'function' && !baseOpenAdminSheet.__rchWrapped) {
    const wrapped = async function(...args) {
      const result = await baseOpenAdminSheet.apply(this, args);
      ensureSnapshot(state.adminSheet);
      scheduleDecorations();
      return result;
    };
    wrapped.__rchWrapped = true;
    window.openAdminSheet = wrapped;
  }

  const baseRenderAdminEditor = window.renderAdminEditor;
  if (typeof baseRenderAdminEditor === 'function' && !baseRenderAdminEditor.__rchWrapped) {
    const wrapped = function(...args) {
      const result = baseRenderAdminEditor.apply(this, args);
      ensureSnapshot(state.adminSheet);
      scheduleDecorations();
      return result;
    };
    wrapped.__rchWrapped = true;
    window.renderAdminEditor = wrapped;
  }

  const baseSaveAdminSheet = window.saveAdminSheet;
  if (typeof baseSaveAdminSheet === 'function' && !baseSaveAdminSheet.__rchWrapped) {
    const wrapped = async function(...args) {
      const sheet = state.adminSheet;
      ensureSnapshot(sheet);
      if (isCloud && sheet?.id && sheet?.technician_original) {
        const { error } = await sb.from('ljs_timesheets').update({ technician_original: sheet.technician_original }).eq('id', sheet.id);
        if (error) {
          console.error(error);
          alert('Impossible de conserver la saisie d’origine du technicien. La correction n’a pas été enregistrée.');
          return;
        }
      }
      return await baseSaveAdminSheet.apply(this, args);
    };
    wrapped.__rchWrapped = true;
    window.saveAdminSheet = wrapped;
  }

  const baseRenderWeek = window.renderWeek;
  if (typeof baseRenderWeek === 'function' && !baseRenderWeek.__rchWrapped) {
    const wrapped = function(...args) {
      const result = baseRenderWeek.apply(this, args);
      scheduleDecorations();
      return result;
    };
    wrapped.__rchWrapped = true;
    window.renderWeek = wrapped;
  }

  const basePrintTimesheet = window.printTimesheet;
  if (typeof basePrintTimesheet === 'function' && !basePrintTimesheet.__rchWrapped) {
    const wrapped = function(sheet, technicianName) {
      const result = basePrintTimesheet.apply(this, arguments);
      requestAnimationFrame(() => decoratePrintComparison(sheet));
      return result;
    };
    wrapped.__rchWrapped = true;
    window.printTimesheet = wrapped;
  }

  document.getElementById('app')?.addEventListener('input', scheduleDecorations, true);
  document.getElementById('app')?.addEventListener('change', scheduleDecorations, true);
  const observer = new MutationObserver(scheduleDecorations);
  observer.observe(document.getElementById('app'), { childList:true, subtree:true });
})();