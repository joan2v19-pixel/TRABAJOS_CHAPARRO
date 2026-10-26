/* ============================================================
   DEMO: SIMULADOR DE INVENTARIO
   Muestra cómo reacciona JOKATRIX: al vender baja la existencia,
   se genera una factura (consecutivo) y se activa una alerta
   cuando el stock llega al mínimo. Datos de ejemplo.
   ============================================================ */

(function inventoryDemo() {
  const board = document.getElementById("stockBoard");
  if (!board) return;

  const salesEl = document.getElementById("demoSales");
  const alertsEl = document.getElementById("demoAlerts");
  const lastEl = document.getElementById("demoLast");
  const alertBox = document.getElementById("demoAlert");

  /* ---------- Datos de ejemplo ---------- */
  const BASE = [
    { id: "montura",  nombre: "Montura de trabajo",     cat: "Monturas",      stock: 6,  min: 3, max: 10 },
    { id: "cinturon", nombre: "Cinturón de cuero",      cat: "Cuero",         stock: 9,  min: 4, max: 15 },
    { id: "cadena",   nombre: "Cadena de amarre",       cat: "Cadenas",       stock: 8,  min: 3, max: 12 },
    { id: "cuerda",   nombre: "Cuerda de nailon",       cat: "Cuerdas",       stock: 10, min: 4, max: 16 },
    { id: "sal",      nombre: "Sal mineralizada",       cat: "Agropecuarios", stock: 7,  min: 3, max: 12 }
  ];

  let items = [], sales = 0, alerts = 0, invoice = 0;

  const clone = () => BASE.map((o) => ({ ...o }));

  function state(it) {
    if (it.stock <= 0) return "empty";
    if (it.stock <= it.min) return "low";
    return "ok";
  }
  const LABEL = { ok: "Normal", low: "Stock bajo", empty: "Agotado" };

  /* ---------- Render ---------- */
  function render() {
    board.innerHTML = "";
    items.forEach((it) => {
      const s = state(it);
      const row = document.createElement("div");
      row.className = "stock-row " + (s === "ok" ? "" : s);
      const pct = Math.min(100, Math.round((it.stock / it.max) * 100));
      row.innerHTML =
        '<div class="stock-name">' + it.nombre + "<small>" + it.cat + "</small></div>" +
        '<div class="stock-meter"><span>' + it.stock + " uds · mínimo " + it.min + "</span>" +
        '<span class="stock-track"><span class="stock-fill" style="width:' + pct + '%"></span></span></div>' +
        '<span class="badge">' + LABEL[s] + "</span>" +
        '<div class="stock-actions">' +
        '<button class="mini-btn" type="button" data-act="sell" data-id="' + it.id + '"' + (it.stock <= 0 ? " disabled" : "") + ">Vender 1</button>" +
        '<button class="mini-btn ghost" type="button" data-act="restock" data-id="' + it.id + '">+5</button>' +
        "</div>";
      board.appendChild(row);
    });
  }

  function showAlert(msg) {
    alertBox.textContent = msg;
    alertBox.hidden = false;
  }

  function refreshAlertBanner() {
    const low = items.filter((i) => state(i) !== "ok");
    if (!low.length) { alertBox.hidden = true; return; }
    showAlert("⚠ Alerta de reabastecimiento: " + low.map((i) => i.nombre + " (" + i.stock + ")").join(", "));
  }

  /* ---------- Acciones ---------- */
  function sell(it) {
    if (it.stock <= 0) return;
    const before = state(it);
    it.stock--;
    sales++;
    invoice++;
    salesEl.textContent = sales;
    lastEl.textContent = "Factura FV-" + String(invoice).padStart(4, "0") + " · " + it.nombre;
    if (before === "ok" && state(it) !== "ok") { alerts++; alertsEl.textContent = alerts; }
    render();
    refreshAlertBanner();
  }

  function restock(it) {
    it.stock = Math.min(it.max, it.stock + 5);
    render();
    refreshAlertBanner();
  }

  board.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const it = items.find((i) => i.id === btn.dataset.id);
    if (!it) return;
    if (btn.dataset.act === "sell") sell(it); else restock(it);
  });

  function reset() {
    items = clone();
    sales = 0; alerts = 0; invoice = 0;
    salesEl.textContent = "0";
    alertsEl.textContent = "0";
    lastEl.textContent = "—";
    alertBox.hidden = true;
    render();
  }

  document.getElementById("demoReset").addEventListener("click", reset);
  reset();
})();
