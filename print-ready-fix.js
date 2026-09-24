(() => {
  const nativePrint = window.print.bind(window);
  let printInProgress = false;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  const withTimeout = (promise, ms) => Promise.race([promise, wait(ms)]);

  async function preloadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      const finish = async () => {
        try { if (img.decode) await img.decode(); } catch (_) {}
        resolve();
      };
      img.onload = finish;
      img.onerror = finish;
      img.src = src;
      if (img.complete) finish();
    });
  }

  async function waitForPrintAreaImages(area) {
    const images = [...area.querySelectorAll('img')];
    await Promise.all(images.map(img => new Promise(resolve => {
      let done = false;
      const finish = async () => {
        if (done) return;
        done = true;
        try { if (img.decode) await withTimeout(img.decode(), 2500); } catch (_) {}
        resolve();
      };
      if (img.complete && img.naturalWidth > 0) {
        finish();
        return;
      }
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
      setTimeout(finish, 5000);
    })));
  }

  async function settleFrames(count = 4) {
    for (let i = 0; i < count; i++) await nextFrame();
  }

  async function preparePrint() {
    const area = document.getElementById('printArea');
    const sheet = area?.querySelector('.exact-print-sheet');
    if (!area || !sheet) return;

    await preloadImage('./print-template.svg?v=20260916-print-2');
    await waitForPrintAreaImages(area);

    try {
      if (document.fonts?.ready) await withTimeout(document.fonts.ready, 3000);
    } catch (_) {}

    const previousStyle = area.getAttribute('style');
    area.style.setProperty('display', 'block', 'important');
    area.style.setProperty('position', 'fixed', 'important');
    area.style.setProperty('left', '-400vw', 'important');
    area.style.setProperty('top', '0', 'important');
    area.style.setProperty('visibility', 'hidden', 'important');
    area.style.setProperty('width', '289mm', 'important');
    area.style.setProperty('height', '202mm', 'important');

    sheet.style.setProperty('width', '285.12mm');
    sheet.style.setProperty('height', '201.6mm');

    void area.offsetWidth;
    void area.offsetHeight;
    void sheet.offsetWidth;
    void sheet.offsetHeight;

    await settleFrames(5);
    await wait(500);
    await waitForPrintAreaImages(area);

    if (previousStyle === null) area.removeAttribute('style');
    else area.setAttribute('style', previousStyle);

    await settleFrames(5);
    await wait(450);
  }

  window.print = function() {
    if (printInProgress) return;
    printInProgress = true;

    preparePrint()
      .catch(error => console.warn('Préparation impression :', error))
      .finally(async () => {
        await settleFrames(2);
        await wait(150);
        try {
          nativePrint();
        } finally {
          printInProgress = false;
        }
      });
  };
})();
