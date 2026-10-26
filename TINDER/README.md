# Tinder Swipe

Réplica interactiva de la mecánica de *swipe* de Tinder, hecha con **HTML, CSS y JavaScript puro** (sin frameworks ni dependencias). Es el proyecto **01** de la serie *100 proyectos JS*.

Se muestra un teléfono con una pila de tarjetas de perfiles que puedes arrastrar a izquierda o derecha (o descartar con los botones), deshacer la última acción y activar un efecto de "boost" en el logo.

---

## Cómo ejecutarlo

1. Descomprime la carpeta.
2. Abre `index.html` en cualquier navegador moderno (doble clic).

No requiere instalación, servidor ni conexión a internet.

---

## Estructura del proyecto

```
tinder-swipe/
├── index.html      → Estructura de la página (teléfono, cabecera, tarjetas, botones)
├── css/
│   └── styles.css  → Estilos, animaciones y estados de las tarjetas
├── js/
│   └── app.js      → Lógica: render de tarjetas, arrastre, botones y deshacer
└── images/
    ├── photos/     → 1.png … 5.png (fotos de los perfiles)
    └── ui/         → iphone.webp (marco), tinder-icons.webp (sprite de botones), tinder-logo.webp
```

---

## Cómo funciona

### 1. Estructura (`index.html`)

La página dibuja un iPhone (imagen de fondo del `<main>`) y dentro de él una pantalla con tres zonas:

- **`header`:** el logo de Tinder.
- **`#cards`:** contenedor vacío donde JavaScript inserta las tarjetas. Contiene un mensaje (`.no-more`) que queda detrás y solo se ve cuando se acaban las tarjetas: *"No hay más personas cerca de ti…"*.
- **`footer`:** cinco botones: **deshacer**, **descartar**, **super like**, **me gusta** y **boost**.

### 2. Datos y tarjetas

Los perfiles están en el arreglo `PROFILES` de `app.js` (nombre, edad, foto y texto alternativo). Cada tarjeta es un `<article>` que contiene la foto, el nombre con la edad y dos etiquetas ocultas: **NOPE** y **LIKE**.

Las tarjetas se añaden **en orden inverso**, de modo que el primer perfil de la lista queda al final del DOM y, por tanto, **encima** de la pila (las tarjetas usan `position: absolute`). La tarjeta superior es siempre el último `<article>` del contenedor.

### 3. Arrastrar una tarjeta (mouse y táctil)

Al presionar sobre una tarjeta (`mousedown` / `touchstart`) se calcula el punto inicial y se escuchan los eventos de movimiento:

- **Mientras se arrastra:** la tarjeta se desplaza en horizontal y se inclina proporcionalmente a la distancia (`distancia / 14` grados). La etiqueta **LIKE** (derecha) o **NOPE** (izquierda) va aumentando su opacidad hasta ser totalmente visible a 100 px.
- **Al soltar:**
  - Si el desplazamiento es de **75 px o más**, se considera una decisión: la tarjeta sale volando hacia ese lado (clases `go-left` / `go-right`) y, al terminar la transición, se retira del DOM y se guarda en el historial.
  - Si es **menor**, la tarjeta regresa suavemente al centro (clase `reset`).
  - Si fue solo un clic sin movimiento, simplemente se limpia el estilo.

Las constantes `DECISION_THRESHOLD`, `ROTATION_DIVISOR` y `LABEL_FULL_OPACITY_DISTANCE` al inicio de `app.js` permiten ajustar la sensibilidad.

### 4. Botones

| Botón | Clase | Acción |
|---|---|---|
| ↩ Deshacer | `is-undo` | Recupera la última tarjeta descartada |
| ✕ Descartar | `is-remove` | Lanza la tarjeta superior hacia la **izquierda** |
| ★ Super like | `is-star` | Lanza la tarjeta superior hacia **arriba** |
| ♥ Me gusta | `is-fav` | Lanza la tarjeta superior hacia la **derecha** |
| ⚡ Boost | `is-zap` | Anima el logo del encabezado (pulso con brillo morado) |

Los botones de descartar y me gusta muestran primero la etiqueta NOPE / LIKE antes de lanzar la tarjeta, igual que al arrastrar.

### 5. Deshacer

Cada tarjeta que sale se guarda en `swipedHistory` junto con su dirección. Al pulsar deshacer:

1. Se toma la última entrada del historial.
2. Se limpian sus estilos inline y las etiquetas.
3. Se coloca en su posición de salida **sin transición** (`no-transition`) y se vuelve a insertar encima de la pila.
4. Se fuerza un *reflow* y se quita la posición de salida, de modo que la tarjeta **vuelve animada** hasta el centro.

### 6. Control de animaciones

La variable `isAnimating` bloquea nuevas acciones mientras hay una animación en curso, evitando que se solapen arrastres, clics en botones o deshacer.

---

## Estilos (`css/styles.css`)

- **Marco del teléfono:** `<main>` de 320 × 640 px con la imagen del iPhone de fondo; la pantalla (`section`) se ajusta dentro con bordes redondeados.
- **Tarjetas:** posicionadas una sobre otra, con foto a pantalla completa (`object-fit: cover`) y un degradado oscuro inferior para que se lea el nombre.
- **Etiquetas NOPE / LIKE:** rojas y verdes, ligeramente rotadas, con opacidad 0 hasta que se arrastra la tarjeta.
- **Estados de tarjeta:** `go-left`, `go-right`, `go-up` (salida), `reset` (regreso al centro) y `no-transition` (para el deshacer).
- **Botones:** usan un único *sprite* (`tinder-icons.webp`) recortado con `background-position`, y crecen al pasar el cursor.
- **Boost:** animación `boost-pulse` que agranda y regresa el logo con un resplandor morado.

---

## Cómo personalizar

| Quiero… | Qué hacer |
|---|---|
| Agregar o cambiar perfiles | Editar el arreglo `PROFILES` en `app.js` y colocar la foto en `images/photos/` |
| Hacer el swipe más o menos sensible | Cambiar `DECISION_THRESHOLD` (px necesarios para decidir) |
| Cambiar la inclinación al arrastrar | Cambiar `ROTATION_DIVISOR` (menor valor = más inclinación) |
| Cambiar la duración de las animaciones | Modificar `transition: transform 0.3s ease` en `.cards article` |

---

## Limitaciones conocidas

- El **super like** (★) solo lanza la tarjeta hacia arriba; no muestra una etiqueta propia ni se puede hacer arrastrando.
- No hay persistencia: al recargar la página se reinician los perfiles.
- Los "me gusta" y "nope" no se guardan ni se procesan; es una demostración visual.
- El tamaño del teléfono es fijo (320 × 640 px) y no se adapta a pantallas pequeñas.

---

## Tecnologías

HTML5 · CSS3 (transiciones, animaciones, `filter`, sprites) · JavaScript ES6 (eventos de mouse y táctiles, manipulación del DOM).

---

*Autor: Carlos Chaparro.*
