# JOKATRIX · La Casa de los Aperos

Página web de presentación (*landing page*) del proyecto **JOKATRIX**, un sistema integrado de inventario, ventas, facturación, proveedores y tienda en línea pensado para **La Casa de los Aperos**, un negocio de talabartería y artículos agropecuarios ubicado en el centro de Bucaramanga, Santander.

Es un sitio **100 % estático**: HTML + CSS + JavaScript puro, sin frameworks, sin dependencias y sin servidor.

---

## Cómo ejecutarla

1. Descomprime la carpeta.
2. Abre `index.html` en cualquier navegador moderno (doble clic).

No requiere instalación ni `npm`. Solo necesita conexión a internet para cargar las tipografías de Google Fonts (si no hay conexión, se usan las fuentes de respaldo: Georgia y Helvetica Neue).

---

## Estructura del proyecto

```
jokatrix/
├── index.html          → Estructura y contenido de toda la página
├── css/
│   └── responsive.css  → Estilos, tema visual y diseño adaptable
└── js/
    ├── main.js         → Animaciones e interacciones generales
    ├── chatbot.js      → Asistente conversacional (basado en reglas)
    └── demo.js         → Simulador de inventario
```

> **Nota:** `index.html` busca una imagen `logo.jpg` (fachada del negocio) en la raíz del proyecto. No está incluida; si no existe, la página muestra automáticamente un recuadro con las iniciales **CA**. Para usar una foto real, basta con colocar `logo.jpg` junto a `index.html`.

---

## Secciones de la página

La página es de una sola pantalla larga (*one-page*) con navegación por anclas (`#empresa`, `#proceso`, etc.):

| Sección | Id | Qué muestra |
|---|---|---|
| **Navegación** | `#inicio` | Barra superior fija con el logo y los enlaces a cada sección. En móvil se convierte en menú hamburguesa. |
| **Hero** | — | Título principal, botones de acción y tres estadísticas con contador animado, sobre un fondo de motas de polvo doradas. |
| **La empresa** | `#empresa` | Quién es La Casa de los Aperos, su problema actual (procesos manuales, atención solo por WhatsApp) y cómo JOKATRIX lo resuelve. |
| **Del papel al sistema** | `#proceso` | Línea de tiempo con la ruta de transformación: del proceso manual a inventario, ventas, proveedores, estadísticas y tienda en línea. |
| **Catálogo** | `#catalogo` | Tarjetas de las líneas de producto con filtros por categoría. |
| **Cita** | — | Banda con el propósito del proyecto. |
| **Módulos** | `#modulos` | Descripción del panel administrativo y un gráfico de barras ilustrativo de ventas por categoría. |
| **Demo** | `#demo` | Simulador interactivo de inventario (ver más abajo). |
| **Visítanos** | `#visitanos` | Dirección de la tienda física, enlace a Google Maps y beneficios de la tienda en línea. |
| **Impacto** | `#impacto` | Resultados esperados: control, eficiencia y crecimiento. |
| **Footer** | — | Marca, enlaces rápidos y créditos. |

Además hay dos elementos flotantes: el botón **↑ volver arriba** y el botón del **chatbot** 🐎.

---

## Cómo funciona cada parte (JavaScript)

### `js/main.js` — comportamiento general

Cada bloque es una función autoejecutable independiente:

1. **Motas de polvo (canvas).** Dibuja en el `<canvas id="dust">` del hero entre 24 y 70 partículas (según el ancho de pantalla) que suben lentamente, se desplazan en zigzag y "titilan" cambiando su opacidad con una función seno. Cuando una mota sale por arriba, reaparece abajo. El canvas se redimensiona con la ventana.
2. **Aparición al hacer scroll.** Todo elemento con la clase `.reveal` se observa con `IntersectionObserver`; al entrar en pantalla recibe la clase `.in-view` (que activa la transición CSS) y deja de observarse.
3. **Contadores animados.** Los números del hero (`.stat-num[data-count]`) cuentan de 0 al valor indicado en `data-count`, durante 1,4 s con una curva *ease-out* cúbica. La animación arranca cuando el 60 % del número es visible.
4. **Menú hamburguesa.** Alterna la clase `open` en el menú y actualiza `aria-expanded`. Se cierra solo al pulsar cualquier enlace.
5. **Botón "volver arriba".** Se hace visible cuando el scroll supera los 600 px.
6. **Filtro del catálogo.** Los botones `.filter` tienen un `data-filter` (`todos`, `cuero`, `monturas`, `cadenas`, `agro`, `polvora`). Al pulsar uno, se marca como activo y se oculta (`hidden`) toda tarjeta cuyo `data-cat` no coincida.

### `js/demo.js` — simulador de inventario

Muestra cómo reaccionaría el sistema real con **datos de ejemplo** (5 productos con stock, mínimo y máximo):

- **Vender 1:** baja el stock en 1, suma una venta y genera un número de factura consecutivo (`FV-0001`, `FV-0002`…), que se muestra en el panel superior.
- **+5:** reabastece 5 unidades, sin pasar del máximo del producto.
- **Estados** de cada producto:
  - **Normal:** stock por encima del mínimo.
  - **Stock bajo:** stock menor o igual al mínimo.
  - **Agotado:** stock en 0 (el botón de vender se deshabilita).
- **Alertas:** el contador de alertas sube cada vez que un producto pasa de *Normal* a *Stock bajo*. Además se muestra un banner de reabastecimiento con los productos en riesgo, que desaparece cuando todos vuelven a la normalidad.
- **Reiniciar:** restaura los datos originales y los contadores.

La tabla se vuelve a dibujar completa tras cada acción y los clics se gestionan por delegación de eventos sobre el contenedor.

### `js/chatbot.js` — Asistente JOKATRIX

Es un bot **basado en reglas**, sin servidor ni IA externa:

1. Existe una base de conocimiento (`KB`) con reglas de la forma `{ keys: [...], reply: "..." }`.
2. Al enviar un mensaje, el texto se **normaliza** (minúsculas y sin tildes) y se compara con las palabras clave de cada regla **en orden**; gana la **primera coincidencia**.
3. Si ninguna coincide, responde con un mensaje de respaldo (`FALLBACK`) que sugiere temas disponibles.
4. La respuesta aparece tras una animación de "escribiendo…" de entre 0,55 y 1 segundo.
5. Incluye **chips de sugerencias** (¿Qué es JOKATRIX?, Inventario y alertas, etc.) que envían la pregunta con un clic.
6. Los botones **"Consultar →"** del catálogo abren el chat y envían automáticamente la consulta de ese producto.
7. Las respuestas pueden contener enlaces internos (`#demo`, `#catalogo`…) para llevar al usuario a la sección correspondiente. El texto escrito por el usuario se escapa (`<` → `&lt;`) antes de mostrarse.

**Para añadir una respuesta nueva**, agrega un objeto al arreglo `KB` en `chatbot.js`:

```js
{
  keys: ["horario", "hora", "abren"],   // minúsculas y sin tildes
  reply: "🕗 Atendemos de lunes a sábado..."
}
```

> El orden importa: una regla más general colocada antes puede "robarle" la coincidencia a una más específica.

---

## Diseño y estilos (`css/responsive.css`)

- **Tema visual:** inspirado en la talabartería: cuero oscuro, papel kraft y detalles de latón. Los colores, tipografías, tamaños y espaciados están definidos como **variables CSS** en `:root`:

  | Variable | Color | Uso |
  |---|---|---|
  | `--cuero` | `#2b1a10` | Hero y footer |
  | `--crema` | `#f5ecd9` | Fondo general |
  | `--tinta` | `#2a1d14` | Texto principal |
  | `--ambar` | `#d98b2b` | Acento principal |
  | `--campo` | `#4f6b3a` | Enlaces y detalles |
  | `--ladrillo` | `#a8381f` | Hover y alertas |

- **Tipografías (Google Fonts):** *Alfa Slab One* (títulos), *Lora* (texto) y *Oswald* (interfaz).
- **Diseño adaptable:** usa CSS Grid y Flexbox, con puntos de quiebre en `960px` y `640px`.
- **Accesibilidad:** HTML semántico, atributos `aria-*` en menú, chat y alertas, y una regla `prefers-reduced-motion` que desactiva el polvo, las animaciones de scroll y los contadores animados para quienes tienen esa preferencia activada.

---

## Cómo personalizar

| Quiero cambiar… | Dónde |
|---|---|
| Textos, secciones o productos del catálogo | `index.html` |
| Colores y tipografías | Variables en `:root` de `responsive.css` |
| Productos, stocks y mínimos del simulador | Arreglo `BASE` en `demo.js` |
| Respuestas del chatbot | Arreglo `KB` en `chatbot.js` |
| Cantidad o color de las motas de polvo | Función `dust()` en `main.js` |
| Foto de la fachada | Agregar `logo.jpg` en la raíz |

---

## Aspectos a revisar

- **Dirección inconsistente:** el texto de la página dice *carrera 16 con calle 33*, pero el enlace del mapa en `index.html` y la respuesta "¿Dónde queda?" del chatbot mencionan la *calle 36* (y el enlace del chatbot usa la calle 33). Conviene unificar la dirección correcta.
- **Sin backend:** la tienda en línea, el inventario y la facturación descritos son la **propuesta del sistema**; en esta página solo existen como contenido informativo y simulación con datos de ejemplo. Nada se guarda: al recargar, el simulador vuelve a su estado inicial.

---

## Tecnologías

HTML5 semántico · CSS3 (Grid, Flexbox, variables, `clamp()`) · JavaScript ES6 · Canvas API · IntersectionObserver · Google Fonts.
