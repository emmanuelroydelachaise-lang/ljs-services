(() => {
  let adminInstallTimer = null;

  function setBusy(button, busy) {
    if (!button) return;
    if (busy) {
      button.dataset.previousText = button.textContent;
      button.disabled = true;
      button.textContent = 'Création PDF…';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.previousText || 'PDF';
    }
  }

  async function loadFinalArchiveSheet(sheetId, technicianName, weekStart='') {
    if (typeof window.loadAdminSheet === 'function' && sheetId) {
      return await window.loadAdminSheet(sheetId, technicianName);
    }
    if (weekStart && typeof window.loadSheet === 'function') {
      await window.loadSheet(weekStart);
      return deepClone(state.sheet);
    }
    throw new Error('Impossible de charger la feuille archivée.');
  }

  async function technicianPdf(summary, button) {
    const previousSheet = state.sheet ? deepClone(state.sheet) : null;
    setBusy(button, true);
    try {
      const fullSheet = await loadFinalArchiveSheet(summary.id, currentProfile.full_name, summary.week_start);
      await window.downloadTimesheetPdf(fullSheet, currentProfile.full_name, true);
    } catch (error) {
      alert('Impossible de créer le PDF : ' + (error.message || error));
    } finally {
      if (previousSheet) state.sheet = previousSheet;
      setBusy(button, false);
    }
  }

  async function installTechnicianArchivePdfButtons() {
    if (typeof window.getTechnicianApprovedSheets !== 'function') return;
    const rows = [...document.querySelectorAll('#technicianArchivesList .tech-archive-item')];
    if (!rows.length) return;

    let sheets = [];
    try { sheets = await window.getTechnicianApprovedSheets(); }
    catch (_) { return; }

    rows.forEach((row, index) => {
      const summary = sheets[index];
      if (!summary) return;

      row.querySelectorAll('button').forEach(button => {
        if (!button.classList.contains('tech-archive-pdf')) button.remove();
      });

      let button = row.querySelector('.tech-archive-pdf');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary tech-archive-pdf';
        row.appendChild(button);
      }
      button.textContent = 'PDF';
      button.title = 'Télécharger exactement la même feuille PDF que dans les archives Responsable';
      button.onclick = () => technicianPdf(summary, button);
    });
  }

  async function getAdminArchiveSheetsForPdf() {
    if (!isCloud) {
      const db = demoDb();
      return (db.sheets || []).filter(s => s.status === 'approved').map(s => {
        const t = (db.technicians || []).find(x => x.id === s.technician_id);
        return { ...s, technician_name:t?.full_name || s.technician_id || 'Technicien' };
      });
    }
    const { data, error } = await sb.from('ljs_timesheets_admin').select('*').eq('status', 'approved');
    if (error) throw error;
    return data || [];
  }

  async function adminPdf(sheet, technicianName, button) {
    setBusy(button, true);
    try {
      const full = await loadFinalArchiveSheet(sheet.id, technicianName, sheet.week_start);
      await window.downloadTimesheetPdf(full, technicianName);
    } catch (error) {
      alert('Impossible de créer le PDF : ' + (error.message || error));
    } finally {
      setBusy(button, false);
    }
  }

  function askResponsiblePinMasked() {
    return new Promise(resolve => {
      document.getElementById('archiveDeletePinOverlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'archiveDeletePinOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

      const dialog = document.createElement('div');
      dialog.style.cssText = 'width:min(420px,100%);background:#fff;border-radius:16px;padding:22px;box-shadow:0 22px 60px rgba(0,0,0,.28);font-family:inherit;';
      dialog.innerHTML = `
        <h3 style="margin:0 0 8px;font-size:20px">Code responsable</h3>
        <p style="margin:0 0 16px;color:#667085">Saisis ton code pour autoriser la suppression définitive de cette feuille.</p>
        <input id="archiveDeletePinInput" type="password" inputmode="numeric" maxlength="4" autocomplete="off" pattern="[0-9]*" placeholder="••••" style="width:100%;font-size:24px;letter-spacing:10px;text-align:center;padding:12px;border:1px solid #d0d5dd;border-radius:10px;box-sizing:border-box" />
        <p id="archiveDeletePinError" style="min-height:20px;margin:8px 0 0;color:#b42318;font-size:14px"></p>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px">
          <button id="archiveDeletePinCancel" type="button" class="secondary">Annuler</button>
          <button id="archiveDeletePinConfirm" type="button" class="primary">Continuer</button>
        </div>`;
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = dialog.querySelector('#archiveDeletePinInput');
      const error = dialog.querySelector('#archiveDeletePinError');
      const cancel = dialog.querySelector('#archiveDeletePinCancel');
      const confirmButton = dialog.querySelector('#archiveDeletePinConfirm');
      let finished = false;

      const close = value => {
        if (finished) return;
        finished = true;
        document.removeEventListener('keydown', onKeyDown, true);
        overlay.remove();
        resolve(value);
      };

      const submit = () => {
        const pin = String(input.value || '').trim();
        if (!/^\d{4}$/.test(pin)) {
          error.textContent = 'Le code responsable doit contenir 4 chiffres.';
          input.focus();
          input.select();
          return;
        }
        close(pin);
      };

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(null);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      };

      cancel.onclick = () => close(null);
      confirmButton.onclick = submit;
      overlay.addEventListener('click', event => { if (event.target === overlay) close(null); });
      document.addEventListener('keydown', onKeyDown, true);
      setTimeout(() => input.focus(), 0);
    });
  }

  async function verifyResponsiblePinForArchiveDelete() {
    const pin = await askResponsiblePinMasked();
    if (pin === null) return false;
    if (typeof window.verifyResponsiblePinEntry !== 'function') {
      alert('La vérification du code responsable n’est pas disponible. Reconnecte-toi à l’accès responsable puis réessaie.');
      return false;
    }
    const ok = await window.verifyResponsiblePinEntry(pin);
    if (!ok) alert('Code responsable incorrect.');
    return ok;
  }

  async function deleteAdminArchiveSheet(sheet, technicianName, button) {
    if (!(await verifyResponsiblePinForArchiveDelete())) return;
    const label = `Semaine ${weekNumber(sheet.week_start)} — ${technicianName}`;
    if (!confirm(`Supprimer définitivement la feuille ${label} ?\n\nCette action est irréversible.`)) return;

    button.disabled = true;
    button.textContent = 'Suppression…';
    try {
      if (!isCloud) {
        const db = demoDb();
        const idx = (db.sheets || []).findIndex(x => x.id === sheet.id);
        if (idx < 0) throw new Error('Feuille introuvable.');
        db.sheets.splice(idx, 1);
        saveDemoDb(db);
      } else {
        const workDelete = await sb.from('ljs_work_entries').delete().eq('timesheet_id', sheet.id);
        if (workDelete.error) throw workDelete.error;
        const dayDelete = await sb.from('ljs_day_entries').delete().eq('timesheet_id', sheet.id);
        if (dayDelete.error) throw dayDelete.error;
        const sheetDelete = await sb.from('ljs_timesheets').delete().eq('id', sheet.id);
        if (sheetDelete.error) throw sheetDelete.error;
      }

      if (state.adminSheet?.id === sheet.id) {
        state.adminSheet = null;
        document.getElementById('adminEditor')?.classList.add('hidden');
      }

      await refreshAdmin();
      alert(`La feuille ${label} a été supprimée.`);
    } catch (error) {
      console.error(error);
      alert('Impossible de supprimer cette feuille : ' + (error.message || error));
      button.disabled = false;
      button.textContent = 'Supprimer';
    }
  }

  async function installAdminArchivePdfButtons() {
    const groups = [...document.querySelectorAll('#adminArchives .archive-tech-group')];
    if (!groups.length) return;

    let sheets = [];
    try { sheets = await getAdminArchiveSheetsForPdf(); }
    catch (_) { return; }

    sheets.sort((a, b) => {
      const na = String(a.technician_name || '').localeCompare(String(b.technician_name || ''), 'fr');
      if (na !== 0) return na;
      return String(b.week_start || '').localeCompare(String(a.week_start || ''));
    });

    const byName = new Map();
    sheets.forEach(sheet => {
      const name = sheet.technician_name || 'Technicien';
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(sheet);
    });

    groups.forEach(group => {
      const name = group.querySelector('.archive-tech-toggle strong')?.textContent?.trim() || 'Technicien';
      const groupSheets = byName.get(name) || [];
      const rows = [...group.querySelectorAll('.archive-sheet-row')];
      rows.forEach((row, index) => {
        const sheet = groupSheets[index];
        if (!sheet) return;

        const actions = row.querySelector('.admin-row-actions');
        if (!actions) return;
        actions.innerHTML = '';

        const pdfButton = document.createElement('button');
        pdfButton.type = 'button';
        pdfButton.className = 'secondary archive-pdf-only';
        pdfButton.textContent = 'PDF';
        pdfButton.title = 'Télécharger la feuille au format PDF';
        pdfButton.onclick = () => adminPdf(sheet, name, pdfButton);
        actions.appendChild(pdfButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'secondary archive-delete-only';
        deleteButton.textContent = 'Supprimer';
        deleteButton.title = 'Supprimer définitivement cette feuille';
        deleteButton.style.borderColor = '#d92d20';
        deleteButton.style.color = '#b42318';
        deleteButton.style.background = '#fff4f2';
        deleteButton.onclick = () => deleteAdminArchiveSheet(sheet, name, deleteButton);
        actions.appendChild(deleteButton);
      });
    });
  }

  function scheduleAdminInstall() {
    clearTimeout(adminInstallTimer);
    adminInstallTimer = setTimeout(() => installAdminArchivePdfButtons(), 80);
  }

  function installObservers() {
    const app = document.getElementById('app');
    if (!app) return;
    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (
        node.matches?.('#technicianArchivesList, #adminArchives, .tech-archive-item, .archive-tech-group, .archive-sheet-row') ||
        node.querySelector?.('#technicianArchivesList, #adminArchives, .tech-archive-item, .archive-tech-group, .archive-sheet-row')
      )));
      if (!relevant) return;
      setTimeout(() => installTechnicianArchivePdfButtons(), 50);
      scheduleAdminInstall();
    });
    observer.observe(app, { childList:true, subtree:true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    installObservers();
    setTimeout(() => installTechnicianArchivePdfButtons(), 300);
    scheduleAdminInstall();
  });
})();