(() => {
  const baseRenderWeek = window.renderWeek;
  if (typeof baseRenderWeek !== 'function') return;

  const visibleChange = path => path && path !== 'responsible_signature';
  const changed = (sheet, path) => (sheet?.admin_changes || []).includes(path);
  const changedPrefix = (sheet, prefix) => (sheet?.admin_changes || []).some(p => p === prefix || p.startsWith(prefix + '.'));

  function installHistoryPairStyle() {
    if (document.getElementById('techAdminHistoryPairStyle')) return;
    const style = document.createElement('style');
    style.id = 'techAdminHistoryPairStyle';
    style.textContent = `
      .rch-pair{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;background:#fff7f6!important;border:1px solid #e9b8b4!important}
      .rch-old{color:#5f6b75!important;text-decoration:line-through!important;text-decoration-thickness:2px!important;font-weight:700!important}
      .rch-new{color:#d00000!important;font-weight:900!important}
      .rch-label{font-size:.68rem!important;color:#6e7880!important}
      .rch-pair .rch-old::after{content:'  →';text-decoration:none!important;color:#8b949a!important;margin-left:4px}
      @media(max-width:640px){.rch-pair{gap:5px!important;font-size:.78rem!important}.rch-label{width:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function mark(el) {
    if (!el) return;
    el.classList.add('tech-admin-changed');
    const label = el.querySelector?.('label');
    if (label) label.classList.add('tech-admin-changed-label');
  }

  function addNotice(sheet) {
    document.getElementById('techAdminChangesNotice')?.remove();
    if (sheet?.status !== 'approved') return;
    if (!(sheet.admin_changes || []).some(visibleChange)) return;

    const badge = document.getElementById('statusBadge');
    const host = badge?.closest('.card') || document.getElementById('app');
    if (!host) return;

    const note = document.createElement('div');
    note.id = 'techAdminChangesNotice';
    note.className = 'tech-admin-change-notice';
    note.innerHTML = '<strong>Corrections du responsable</strong><span>La saisie d’origine du technicien est barrée et la correction du responsable apparaît en rouge à côté.</span>';
    if (badge?.parentElement) badge.parentElement.insertAdjacentElement('afterend', note);
    else host.prepend(note);
  }

  function decorateTechnicianCorrections() {
    const sheet = state?.sheet;
    if (!sheet || sheet.status !== 'approved') return;

    document.querySelectorAll('.tech-admin-changed').forEach(el => el.classList.remove('tech-admin-changed'));
    document.querySelectorAll('.tech-admin-changed-label').forEach(el => el.classList.remove('tech-admin-changed-label'));

    if (changed(sheet, 'vehicle_id')) mark(document.getElementById('vehicleSelect')?.closest('div'));
    if (changed(sheet, 'general_comment')) mark(document.getElementById('weekComment')?.closest('div'));

    const dayCards = [...document.querySelectorAll('#days .day-card')];
    dayCards.forEach((card, di) => {
      const dayPrefix = `days.${di}`;
      if (changed(sheet, `${dayPrefix}.absent`)) mark(card.querySelector('.absence-line'));
      if (changed(sheet, `${dayPrefix}.zone`)) mark(card.querySelector('.zone')?.closest('div'));

      const entries = [...card.querySelectorAll('.work-list .work-row')];
      entries.forEach((row, ei) => {
        const entryPrefix = `${dayPrefix}.entries.${ei}`;
        const wholeEntriesChanged = changed(sheet, `${dayPrefix}.entries`);

        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.project_id`)) {
          mark(row.querySelector('.project')?.closest('div'));
        }
        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.hours`)) {
          mark(row.querySelector('.hours')?.closest('div'));
        }
        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.manual_project_code`)) {
          mark(row.querySelector('.manual-code')?.closest('div'));
        }
        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.manual_project_name`)) {
          mark(row.querySelector('.manual-name')?.closest('div'));
        }
      });

      if (changedPrefix(sheet, `${dayPrefix}.entries`)) {
        const total = card.querySelector('.day-total');
        if (total) total.classList.add('tech-admin-changed');
      }
    });

    addNotice(sheet);
  }

  async function persistResponsibleOriginalSnapshot() {
    const sheet = state?.adminSheet;
    if (!sheet?.id || !sheet?.technician_original || currentProfile?.role !== 'admin' || !isCloud) return;
    try {
      const { data, error } = await sb
        .from('ljs_timesheets')
        .update({ technician_original: sheet.technician_original })
        .eq('id', sheet.id)
        .is('technician_original', null)
        .select('id');
      if (error) throw error;
      if (data?.length) console.info('Saisie technicien d’origine figée avant correction responsable.');
    } catch (error) {
      console.error('Impossible de figer la saisie technicien d’origine', error);
    }
  }

  const currentOpenAdminSheet = window.openAdminSheet;
  if (typeof currentOpenAdminSheet === 'function' && !currentOpenAdminSheet.__techOriginalPersistWrapped) {
    const wrappedOpenAdminSheet = async function(...args) {
      const result = await currentOpenAdminSheet.apply(this, args);
      await persistResponsibleOriginalSnapshot();
      return result;
    };
    wrappedOpenAdminSheet.__techOriginalPersistWrapped = true;
    window.openAdminSheet = wrappedOpenAdminSheet;
  }

  window.renderWeek = function() {
    const result = baseRenderWeek.apply(this, arguments);
    requestAnimationFrame(() => requestAnimationFrame(decorateTechnicianCorrections));
    return result;
  };

  installHistoryPairStyle();
  if (state?.sheet) requestAnimationFrame(() => requestAnimationFrame(decorateTechnicianCorrections));
})();
