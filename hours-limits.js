(() => {
  const MAX_DAY_HOURS = 10;
  const MAX_WEEK_HOURS = 48;
  const EPSILON = 0.001;

  function dayTotal(day) {
    if (!day || day.absent) return 0;
    if (typeof totalDay === 'function') return Number(totalDay(day) || 0);
    return (day.entries || []).reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  }

  function weekTotal(sheet) {
    return (sheet?.days || []).reduce((sum, day) => sum + dayTotal(day), 0);
  }

  function dayLabel(day) {
    if (!day) return 'Journée';
    try {
      return new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    } catch (_) {
      return day.name || day.date || 'Journée';
    }
  }

  function formatNumber(value) {
    return String(Number(Number(value || 0).toFixed(2)));
  }

  function limitsMessage(sheet) {
    const overDays = (sheet?.days || []).filter(day => dayTotal(day) > MAX_DAY_HOURS + EPSILON);
    const total = weekTotal(sheet);
    if (!overDays.length && total <= MAX_WEEK_HOURS + EPSILON) return '';

    const lines = ['Plafond d’heures dépassé :'];
    overDays.forEach(day => {
      lines.push(`• ${dayLabel(day)} : ${formatNumber(dayTotal(day))} h (maximum ${MAX_DAY_HOURS} h).`);
    });
    if (total > MAX_WEEK_HOURS + EPSILON) {
      lines.push(`• Semaine : ${formatNumber(total)} h (maximum ${MAX_WEEK_HOURS} h).`);
    }
    lines.push('', 'Réduis les heures avant d’enregistrer ou de valider la feuille.');
    return lines.join('\n');
  }

  function clampChangedHour(input) {
    const sheet = state?.sheet;
    if (!sheet?.days || !input) return;

    const card = input.closest('.day-card');
    const cards = [...document.querySelectorAll('#days .day-card')];
    const dayIndex = cards.indexOf(card);
    if (dayIndex < 0) return;

    const day = sheet.days[dayIndex];
    if (!day || day.absent) return;

    const row = input.closest('.work-row');
    const rows = [...card.querySelectorAll('.work-row')];
    const entryIndex = rows.indexOf(row);
    const entry = day.entries?.[entryIndex];
    if (!entry) return;

    const current = Math.max(0, Number(entry.hours || 0));
    const otherDayHours = (day.entries || []).reduce((sum, item, index) => {
      if (index === entryIndex) return sum;
      return sum + Math.max(0, Number(item.hours || 0));
    }, 0);

    const otherWeekHours = (sheet.days || []).reduce((sum, item, index) => {
      if (index === dayIndex) return sum;
      return sum + dayTotal(item);
    }, 0);

    const remainingDay = Math.max(0, MAX_DAY_HOURS - otherDayHours);
    const remainingWeek = Math.max(0, MAX_WEEK_HOURS - otherWeekHours - otherDayHours);
    const allowed = Math.max(0, Math.min(remainingDay, remainingWeek));

    if (current <= allowed + EPSILON) return;

    const clamped = Number(allowed.toFixed(2));
    entry.hours = clamped;
    input.value = clamped > 0 ? formatNumber(clamped) : '';
    if (typeof updateTotals === 'function') updateTotals();

    const reason = remainingDay <= remainingWeek + EPSILON
      ? `Maximum ${MAX_DAY_HOURS} h par jour.`
      : `Maximum ${MAX_WEEK_HOURS} h par semaine.`;
    alert(`${reason}\n\nLa saisie a été ramenée automatiquement à ${formatNumber(clamped)} h pour cette ligne.`);
  }

  function installInputGuard() {
    if (document.documentElement.dataset.ljsHoursLimits === '1') return;
    document.documentElement.dataset.ljsHoursLimits = '1';

    document.addEventListener('change', event => {
      if (event.target?.matches?.('#days input.hours')) clampChangedHour(event.target);
    });
  }

  function installSaveGuard(attempt = 0) {
    const baseSaveWeek = window.saveWeek;
    if (typeof baseSaveWeek !== 'function') {
      if (attempt < 80) setTimeout(() => installSaveGuard(attempt + 1), 50);
      return;
    }

    if (!baseSaveWeek.__ljsAbsenceTypes && attempt < 80) {
      setTimeout(() => installSaveGuard(attempt + 1), 50);
      return;
    }

    if (baseSaveWeek.__ljsHoursLimits) return;

    const wrapped = async function() {
      const message = limitsMessage(state?.sheet);
      if (message) {
        alert(message);
        return;
      }
      return baseSaveWeek.apply(this, arguments);
    };
    wrapped.__ljsHoursLimits = true;
    window.saveWeek = wrapped;
  }

  window.LJS_HOURS_LIMITS = Object.freeze({ day:MAX_DAY_HOURS, week:MAX_WEEK_HOURS });
  installInputGuard();
  installSaveGuard();
})();
