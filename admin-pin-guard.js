(() => {
  let adminPinHash = null;

  async function hashPin(pin) {
    const bytes = new TextEncoder().encode(String(pin || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  window.verifyResponsiblePinEntry = async function(pin) {
    if (!adminPinHash) return false;
    return (await hashPin(pin)) === adminPinHash;
  };

  const baseAdminLogin = window.adminLogin;
  if (typeof baseAdminLogin === 'function') {
    window.adminLogin = async function() {
      const pin = document.getElementById('adminPinInput')?.value?.trim() || '';
      await baseAdminLogin();
      if (currentProfile?.role === 'admin' && /^\d{4}$/.test(pin)) {
        adminPinHash = await hashPin(pin);
      }
    };
  }

  const baseLogout = window.logout;
  if (typeof baseLogout === 'function') {
    window.logout = async function() {
      adminPinHash = null;
      return baseLogout();
    };
  }
})();
