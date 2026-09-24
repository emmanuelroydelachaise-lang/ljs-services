(() => {
  const BYPASS_KEY = 'leaveDeleteMaskedPinBypass';
  let dialogOpen = false;

  function askMaskedResponsiblePin() {
    return new Promise(resolve => {
      document.getElementById('leaveDeletePinOverlay')?.remove();
      dialogOpen = true;

      const overlay = document.createElement('div');
      overlay.id = 'leaveDeletePinOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

      const dialog = document.createElement('div');
      dialog.style.cssText = 'width:min(420px,100%);background:#fff;border-radius:16px;padding:22px;box-shadow:0 22px 60px rgba(0,0,0,.28);font-family:inherit;';
      dialog.innerHTML = `
        <h3 style="margin:0 0 8px;font-size:20px">Code responsable</h3>
        <p style="margin:0 0 16px;color:#667085">Saisis ton code pour autoriser la suppression définitive de cette demande d’absence.</p>
        <input id="leaveDeletePinInput" type="password" inputmode="numeric" maxlength="4" autocomplete="off" pattern="[0-9]*" placeholder="••••" style="width:100%;font-size:24px;letter-spacing:10px;text-align:center;padding:12px;border:1px solid #d0d5dd;border-radius:10px;box-sizing:border-box" />
        <p id="leaveDeletePinError" style="min-height:20px;margin:8px 0 0;color:#b42318;font-size:14px"></p>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px">
          <button id="leaveDeletePinCancel" type="button" class="secondary">Annuler</button>
          <button id="leaveDeletePinConfirm" type="button" class="primary">Continuer</button>
        </div>`;
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = dialog.querySelector('#leaveDeletePinInput');
      const error = dialog.querySelector('#leaveDeletePinError');
      const cancel = dialog.querySelector('#leaveDeletePinCancel');
      const confirmButton = dialog.querySelector('#leaveDeletePinConfirm');
      let finished = false;

      const close = value => {
        if (finished) return;
        finished = true;
        dialogOpen = false;
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

  async function interceptLeaveDelete(event) {
    const button = event.target.closest?.('.admin-leave-archive-delete');
    if (!button) return;

    if (button.dataset[BYPASS_KEY] === '1') {
      delete button.dataset[BYPASS_KEY];
      return;
    }

    if (dialogOpen) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const pin = await askMaskedResponsiblePin();
    if (pin === null) return;

    if (typeof window.verifyResponsiblePinEntry !== 'function') {
      alert('La vérification du code responsable n’est pas disponible. Reconnecte-toi à l’accès responsable puis réessaie.');
      return;
    }

    const ok = await window.verifyResponsiblePinEntry(pin);
    if (!ok) {
      alert('Code responsable incorrect.');
      return;
    }

    // Le gestionnaire existant redemande le code avec prompt().
    // On lui fournit une seule fois le code déjà validé sans l’afficher à l’écran.
    const originalPrompt = window.prompt;
    window.prompt = () => pin;
    button.dataset[BYPASS_KEY] = '1';
    try {
      button.click();
    } finally {
      setTimeout(() => { window.prompt = originalPrompt; }, 0);
    }
  }

  document.addEventListener('click', interceptLeaveDelete, true);
})();
