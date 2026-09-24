(() => {
  const VERSION = '20260924-approved-edit-direct-1';
  const CLEAN_KEY = 'ljs_services_pwa_clean_version';
  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function createLogo(className, loginMode = false) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 320 260');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'LJS Energies');
    if (className) svg.setAttribute('class', className);
    if (loginMode) {
      svg.style.width = 'min(300px, 85%)';
      svg.style.maxHeight = '90px';
      svg.style.height = '90px';
      svg.style.display = 'block';
    }
    svg.innerHTML = `
      <defs>
        <linearGradient id="metal-${loginMode ? 'l' : 'h'}" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stop-color="#d9d9d9"/>
          <stop offset="0.35" stop-color="#8c8c8c"/>
          <stop offset="0.72" stop-color="#505050"/>
          <stop offset="1" stop-color="#242424"/>
        </linearGradient>
        <linearGradient id="green-${loginMode ? 'l' : 'h'}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#147d19"/>
          <stop offset="0.55" stop-color="#53a600"/>
          <stop offset="1" stop-color="#b6d800"/>
        </linearGradient>
        <linearGradient id="orange-${loginMode ? 'l' : 'h'}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#e74a00"/>
          <stop offset="0.55" stop-color="#ff7900"/>
          <stop offset="1" stop-color="#ffc400"/>
        </linearGradient>
        <linearGradient id="blue-${loginMode ? 'l' : 'h'}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#61d5ff"/>
          <stop offset="1" stop-color="#008ccc"/>
        </linearGradient>
      </defs>
      <path d="M250 52 A112 112 0 1 0 254 205" fill="none" stroke="url(#metal-${loginMode ? 'l' : 'h'})" stroke-width="34" stroke-linecap="round"/>
      <path d="M88 129 C118 157 151 153 184 124 C218 94 250 91 278 108 C247 105 224 115 197 139 C160 171 120 172 88 148 Z" fill="url(#green-${loginMode ? 'l' : 'h'})"/>
      <path d="M108 162 C137 184 169 184 202 155 C231 130 260 127 291 145 C263 142 240 151 215 173 C177 205 139 202 108 181 Z" fill="url(#orange-${loginMode ? 'l' : 'h'})"/>
      <path d="M104 76 C104 76 132 106 132 125 C132 143 119 156 103 156 C86 156 74 143 74 126 C74 106 104 76 104 76 Z" fill="url(#blue-${loginMode ? 'l' : 'h'})"/>
      <path d="M89 119 C87 131 92 140 102 144" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
    `;
    return svg;
  }

  function installInlineLogos() {
    const headerImg = document.querySelector('img.header-logo');
    if (headerImg) headerImg.replaceWith(createLogo('header-logo'));

    const loginTemplate = document.getElementById('loginTemplate');
    const loginImg = loginTemplate?.content?.querySelector('.login-brand img');
    if (loginImg) loginImg.replaceWith(createLogo('login-logo', true));

    const liveLoginImg = document.querySelector('.login-brand img');
    if (liveLoginImg) liveLoginImg.replaceWith(createLogo('login-logo', true));
  }

  function loadPrintLogoFix() {
    if (document.querySelector('script[data-print-logo-fix]')) return;
    const script = document.createElement('script');
    script.src = `./print-logo-fix.js?v=${VERSION}`;
    script.dataset.printLogoFix = '1';
    document.head.appendChild(script);
  }

  function loadPrintReliabilityFixes() {
    if (!document.querySelector('link[data-print-fit-fix]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `./print-fit.css?v=${VERSION}`;
      link.dataset.printFitFix = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-print-ready-fix]')) {
      const script = document.createElement('script');
      script.src = `./print-ready-fix.js?v=${VERSION}`;
      script.dataset.printReadyFix = '1';
      script.async = false;
      document.head.appendChild(script);
    }
  }

  function loadTechnicianFormFixes() {
    if (document.querySelector('script[data-technician-form-fixes]')) return;
    const script = document.createElement('script');
    script.src = `./technician-form-fixes.js?v=${VERSION}`;
    script.dataset.technicianFormFixes = '1';
    script.async = false;
    document.head.appendChild(script);
  }

  function loadAbsenceTypes() {
    if (document.querySelector('script[data-absence-types]')) return;
    const install = () => {
      if (document.querySelector('script[data-absence-types]')) return;
      const script = document.createElement('script');
      script.src = `./absence-types.js?v=${VERSION}`;
      script.dataset.absenceTypes = '1';
      script.async = false;
      document.head.appendChild(script);
    };

    if (window.saveWeek?.__ljsCompleteGuard) {
      install();
      return;
    }

    const technicianFixes = document.querySelector('script[data-technician-form-fixes]');
    if (technicianFixes) {
      technicianFixes.addEventListener('load', install, { once:true });
      technicianFixes.addEventListener('error', install, { once:true });
      setTimeout(() => {
        if (window.saveWeek?.__ljsCompleteGuard) install();
      }, 250);
      return;
    }
    install();
  }

  function loadAdminPinGuard() {
    if (document.querySelector('script[data-admin-pin-guard]')) return;
    const script = document.createElement('script');
    script.src = `./admin-pin-guard.js?v=${VERSION}`;
    script.dataset.adminPinGuard = '1';
    script.async = false;
    document.head.appendChild(script);
  }

  function loadTechnicianState() {
    if (document.querySelector('script[data-technician-state]')) return;
    const script = document.createElement('script');
    script.src = `./technician-state.js?v=${VERSION}`;
    script.dataset.technicianState = '1';
    script.async = false;
    document.head.appendChild(script);
  }

  function loadAdminVehicles() {
    if (document.querySelector('script[data-admin-vehicles]')) return;
    const script = document.createElement('script');
    script.src = `./admin-vehicles.js?v=${VERSION}`;
    script.dataset.adminVehicles = '1';
    script.async = false;
    document.head.appendChild(script);
  }

  function loadAdminArchiveAssets() {
    if (!document.querySelector('link[data-admin-archives]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `./admin-archives.css?v=${VERSION}`;
      link.dataset.adminArchives = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-admin-archives]')) {
      const script = document.createElement('script');
      script.src = `./admin-archives.js?v=${VERSION}`;
      script.dataset.adminArchives = '1';
      script.async = false;
      document.head.appendChild(script);
    }
  }

  function installButton() {
    return document.getElementById('installBtn');
  }

  function showInstallButton() {
    const btn = installButton();
    if (!btn || isStandalone()) return;
    btn.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Installer l’application';
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = installButton();
    if (btn) btn.classList.add('hidden');
  });

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const alreadyCleaned = localStorage.getItem(CLEAN_KEY) === VERSION;
      if (!alreadyCleaned) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter(registration => registration.scope.includes('/ljs-services/')).map(registration => registration.unregister()));
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.filter(name => name.startsWith('ljs-services-')).map(name => caches.delete(name)));
        }
        localStorage.setItem(CLEAN_KEY, VERSION);
      }
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${VERSION}`, {
        scope: './',
        updateViaCache: 'none'
      });
      await reg.update();
    } catch (error) {
      console.error('PWA registration error', error);
    }
  }

  async function requestInstall() {
    if (isStandalone()) return;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return;
    }
    await registerServiceWorker();
    alert('Dans Chrome, ouvre le menu ⋮ puis choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    installInlineLogos();
    loadPrintLogoFix();
    loadPrintReliabilityFixes();
    loadTechnicianFormFixes();
    loadAbsenceTypes();
    loadAdminPinGuard();
    loadTechnicianState();
    loadAdminVehicles();
    loadAdminArchiveAssets();

    let btn = installButton();
    if (btn) {
      const cleanBtn = btn.cloneNode(true);
      btn.replaceWith(cleanBtn);
      btn = cleanBtn;
      if (isStandalone()) btn.classList.add('hidden');
      else {
        showInstallButton();
        btn.addEventListener('click', requestInstall);
      }
    }

    await registerServiceWorker();
    installInlineLogos();
    loadPrintLogoFix();
    loadPrintReliabilityFixes();
    loadTechnicianFormFixes();
    loadAbsenceTypes();
    loadAdminPinGuard();
    loadTechnicianState();
    loadAdminVehicles();
    loadAdminArchiveAssets();
  });
})();
