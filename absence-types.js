(() => {
  const ALLOWED_TYPES = new Set(['', 'absent', 'cp', 'arret']);

  function normalizedAbsenceType(day) {
    const raw = String(day?.absence_type || '').toLowerCase();
    if (ALLOWED_TYPES.has(raw) && raw) return raw;
    return day?.absent ? 'absent' : '';
  }

  function absenceLabel(day) {
    const type = normalizedAbsenceType(day);
    if (type === 'cp') return 'CP';
    if (type === 'arret') return 'ARRÊT';
    return 'ABSENT';
  }

  function syncDayFlags(day) {
    if (!day) return '';
    const type = normalizedAbsenceType(day);
    day.absence_type = type;
    day.absent = type !== '';
    return type;
  }

  function clearWorkedData(day) {
    if (!day?.absent) return;
    day.zone = 0;
    (day.entries || []).forEach(entry => { entry.hours = 0; });
  }

  function installStyle() {
    if (document.getElementById('ljsAbsenceTypesStyle')) return;
    const style = document.createElement('style');
    style.id = 'ljsAbsenceTypesStyle';
    style.textContent = `
      .absence-options{display:flex;flex-wrap:wrap;align-items:center;gap:10px 20px;margin:8px 0 12px}
      .absence-options .absence-line{display:flex;align-items:center;gap:7px;margin:0}
      .absence-options .absence-line label{margin:0;font-weight:600;cursor:pointer}
      .absence-options .absence-line input{width:20px;height:20px;margin:0;accent-color:#0668a9}
      .absence-options .absence-line input:disabled+label{cursor:default;opacity:.75}
    `;
    document.head.appendChild(style);
  }

  function installNormalizeWrapper() {
    const baseNormalizeSheet = window.normalizeSheet;
    if (typeof baseNormalizeSheet !== 'function' || baseNormalizeSheet.__ljsAbsenceTypes) return;

    const wrapped = function(source, weekStart) {
      const sourceDays = Array.isArray(source?.days)
        ? source.days.map(day => ({
            date: day?.date || '',
            absence_type: String(day?.absence_type || '').toLowerCase(),
            absent: Boolean(day?.absent)
          }))
        : [];

      const result = baseNormalizeSheet.apply(this, arguments);
      (result?.days || []).forEach((day, index) => {
        const sourceDay = sourceDays.find(item => item.date && item.date === day.date) || sourceDays[index];
        const raw = String(sourceDay?.absence_type || '').toLowerCase();
        const type = ALLOWED_TYPES.has(raw) && raw
          ? raw
          : (sourceDay?.absent || day.absent ? 'absent' : '');
        day.absence_type = type;
        day.absent = type !== '';
      });
      return result;
    };

    wrapped.__ljsAbsenceTypes = true;
    window.normalizeSheet = wrapped;
  }

  async function hydrateAbsenceTypes(sheet) {
    if (!sheet?.days) return sheet;

    if (!isCloud || !sheet.id) {
      sheet.days.forEach(day => syncDayFlags(day));
      return sheet;
    }

    const { data, error } = await sb
      .from('ljs_day_entries')
      .select('work_date,absence_type,absent')
      .eq('timesheet_id', sheet.id);

    if (error) {
      console.warn('Chargement des types d’absence impossible :', error);
      sheet.days.forEach(day => syncDayFlags(day));
      return sheet;
    }

    sheet.days.forEach(day => {
      const row = (data || []).find(item => item.work_date === day.date);
      const raw = String(row?.absence_type || '').toLowerCase();
      const type = ALLOWED_TYPES.has(raw) && raw ? raw : (row?.absent ? 'absent' : '');
      day.absence_type = type;
      day.absent = type !== '';
    });
    return sheet;
  }

  function installLoadWrappers() {
    const baseLoadSheet = window.loadSheet;
    if (typeof baseLoadSheet === 'function' && !baseLoadSheet.__ljsAbsenceTypes) {
      const wrappedLoadSheet = async function() {
        const result = await baseLoadSheet.apply(this, arguments);
        await hydrateAbsenceTypes(state?.sheet);
        return result;
      };
      wrappedLoadSheet.__ljsAbsenceTypes = true;
      window.loadSheet = wrappedLoadSheet;
    }

    const baseLoadAdminSheet = window.loadAdminSheet;
    if (typeof baseLoadAdminSheet === 'function' && !baseLoadAdminSheet.__ljsAbsenceTypes) {
      const wrappedLoadAdminSheet = async function() {
        const result = await baseLoadAdminSheet.apply(this, arguments);
        await hydrateAbsenceTypes(result || state?.adminSheet);
        return result;
      };
      wrappedLoadAdminSheet.__ljsAbsenceTypes = true;
      window.loadAdminSheet = wrappedLoadAdminSheet;
    }
  }

  function addChoice(container, className, labelText, checked, disabled) {
    const line = document.createElement('div');
    line.className = 'absence-line';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = className;
    input.checked = checked;
    input.disabled = disabled;
    const label = document.createElement('label');
    label.textContent = labelText;
    line.append(input, label);
    container.appendChild(line);
    return input;
  }

  function installTechnicianDayWrapper() {
    const baseRenderDay = window.renderDay;
    if (typeof baseRenderDay !== 'function' || baseRenderDay.__ljsAbsenceTypes) return;

    const wrapped = function(day, dayIndex, locked) {
      const type = syncDayFlags(day);
      const section = baseRenderDay.apply(this, arguments);
      const existingLine = section?.querySelector('.absence-line');
      const absentInput = existingLine?.querySelector('.absent-check');
      if (!existingLine || !absentInput) return section;

      installStyle();
      existingLine.querySelector('label').textContent = 'Absent';

      const choices = document.createElement('div');
      choices.className = 'absence-options';
      existingLine.parentNode.insertBefore(choices, existingLine);
      choices.appendChild(existingLine);

      const cpInput = addChoice(choices, 'cp-check', 'CP', type === 'cp', locked);
      const arretInput = addChoice(choices, 'arret-check', 'Arrêt', type === 'arret', locked);
      const baseAbsentHandler = absentInput.onchange;

      function refreshChecks(selectedType) {
        absentInput.checked = selectedType === 'absent';
        cpInput.checked = selectedType === 'cp';
        arretInput.checked = selectedType === 'arret';
      }

      function setType(selectedType) {
        const nextType = ALLOWED_TYPES.has(selectedType) ? selectedType : '';
        day.absence_type = nextType;
        day.absent = nextType !== '';
        if (day.absent) clearWorkedData(day);

        if (typeof baseAbsentHandler === 'function') {
          absentInput.checked = day.absent;
          baseAbsentHandler({ target: absentInput });
          day.absence_type = nextType;
          day.absent = nextType !== '';
        }
        refreshChecks(nextType);
      }

      absentInput.checked = type === 'absent';
      absentInput.onchange = event => setType(event.target.checked ? 'absent' : '');
      cpInput.onchange = event => setType(event.target.checked ? 'cp' : '');
      arretInput.onchange = event => setType(event.target.checked ? 'arret' : '');
      refreshChecks(type);
      return section;
    };

    wrapped.__ljsAbsenceTypes = true;
    window.renderDay = wrapped;
  }

  function installAdminDayWrapper() {
    const baseRenderAdminDay = window.renderAdminDay;
    if (typeof baseRenderAdminDay !== 'function' || baseRenderAdminDay.__ljsAbsenceTypes) return;

    const wrapped = function(day, dayIndex) {
      const type = syncDayFlags(day);
      const section = baseRenderAdminDay.apply(this, arguments);
      const existingLine = section?.querySelector('.absence-line');
      const absentInput = existingLine?.querySelector('.admin-absent');
      if (!existingLine || !absentInput) return section;

      installStyle();
      existingLine.querySelector('label').textContent = 'Absent';

      const choices = document.createElement('div');
      choices.className = 'absence-options';
      existingLine.parentNode.insertBefore(choices, existingLine);
      choices.appendChild(existingLine);

      const cpInput = addChoice(choices, 'admin-cp', 'CP', type === 'cp', absentInput.disabled);
      const arretInput = addChoice(choices, 'admin-arret', 'Arrêt', type === 'arret', absentInput.disabled);

      function setType(selectedType, source) {
        const nextType = ALLOWED_TYPES.has(selectedType) ? selectedType : '';
        day.absence_type = nextType;
        day.absent = nextType !== '';
        if (day.absent) clearWorkedData(day);
        if (typeof markAdminChange === 'function') {
          markAdminChange(`days.${dayIndex}.absence_type`, source || null);
          markAdminChange(`days.${dayIndex}.absent`, source || null);
        }
        if (typeof renderAdminEditor === 'function') renderAdminEditor();
      }

      absentInput.checked = type === 'absent';
      absentInput.onchange = event => setType(event.target.checked ? 'absent' : '', event.target);
      cpInput.onchange = event => setType(event.target.checked ? 'cp' : '', event.target);
      arretInput.onchange = event => setType(event.target.checked ? 'arret' : '', event.target);
      return section;
    };

    wrapped.__ljsAbsenceTypes = true;
    window.renderAdminDay = wrapped;
  }

  async function persistAbsenceTypes(sheet) {
    if (!sheet?.id || !sheet?.days) return;
    sheet.days.forEach(day => syncDayFlags(day));

    if (!isCloud) return;

    const p_items = sheet.days.map(day => ({
      work_date: day.date,
      absence_type: normalizedAbsenceType(day)
    }));
    const { error } = await sb.rpc('ljs_set_day_absence_types', {
      p_timesheet_id: sheet.id,
      p_items
    });
    if (error) throw error;
  }

  function rewriteRecap(message, sheet) {
    let text = String(message || '');
    if (!text.includes('RÉCAPITULATIF AVANT VALIDATION')) return text;

    (sheet?.days || []).slice(0, 5).forEach(day => {
      if (!day.absent) return;
      const label = String(day.name || '').replace(/^./, char => char.toUpperCase());
      if (!label) return;
      text = text.replace(`• ${label} : ABSENT`, `• ${label} : ${absenceLabel(day)}`);
    });
    return text;
  }

  function installSaveWrappers() {
    const baseSaveWeek = window.saveWeek;
    if (typeof baseSaveWeek === 'function' && !baseSaveWeek.__ljsAbsenceTypes) {
      const wrappedSaveWeek = async function(submit) {
        const sheet = state?.sheet;
        (sheet?.days || []).forEach(day => syncDayFlags(day));

        const originalConfirm = window.confirm;
        if (submit && sheet) {
          window.confirm = message => originalConfirm(rewriteRecap(message, sheet));
        }

        try {
          const result = await baseSaveWeek.apply(this, arguments);
          const message = document.getElementById('saveMsg')?.textContent || '';
          const saved = message === 'Enregistré.' || message === 'Semaine signée, validée et verrouillée.';
          if (sheet?.id && saved) {
            try {
              await persistAbsenceTypes(sheet);
            } catch (error) {
              console.error(error);
              const box = document.getElementById('saveMsg');
              if (box) box.textContent = 'Erreur : impossible d’enregistrer le type d’absence.';
              alert('Impossible d’enregistrer CP / Arrêt : ' + (error.message || error));
            }
          }
          return result;
        } finally {
          window.confirm = originalConfirm;
        }
      };
      wrappedSaveWeek.__ljsAbsenceTypes = true;
      window.saveWeek = wrappedSaveWeek;
    }

    const baseSaveAdminSheet = window.saveAdminSheet;
    if (typeof baseSaveAdminSheet === 'function' && !baseSaveAdminSheet.__ljsAbsenceTypes) {
      const wrappedSaveAdminSheet = async function() {
        const sheet = state?.adminSheet;
        (sheet?.days || []).forEach(day => syncDayFlags(day));
        const result = await baseSaveAdminSheet.apply(this, arguments);
        const message = document.getElementById('adminSaveMsg')?.textContent || '';
        const saved = message === 'Corrections enregistrées.' || message === 'Feuille validée par le responsable.';
        if (sheet?.id && saved) {
          try {
            await persistAbsenceTypes(sheet);
          } catch (error) {
            console.error(error);
            alert('Impossible d’enregistrer CP / Arrêt : ' + (error.message || error));
          }
        }
        return result;
      };
      wrappedSaveAdminSheet.__ljsAbsenceTypes = true;
      window.saveAdminSheet = wrappedSaveAdminSheet;
    }
  }

  function installPrintWrapper() {
    const basePrintTimesheet = window.printTimesheet;
    if (typeof basePrintTimesheet !== 'function' || basePrintTimesheet.__ljsAbsenceTypes) return;

    const wrapped = function(sheet) {
      const result = basePrintTimesheet.apply(this, arguments);
      const absentDays = (sheet?.days || []).filter(day => Boolean(day.absent));
      const labels = [...document.querySelectorAll('#printArea .p-absent')];
      labels.forEach((node, index) => {
        const day = absentDays[index];
        if (day) node.textContent = absenceLabel(day);
      });
      return result;
    };
    wrapped.__ljsAbsenceTypes = true;
    window.printTimesheet = wrapped;
  }

  window.ljsAbsenceLabel = absenceLabel;
  installStyle();
  installNormalizeWrapper();
  installLoadWrappers();
  installTechnicianDayWrapper();
  installAdminDayWrapper();
  installSaveWrappers();
  installPrintWrapper();
})();
