(() => {
  function weekdayLabel(day) {
    try {
      return new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (_) {
      return day.name || day.date || 'jour';
    }
  }

  function ensureSelectPlaceholders() {
    const cards = [...document.querySelectorAll('#days .day-card')];
    cards.forEach((card, dayIndex) => {
      const day = state?.sheet?.days?.[dayIndex];
      if (!day) return;

      const zone = card.querySelector('select.zone');
      const zoneZero = zone?.querySelector('option[value="0"]');
      if (zoneZero) zoneZero.textContent = 'Sélectionner zone';

      const rows = [...card.querySelectorAll('.work-row')];
      rows.forEach((row, entryIndex) => {
        const select = row.querySelector('select.project');
        const entry = day.entries?.[entryIndex];
        if (!select || !entry) return;
        if (!select.querySelector('option[value=""]')) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'Sélectionner chantier';
          select.insertBefore(option, select.firstChild);
        }
        select.value = entry.project_id || '';
      });
    });
  }

  function clearAutomaticProjectsForNewSheet() {
    const sheet = state?.sheet;
    if (!sheet || sheet.status !== 'draft' || sheet.id) return;
    (sheet.days || []).slice(0, 5).forEach(day => {
      (day.entries || []).forEach(entry => {
        if (Number(entry.hours || 0) <= 0 && !String(entry.manual_project_name || '').trim()) entry.project_id = '';
      });
    });
  }

  function installRenderWrapper() {
    const baseRenderWeek = window.renderWeek;
    if (typeof baseRenderWeek !== 'function' || baseRenderWeek.__ljsStablePlaceholders) return false;
    const wrapped = function(...args) {
      clearAutomaticProjectsForNewSheet();
      const result = baseRenderWeek.apply(this, args);
      ensureSelectPlaceholders();
      return result;
    };
    wrapped.__ljsStablePlaceholders = true;
    window.renderWeek = wrapped;
    return true;
  }

  function installRowHandlers() {
    if (document.documentElement.dataset.ljsStableRowHandlers === '1') return;
    document.documentElement.dataset.ljsStableRowHandlers = '1';

    document.addEventListener('click', event => {
      const add = event.target.closest?.('.add-row');
      if (add) {
        const card = add.closest('.day-card');
        const cards = [...document.querySelectorAll('#days .day-card')];
        const dayIndex = cards.indexOf(card);
        setTimeout(() => {
          const day = state?.sheet?.days?.[dayIndex];
          const entry = day?.entries?.[day.entries.length - 1];
          if (entry && Number(entry.hours || 0) <= 0) entry.project_id = '';
          ensureSelectPlaceholders();
        }, 0);
        return;
      }

      if (event.target.closest?.('.remove')) setTimeout(ensureSelectPlaceholders, 0);
    });

    document.addEventListener('change', event => {
      if (event.target.matches?.('select.project, select.zone')) setTimeout(ensureSelectPlaceholders, 0);
    });
  }

  function recapVehicleLabel(sheet) {
    if (!sheet?.vehicle_id) return 'Aucun véhicule';
    const vehicle = (state?.vehicles || []).find(v => v.id === sheet.vehicle_id);
    if (!vehicle) return 'Véhicule historique';
    const brand = String(vehicle.brand || '').trim();
    const registration = String(vehicle.registration || '').trim();
    return brand ? `${brand.toUpperCase()} — ${registration}` : (registration || 'Véhicule sélectionné');
  }

  function recapProjectLabel(entry) {
    if (entry.project_id === OTHER_PROJECT_ID) {
      const code = String(entry.manual_project_code || '').trim();
      const name = String(entry.manual_project_name || '').trim() || 'Chantier libre / Dépannage';
      return code ? `${code} — ${name}` : name;
    }
    const project = (state?.projects || []).find(p => p.id === entry.project_id);
    if (!project) return 'Chantier';
    const code = String(project.code || '').trim();
    const name = String(project.name || '').trim();
    return code && name ? `${code} — ${name}` : (name || code || 'Chantier');
  }

  function buildSubmissionRecap(sheet) {
    const days = (sheet.days || []).slice(0, 5);
    const projectTotals = new Map();

    days.forEach(day => {
      if (day.absent) return;
      (day.entries || []).forEach(entry => {
        const hours = Number(entry.hours || 0);
        if (hours <= 0 || !entry.project_id) return;
        const label = recapProjectLabel(entry);
        projectTotals.set(label, (projectTotals.get(label) || 0) + hours);
      });
    });

    const dayLines = days.map(day => {
      const label = String(day.name || weekdayLabel(day)).replace(/^./, c => c.toUpperCase());
      if (day.absent) return `• ${label} : ABSENT`;
      const hours = totalDay(day);
      if (hours <= 0) return `• ${label} : non travaillé`;
      return `• ${label} : ${fmtHours(hours)} — Zone ${Number(day.zone || 0)}`;
    });

    const projectLines = [...projectTotals.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
      .map(([label, hours]) => `• ${label} : ${fmtHours(hours)}`);

    const weekNo = typeof weekNumber === 'function' ? weekNumber(sheet.week_start) : '';
    const header = weekNo ? `Semaine ${weekNo}` : 'Semaine';

    return [
      'RÉCAPITULATIF AVANT VALIDATION',
      '',
      `${header} — ${currentProfile?.full_name || 'Technicien'}`,
      `TOTAL : ${fmtHours(totalWeek(sheet))}`,
      `Véhicule : ${recapVehicleLabel(sheet)}`,
      '',
      'JOURNÉES',
      ...dayLines,
      '',
      'CHANTIERS',
      ...(projectLines.length ? projectLines : ['• Aucun chantier']),
      '',
      'Après confirmation, la feuille sera envoyée au responsable et verrouillée.',
      '',
      'Confirmer la signature et la validation de la semaine ?'
    ].join('\n');
  }

  function installSubmissionGuard() {
    const baseSaveWeek = window.saveWeek;
    if (typeof baseSaveWeek !== 'function' || baseSaveWeek.__ljsCompleteGuard) return false;

    const wrapped = async function(submit) {
      if (submit && state?.sheet?.days) {
        const weekdays = state.sheet.days.slice(0, 5);
        const missingHours = weekdays.filter(day => !day.absent && totalDay(day) <= 0);
        const missingZones = weekdays.filter(day => !day.absent && totalDay(day) > 0 && !(Number(day.zone) >= 1 && Number(day.zone) <= 5));
        const missingProjects = weekdays.filter(day =>
          !day.absent && (day.entries || []).some(entry => Number(entry.hours || 0) > 0 && !entry.project_id)
        );
        const invalidOther = state.sheet.days.some(day =>
          !day.absent && (day.entries || []).some(entry => Number(entry.hours || 0) > 0 && entry.project_id === OTHER_PROJECT_ID && !String(entry.manual_project_name || '').trim())
        );

        if (missingHours.length || missingZones.length || missingProjects.length) {
          const lines = ['Feuille incomplète :'];
          if (missingHours.length) lines.push(`• Heures non renseignées : ${missingHours.map(weekdayLabel).join(', ')}.`);
          if (missingZones.length) lines.push(`• Zone trajet non renseignée : ${missingZones.map(weekdayLabel).join(', ')}.`);
          if (missingProjects.length) lines.push(`• Chantier non sélectionné : ${missingProjects.map(weekdayLabel).join(', ')}.`);
          lines.push('', 'Complète les éléments indiqués avant de valider. Le samedi est facultatif.');
          alert(lines.join('\n'));
          return;
        }

        if (invalidOther) {
          alert('Pour « Chantier libre / Dépannage », renseigne au minimum l’intitulé. Le N° chantier est facultatif.');
          return;
        }

        if (state.sheet.technician_signature) {
          const originalConfirm = window.confirm;
          if (!originalConfirm(buildSubmissionRecap(state.sheet))) return;

          let legacyConfirmPending = true;
          window.confirm = function(message) {
            const text = String(message || '');
            if (legacyConfirmPending && text.startsWith('Signer et valider définitivement cette semaine')) {
              legacyConfirmPending = false;
              return true;
            }
            return originalConfirm(message);
          };

          try {
            return await baseSaveWeek.apply(this, arguments);
          } finally {
            window.confirm = originalConfirm;
          }
        }
      }
      return baseSaveWeek.apply(this, arguments);
    };
    wrapped.__ljsCompleteGuard = true;
    window.saveWeek = wrapped;
    return true;
  }

  function printedVehicleLabel(sheet) {
    if (!sheet?.vehicle_id || typeof vehicleById !== 'function') return '';
    const vehicle = vehicleById(sheet.vehicle_id);
    if (!vehicle) return '';
    const brand = String(vehicle.brand || '').trim();
    const registration = String(vehicle.registration || '').trim();
    return brand ? `${brand.toUpperCase()} — ${registration}` : registration;
  }

  function fitPrintedName(field) {
    if (!field) return;
    const span = field.querySelector('span');
    if (!span) return;
    const text = String(span.textContent || '').trim();
    const length = text.length;
    const fontSize = length > 48 ? 3.8 : length > 40 ? 4.3 : length > 33 ? 4.9 : length > 27 ? 5.5 : length > 21 ? 6.3 : 7.5;
    field.classList.add('p-technician-name');
    field.style.fontSize = `${fontSize}pt`;
    field.style.whiteSpace = 'nowrap';
    span.style.whiteSpace = 'nowrap';
    span.style.display = 'block';
    span.style.maxWidth = '100%';
  }

  function installPrintFix() {
    const basePrintTimesheet = window.printTimesheet;
    if (typeof basePrintTimesheet !== 'function' || basePrintTimesheet.__ljsVehicleBrandFix) return false;
    const wrapped = function(sheet) {
      const result = basePrintTimesheet.apply(this, arguments);
      const area = document.getElementById('printArea') || window.printArea;
      const fields = area ? [...area.querySelectorAll('.exact-print-sheet .p-field')] : [];
      if (fields.length) fitPrintedName(fields[0]);
      if (fields.length > 1) {
        const label = printedVehicleLabel(sheet);
        const span = fields[1].querySelector('span');
        if (span) span.textContent = label;
        fields[1].style.fontSize = label.length > 30 ? '5pt' : label.length > 24 ? '5.8pt' : '7pt';
        fields[1].style.whiteSpace = 'nowrap';
      }
      return result;
    };
    wrapped.__ljsVehicleBrandFix = true;
    window.printTimesheet = wrapped;
    return true;
  }

  installRowHandlers();
  installRenderWrapper();
  installSubmissionGuard();
  installPrintFix();
})();
