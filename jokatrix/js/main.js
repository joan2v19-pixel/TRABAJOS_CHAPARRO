/* ============================================================
   JOKATRIX — JavaScript principal
   1. Motas de polvo dorado en el hero (canvas)
   2. Animaciones de aparición al hacer scroll (IntersectionObserver)
   3. Contadores animados en las estadísticas
   4. Menú hamburguesa en móvil
   5. Botón "volver arriba"
   6. Filtro del catálogo por categoría
   ============================================================ */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Motas de polvo (luz entrando al taller de talabartería) ---------- */
(function dust() {
  const canvas = document.getElementById("dust");
  if (!canvas || reducedMotion) return;

  const ctx = canvas.getContext("2d");
  let width, height, motes = [];

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;
  }

  function makeMote() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.8 + Math.random() * 2.2,          // radio
      vy: -(0.08 + Math.random() * 0.3),     // suben despacio
      vx: (Math.random() - 0.5) * 0.25,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.2 + Math.random() * 0.55
    };
  }

  function step() {
    ctx.clearRect(0, 0, width, height);
    for (const m of motes) {
      m.phase += 0.015;
      m.x += m.vx + Math.sin(m.phase) * 0.15;
      m.y += m.vy;
      if (m.y < -6) { m.y = height + 6; m.x = Math.random() * width; }
      if (m.x < -6) m.x = width + 6;
      if (m.x > width + 6) m.x = -6;

      // Brillo suave: la mota "titila" con su fase
      ctx.globalAlpha = m.alpha * (0.6 + 0.4 * Math.sin(m.phase * 2));
      ctx.fillStyle = "#d98b2b";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(step);
  }

  resize();
  const count = Math.min(70, Math.max(24, Math.floor(width / 18)));
  motes = Array.from({ length: count }, makeMote);
  window.addEventListener("resize", resize);
  step();
})();

/* ---------- 2. Aparición al hacer scroll ---------- */
(function scrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
})();

/* ---------- 3. Contadores animados ---------- */
(function counters() {
  const nums = document.querySelectorAll(".stat-num[data-count]");
  if (!nums.length) return;

  function animate(el) {
    const target = parseInt(el.dataset.count, 10);
    if (reducedMotion) { el.textContent = target; return; }

    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );

  nums.forEach((el) => observer.observe(el));
})();

/* ---------- 4. Menú hamburguesa ---------- */
(function mobileMenu() {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
})();

/* ---------- 5. Botón "volver arriba" ---------- */
(function toTop() {
  const btn = document.getElementById("toTop");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 600);
  }, { passive: true });
})();

/* ---------- 6. Filtro del catálogo ---------- */
(function catalogFilter() {
  const bar = document.getElementById("filters");
  const cards = document.querySelectorAll("#cardsGrid .card");
  if (!bar || !cards.length) return;

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    const f = btn.dataset.filter;
    bar.querySelectorAll(".filter").forEach((b) => b.classList.toggle("is-active", b === btn));
    cards.forEach((c) => { c.hidden = !(f === "todos" || c.dataset.cat === f); });
  });
})();
