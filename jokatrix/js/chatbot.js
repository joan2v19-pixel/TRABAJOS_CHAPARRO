/* ============================================================
   CHATBOT "ASISTENTE JOKATRIX"
   Bot basado en reglas (sin servidor): detecta palabras clave
   y responde sobre La Casa de los Aperos, los módulos del
   sistema, el catálogo y la tienda en línea. Incluye chips de
   sugerencias y efecto de "escribiendo…".
   ============================================================ */

(function chatbot() {
  const fab = document.getElementById("chatFab");
  const win = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("chatClose");
  const messages = document.getElementById("chatMessages");
  const chipsBox = document.getElementById("chatChips");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  if (!fab || !win) return;

  /* ---------- Base de conocimiento ---------- */
  /* Cada regla: palabras clave (minúscula, sin tildes) + respuesta.
     Se evalúan en orden; gana la primera que coincida. */
  const KB = [
    {
      keys: ["jokatrix", "que es", "sistema", "plataforma"],
      reply:
        "🧰 <strong>JOKATRIX</strong> es un sistema integrado para mejorar la gestión administrativa y comercial " +
        "de La Casa de los Aperos: inventario en tiempo real, alertas de existencias, ventas y facturación, " +
        "proveedores, estadísticas y una tienda en línea para los clientes. " +
        'Mira los <a href="#modulos">módulos</a>.'
    },
    {
      keys: ["empresa", "casa de los aperos", "quienes son", "negocio", "talabarteria"],
      reply:
        "🏠 <strong>La Casa de los Aperos</strong> está en el centro de Bucaramanga (carrera 16 con calle 33) y " +
        "comercializa talabartería y artículos agropecuarios: cuero, monturas, cadenas, cuerdas, productos " +
        'agropecuarios, pólvora y más. Más en <a href="#empresa">La empresa</a>.'
    },
    {
      keys: ["inventario", "existencias", "stock", "alerta"],
      reply:
        "📦 El módulo de <strong>inventario</strong> actualiza las existencias en tiempo real y genera " +
        "<strong>alertas</strong> cuando un producto baja de su nivel mínimo. Pruébalo en el " +
        '<a href="#demo">simulador</a>.'
    },
    {
      keys: ["venta", "factura", "facturacion", "vender"],
      reply:
        "🧾 Con el módulo de <strong>ventas y facturación</strong> se registra cada venta y se genera la factura " +
        "desde un solo lugar, reduciendo errores y demoras frente al registro manual."
    },
    {
      keys: ["proveedor", "proveedores", "compras", "reabastecer"],
      reply:
        "🚚 JOKATRIX organiza la <strong>información de los proveedores</strong> para tener sus datos y " +
        "productos a la mano y reabastecer a tiempo."
    },
    {
      keys: ["estadistica", "reporte", "informe", "desempeno", "decision"],
      reply:
        "📊 Las <strong>estadísticas</strong> permiten analizar el desempeño de la empresa y apoyar la toma de " +
        'decisiones: qué se vende más, qué falta, cómo evoluciona el negocio. Hay una vista de ejemplo en <a href="#modulos">Módulos</a>.'
    },
    {
      keys: ["tienda", "comprar", "domicilio", "online", "linea", "pagina web", "web", "pedido"],
      reply:
        "🛒 La <strong>tienda en línea</strong> permitirá a los clientes consultar productos, ver características y " +
        "precios, y comprar para recibir el pedido a domicilio. Así se amplía el alcance más allá del WhatsApp. " +
        'Mira el <a href="#catalogo">catálogo</a>.'
    },
    {
      keys: ["whatsapp", "chat", "contacto"],
      reply:
        "💬 Hoy la atención se hace sobre todo por WhatsApp. JOKATRIX no lo reemplaza: suma un canal propio y " +
        "organizado, con catálogo y pedidos centralizados."
    },
    {
      keys: ["productos", "catalogo", "cuero", "montura", "cadena", "cuerda", "agropecuario", "polvora"],
      reply:
        "🐎 Las líneas de la tienda son: <strong>artículos de cuero</strong>, <strong>monturas</strong>, " +
        "<strong>cadenas</strong>, <strong>cuerdas</strong>, <strong>productos agropecuarios</strong> y " +
        '<strong>pólvora</strong>. Fíltralas en el <a href="#catalogo">catálogo</a>.'
    },
    {
      keys: ["donde", "ubicacion", "direccion", "bucaramanga", "visitar", "queda"],
      reply:
        "📍 Estamos en el centro de <strong>Bucaramanga, Santander</strong>, en la carrera 16 con calle 36. " +
        'Abre el <a href="https://www.google.com/maps/search/?api=1&query=Carrera+16+con+Calle+33+Bucaramanga" target="_blank" rel="noopener">mapa</a> ' +
        'o ve a <a href="#visitanos">Visítanos</a>.'
    },
    {
      keys: ["beneficio", "ventaja", "para que sirve", "resultado", "impacto"],
      reply:
        "✅ Con JOKATRIX el negocio gana <strong>control</strong> (información al día), <strong>eficiencia</strong> " +
        "(menos errores y demoras) y <strong>crecimiento</strong> (nuevos canales de venta y presencia digital)."
    },
    {
      keys: ["demo", "simulador", "probar", "jugar"],
      reply:
        '🎮 Sube al <a href="#demo">simulador de inventario</a>: vende unidades y mira cómo se generan ' +
        "facturas y alertas de stock bajo."
    },
    {
      keys: ["hola", "buenas", "hey", "saludos", "hi"],
      reply:
        "¡Hola! 🐎 Soy el asistente de este sitio. Puedo contarte sobre <strong>JOKATRIX</strong>, " +
        "la <strong>empresa</strong>, los <strong>módulos</strong>, el <strong>catálogo</strong> y la " +
        "<strong>tienda en línea</strong>. ¿Qué quieres saber?"
    },
    {
      keys: ["gracias", "genial", "perfecto"],
      reply: "¡Con gusto! 🤠 Si necesitas algo más sobre JOKATRIX, aquí estoy."
    }
  ];

  const FALLBACK =
    "Esa no la tengo en mi corral 🤔. Prueba preguntarme por: " +
    "<em>qué es JOKATRIX</em>, <em>inventario y alertas</em>, <em>ventas y facturación</em>, " +
    "<em>la tienda en línea</em> o <em>dónde queda la tienda</em>.";

  const CHIPS = [
    "¿Qué es JOKATRIX?",
    "Inventario y alertas",
    "Ventas y facturación",
    "Tienda en línea",
    "Productos",
    "¿Dónde queda?"
  ];

  /* ---------- Utilidades ---------- */
  const normalize = (s) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function answerFor(text) {
    const q = normalize(text);
    for (const rule of KB) {
      if (rule.keys.some((k) => q.includes(k))) return rule.reply;
    }
    return FALLBACK;
  }

  function addMessage(html, who) {
    const div = document.createElement("div");
    div.className = "chat-msg " + who;
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function botReply(text) {
    const typing = addMessage('<span class="typing"><i></i><i></i><i></i></span>', "bot");
    setTimeout(() => {
      typing.innerHTML = answerFor(text);
      messages.scrollTop = messages.scrollHeight;
    }, 550 + Math.random() * 450);
  }

  function send(text) {
    if (!text.trim()) return;
    addMessage(text.replace(/</g, "&lt;"), "user");
    botReply(text);
  }

  /* ---------- Chips de sugerencias ---------- */
  CHIPS.forEach((label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = label;
    b.addEventListener("click", () => send(label));
    chipsBox.appendChild(b);
  });

  /* ---------- Abrir / cerrar ---------- */
  let greeted = false;
  function openChat() {
    win.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => win.classList.add("open"));
    if (!greeted) {
      greeted = true;
      setTimeout(() => {
        addMessage(
          "¡Hola! 🐎 Pregúntame por <strong>JOKATRIX</strong>, la <strong>empresa</strong>, " +
          "el <strong>inventario</strong> o la <strong>tienda en línea</strong>. " +
          "También puedes tocar una sugerencia aquí abajo.",
          "bot"
        );
      }, 350);
    }
    input.focus();
  }
  function closeChat() {
    win.classList.remove("open");
    fab.setAttribute("aria-expanded", "false");
    setTimeout(() => { win.hidden = true; }, 300);
  }

  fab.addEventListener("click", () => (win.hidden ? openChat() : closeChat()));
  closeBtn.addEventListener("click", closeChat);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(input.value);
    input.value = "";
  });

  // Los botones "Consultar" del catálogo abren el chat con la pregunta
  document.querySelectorAll("[data-ask]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (win.hidden) openChat();
      send("Productos: " + btn.dataset.ask);
    })
  );
})();
