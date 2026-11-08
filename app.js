/* Webadi portfolio: access gate + interactions */
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

  async function unlock(code, { instant = false } = {}) {
    const html = await decrypt(code); // throws on a wrong code
    try { sessionStorage.setItem(SESSION_KEY, code); } catch (_) {}
    app.innerHTML = html;
    app.hidden = false;
    document.body.classList.remove('is-locked');

    if (instant || reduceMotion) {
      gate.remove();
      start();
      return;
    }
    gate.classList.add('is-opening');
    setTimeout(start, 650);                 // reveal content as the wipe passes
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

  // Stay unlocked for the rest of this browser session.
  const saved = (() => { try { return sessionStorage.getItem(SESSION_KEY); } catch (_) { return null; } })();
  if (saved) {
    unlock(saved, { instant: true }).catch(() => { try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {} input.focus(); });
  } else {
    setTimeout(() => input.focus({ preventScroll: true }), 900);
  }

  /* ---------- Portfolio interactions ---------- */
  function start() {
    document.body.classList.add('is-ready');
    window.scrollTo(0, 0);

    const year = app.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();

    app.querySelector('[data-lock]')?.addEventListener('click', () => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
      location.reload();
    });

    revealOnScroll();
    navBehaviour();
    if (!reduceMotion) {
      parallaxScreens();
      tiltCards();
      magnetic();
      cursor();
    }
  }

  function revealOnScroll() {
    const els = app.querySelectorAll('.reveal, .reveal-up');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  }

  function navBehaviour() {
    const nav = app.querySelector('#nav');
    const bar = app.querySelector('.progress span');
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
  function parallaxScreens() {
    const imgs = [...app.querySelectorAll('.browser__screen > img')];
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

  function tiltCards() {
    if (matchMedia('(hover: none)').matches) return;
    app.querySelectorAll('.tilt').forEach((el) => {
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

  function magnetic() {
    if (matchMedia('(hover: none)').matches) return;
    app.querySelectorAll('.magnetic').forEach((el) => {
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

  function cursor() {
    if (matchMedia('(hover: none), (pointer: coarse)').matches) return;
    const dot = app.querySelector('.cursor');
    if (!dot) return;
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerleave', () => dot.classList.remove('is-on'));
    app.querySelectorAll('a, button').forEach((el) => {
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
