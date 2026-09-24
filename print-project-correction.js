(() => {
  const VERSION = '20260916-project-print-fix-3';
  const baseGetPrintProjects = window.getPrintProjects;
  if (typeof baseGetPrintProjects !== 'function') return;

  const changed = (sheet, path) => Array.isArray(sheet?.admin_changes) && sheet.admin_changes.includes(path);

  function projectKey(entry) {
    if (!entry) return '';
    if (entry.project_id === OTHER_PROJECT_ID || !entry.project_id) {
      const code = String(entry.manual_project_code || '').trim().toLowerCase();
      const name = String(entry.manual_project_name || '').trim().toLowerCase();
      return `other:${code}|${name}`;
    }
    return `project:${entry.project_id}`;
  }

  function projectParts(entry) {
    if (!entry) return { code:'', name:'Chantier précédent' };
    if (entry.project_id === OTHER_PROJECT_ID || !entry.project_id) {
      return {
        code:String(entry.manual_project_code || '').trim(),
        name:String(entry.manual_project_name || '').trim() || 'Chantier autre'
      };
    }
    const p = projectById(entry.project_id);
    if (p) return { code:String(p.code || ''), name:String(p.name || '') };
    return { code:'', name:'Chantier précédent' };
  }

  function originalDay(sheet, di) {
    const days = sheet?.technician_original?.days;
    if (!Array.isArray(days)) return null;
    const currentDay = sheet?.days?.[di];
    return (currentDay?.date && days.find(d => d?.date === currentDay.date)) || days[di] || null;
  }

  function projectWasChanged(sheet, di, ei) {
    const prefix = `days.${di}.entries.${ei}`;
    return changed(sheet, `${prefix}.project_id`) ||
      changed(sheet, `${prefix}.manual_project_code`) ||
      changed(sheet, `${prefix}.manual_project_name`);
  }

  function changedProjectMap(sheet) {
    const result = new Map();
    (sheet?.days || []).forEach((newDay, di) => {
      const oldDay = originalDay(sheet, di);
      if (!oldDay) return;
      (newDay.entries || []).forEach((newEntry, ei) => {
        if (!projectWasChanged(sheet, di, ei)) return;
        const oldEntry = oldDay.entries?.[ei];
        if (!oldEntry) return;
        const newKey = projectKey(newEntry);
        const oldKey = projectKey(oldEntry);
        if (!newKey || oldKey === newKey) return;
        if (!result.has(newKey)) result.set(newKey, { oldEntry, newEntry });
      });
    });
    return result;
  }

  function enhancedProjects(sheet) {
    const normal = baseGetPrintProjects(sheet);
    if (!sheet?.technician_original) return normal;
    const changes = changedProjectMap(sheet);
    if (!changes.size) return normal;

    const out = [];
    normal.forEach(project => {
      const change = changes.get(project.key);
      if (change && out.length < 18) {
        const old = projectParts(change.oldEntry);
        out.push({
          id:`rch-old-${project.key}`,
          key:`rch-old-${project.key}`,
          code:old.code,
          name:old.name,
          manual:true,
          _rchCorrectionOld:true,
          _rchForKey:project.key
        });
      }
      if (out.length < 18) {
        out.push(change ? {...project, _rchCorrectionNew:true} : project);
      }
    });
    return out.slice(0,18);
  }

  window.getPrintProjects = enhancedProjects;

  function installStyle() {
    if (document.getElementById('printProjectCorrectionStyle')) return;
    const style = document.createElement('style');
    style.id = 'printProjectCorrectionStyle';
    style.textContent = `
      .p-project-code.rch-project-old,.p-project-name.rch-project-old{color:#666!important}
      .p-project-code.rch-project-old span,.p-project-name.rch-project-old span{color:#666!important;text-decoration:line-through!important;text-decoration-thickness:1.5px!important;font-weight:700!important}
      .p-project-code.rch-project-new,.p-project-name.rch-project-new{color:#d40000!important;font-weight:900!important}
      .p-project-code.rch-project-new span,.p-project-name.rch-project-new span{color:#d40000!important;font-weight:900!important}
      .ljs-pdf-stage .p-project-code.rch-project-old span,.ljs-pdf-stage .p-project-name.rch-project-old span{color:#666!important;text-decoration:line-through!important;text-decoration-thickness:1.5px!important;font-weight:700!important}
      .ljs-pdf-stage .p-project-code.rch-project-new span,.ljs-pdf-stage .p-project-name.rch-project-new span{color:#d40000!important;font-weight:900!important}
      .ljs-pdf-stage .rch-print-old-fix,.ljs-pdf-stage .rch-print-old{color:#555!important;text-decoration:line-through!important;text-decoration-thickness:1.5px!important;font-weight:700!important}
      .ljs-pdf-stage .rch-print-new-fix,.ljs-pdf-stage .rch-print-new{color:#d40000!important;font-weight:900!important}
      .ljs-pdf-stage .rch-print-pair{width:100%;height:100%;display:flex!important;gap:1mm;align-items:center;justify-content:center;flex-wrap:wrap;background:#fff;padding:.2mm;box-sizing:border-box;line-height:1}
      @media print{
        .p-project-code.rch-project-old span,.p-project-name.rch-project-old span{color:#666!important;text-decoration:line-through!important;text-decoration-thickness:.35mm!important;font-weight:700!important}
        .p-project-code.rch-project-new span,.p-project-name.rch-project-new span{color:#d40000!important;font-weight:900!important}
      }
    `;
    document.head.appendChild(style);
  }

  function removeProjectNotesFromComments(root) {
    const comments = root?.querySelector('.p-comments');
    if (!comments) return;
    comments.querySelectorAll('.rch-project-print-fix').forEach(el => el.remove());
    comments.querySelectorAll('.rch-print-note').forEach(el => {
      if (/^\s*Chantier\s*:/i.test(el.textContent || '')) el.remove();
    });
  }

  function decorateHeaders(sheet) {
    const root = document.querySelector('#printArea .exact-print-sheet');
    if (!root) return;
    removeProjectNotesFromComments(root);

    const projects = enhancedProjects(sheet);
    const codes = [...root.querySelectorAll('.p-project-code')];
    const names = [...root.querySelectorAll('.p-project-name')];
    projects.forEach((project, index) => {
      const targets = [codes[index], names[index]].filter(Boolean);
      if (project._rchCorrectionOld) targets.forEach(el => el.classList.add('rch-project-old'));
      if (project._rchCorrectionNew) targets.forEach(el => el.classList.add('rch-project-new'));
    });
  }

  function scheduleDecorate(sheet) {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => decorateHeaders(sheet))));
  }

  function wrapPrint() {
    const currentPrint = window.printTimesheet;
    if (typeof currentPrint !== 'function' || currentPrint.__ljsProjectPrintCorrectionV3) return;
    const wrapped = function(sheet, technicianName) {
      const result = currentPrint.apply(this, arguments);
      scheduleDecorate(sheet);
      return result;
    };
    wrapped.__ljsProjectPrintCorrectionV3 = true;
    window.printTimesheet = wrapped;
  }

  installStyle();
  wrapPrint();
  setTimeout(wrapPrint, 0);
  window.LJS_PROJECT_PRINT_CORRECTION = VERSION;
})();
