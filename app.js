/* Webadi: public homepage, portfolio access gate + interactions */
(() => {
  'use strict';

  const SESSION_KEY = 'webadi:code';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gate = document.getElementById('gate');
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-code');
  const msg = document.getElementById('gate-msg');
  const app = document.getElementById('app');
  const payload = JSON.parse(document.getElementById('payload').textContent);

  /* ---------- Decryption (AES-GCM, PBKDF2-SHA256) ---------- */
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function decrypt(code) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromB64(payload.salt), iterations: payload.it, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(payload.iv) }, key, fromB64(payload.ct));
    return new TextDecoder().decode(plain);
  }

  const publicEl = document.getElementById('public');
  let lastFocus = null;

  function openGate() {
    lastFocus = document.activeElement;
    gate.hidden = false;
    document.body.classList.add('is-locked');
    msg.textContent = '';
    form.classList.remove('is-error', 'is-busy');
    setTimeout(() => input.focus({ preventScroll: true }), reduceMotion ? 0 : 700);
  }

  function closeGate() {
    if (gate.classList.contains('is-opening')) return;
    gate.hidden = true;
    document.body.classList.remove('is-locked');
    input.value = '';
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  document.querySelectorAll('[data-open-gate]').forEach((el) => el.addEventListener('click', openGate));
  gate.querySelector('[data-close-gate]').addEventListener('click', closeGate);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !gate.hidden) closeGate(); });

  // Display fonts used only by client logos inside the portfolio.
  function loadPortfolioFonts() {
    if (document.getElementById('portfolio-fonts')) return;
    const l = document.createElement('link');
    l.id = 'portfolio-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Cormorant+Garamond:wght@500&display=swap';
    document.head.appendChild(l);
  }

  async function unlock(code, { instant = false } = {}) {
    const html = await decrypt(code); // throws on a wrong code
    try { sessionStorage.setItem(SESSION_KEY, code); } catch (_) {}

    const reveal = () => {
      loadPortfolioFonts();
      if (publicEl) publicEl.remove();
      app.innerHTML = html;
      app.hidden = false;
      document.body.classList.remove('is-locked');
      window.scrollTo(0, 0);
      start(app);
    };

    if (instant || reduceMotion) {
      gate.remove();
      reveal();
      return;
    }
    gate.classList.add('is-opening');
    setTimeout(reveal, 650);                 // swap content as the wipe passes
    setTimeout(() => gate.remove(), 1350);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) return;
    form.classList.add('is-busy');
    form.classList.remove('is-error');
    msg.textContent = '';
    try {
      await unlock(code);
    } catch (_) {
      form.classList.remove('is-busy');
      void form.offsetWidth; // restart shake animation
      form.classList.add('is-error');
      msg.textContent = 'That code isn’t right. Please try again.';
      input.select();
    }
  });

  // The public homepage runs first; a visitor who already unlocked in this
  // browser session goes straight back to the portfolio.
  const saved = (() => { try { return sessionStorage.getItem(SESSION_KEY); } catch (_) { return null; } })();
  if (saved) {
    unlock(saved, { instant: true }).catch(() => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
      start(publicEl);
    });
  } else {
    start(publicEl);
  }

  /* ---------- Interactions (public homepage and portfolio) ---------- */
  function start(root) {
    document.body.classList.add('is-ready');

    const year = root.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();

    root.querySelector('[data-lock]')?.addEventListener('click', () => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
      location.reload();
    });

    revealOnScroll(root);
    navBehaviour(root);
    if (!reduceMotion) {
      parallaxScreens(root);
      tiltCards(root);
      magnetic(root);
      cursor(root);
    }
  }

  function revealOnScroll(root) {
    const els = root.querySelectorAll('.reveal, .reveal-up');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  }

  function navBehaviour(root) {
    const nav = root.querySelector('#nav');
    const bar = root.querySelector('.progress span');
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      nav.classList.toggle('is-scrolled', y > 40);
      nav.classList.toggle('is-hidden', y > lastY && y > 500);
      lastY = y;
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
  }

  // Screenshot inside each browser frame drifts slightly as you scroll.
  function parallaxScreens(root) {
    const imgs = [...root.querySelectorAll('.browser__screen > img')];
    let ticking = false;
    const update = () => {
      imgs.forEach((img) => {
        const r = img.parentElement.getBoundingClientRect();
        const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1 around centre
        img.style.setProperty('--py', `${(-p * 6).toFixed(2)}%`);
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
  }

  function tiltCards(root) {
    if (matchMedia('(hover: none)').matches) return;
    root.querySelectorAll('.tilt').forEach((el) => {
      const card = el.querySelector('.browser');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
      });
      el.addEventListener('pointerleave', () => {
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });
  }

  function magnetic(root) {
    if (matchMedia('(hover: none)').matches) return;
    root.querySelectorAll('.magnetic').forEach((el) => {
      const strength = el.classList.contains('contact__ig') ? 0.06 : 0.3;
      el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1), background .3s, color .3s';
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  function cursor(root) {
    if (matchMedia('(hover: none), (pointer: coarse)').matches) return;
    const dot = root.querySelector('.cursor');
    if (!dot) return;
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerleave', () => dot.classList.remove('is-on'));
    root.querySelectorAll('a, button').forEach((el) => {
      el.addEventListener('pointerenter', () => dot.classList.add('is-big'));
      el.addEventListener('pointerleave', () => dot.classList.remove('is-big'));
    });
    const loop = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      dot.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    };
    loop();
  }
})();
