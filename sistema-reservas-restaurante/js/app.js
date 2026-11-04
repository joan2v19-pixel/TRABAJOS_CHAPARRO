/* =============================================================
   app.js
   -------------------------------------------------------------
   Responsabilidades:
   - Inicializar la aplicación.
   - Controlar la navegación entre vistas.
   - Renderizar cada vista y sus ventanas modales.
   - Conectar los botones y formularios con los módulos.
   - Mostrar mensajes de éxito y error.

   Toda información que provenga del usuario se escapa antes de
   insertarse con innerHTML para evitar problemas de XSS.
   ============================================================= */

/* Estado actual de la interfaz. */
let vistaActual = 'dashboard';
let carritoActual = [];
let idPedidoEnEdicion = null;

/* Definición de las vistas: título, permiso requerido,
   icono y función que dibuja el contenido. */
const VISTAS = {
    dashboard: {
        titulo: 'Panel principal',
        permiso: 'verDashboard',
        icono: '📊',
        funcion: renderizarDashboard
    },
    mesas: {
        titulo: 'Mesas',
        permiso: 'verMesas',
        icono: '🪑',
        funcion: renderizarMesas
    },
    reservas: {
        titulo: 'Reservas',
        permiso: 'verReservas',
        icono: '📅',
        funcion: renderizarReservas
    },
    pedidos: {
        titulo: 'Pedidos',
        permiso: 'verPedidos',
        icono: '🧾',
        funcion: renderizarPedidos
    },
    cocina: {
        titulo: 'Cocina',
        permiso: 'verCocina',
        icono: '👨‍🍳',
        funcion: renderizarCocina
    },
    despachos: {
        titulo: 'Despachos',
        permiso: 'verDespachos',
        icono: '🚚',
        funcion: renderizarDespachos
    },
    usuarios: {
        titulo: 'Usuarios',
        permiso: 'verUsuarios',
        icono: '👥',
        funcion: renderizarUsuarios
    }
};

/* =============================================================
   1. UTILIDADES DE INTERFAZ
   ============================================================= */

/**
 * Escapa caracteres especiales para insertar texto del usuario
 * dentro de innerHTML sin riesgo de inyección de código (XSS).
 */
function escaparHtml(texto) {
    const textoOriginal = String(texto === undefined || texto === null ? '' : texto);

    return textoOriginal
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Formatea un importe con dos decimales y símbolo de moneda.
 */
function formatearMoneda(valor) {
    const numero = Number(valor);

    if (isNaN(numero)) {
        return '$0.00';
    }

    return '$' + numero.toFixed(2);
}

/**
 * Devuelve la clase de color según el estado de un elemento.
 */
function claseDeEtiquetaParaEstado(estado) {
    switch (estado) {
        case 'Disponible':
        case 'Confirmada':
        case 'Listo':
        case 'Completado':
            return 'etiqueta-verde';

        case 'Reservada':
        case 'Pendiente':
            return 'etiqueta-amarilla';

        case 'Ocupada':
        case 'Cancelada':
            return 'etiqueta-roja';

        case 'En preparación':
        case 'En ruta':
        case 'Activo':
        case 'Administrador':
            return 'etiqueta-azul';

        case 'Mesero':
            return 'etiqueta-verde';

        case 'Cocina':
            return 'etiqueta-amarilla';

        default:
            return 'etiqueta-gris';
    }
}

/**
 * Crea la etiqueta de estado con el color correspondiente.
 */
function crearEtiquetaDeEstado(estado) {
    return '<span class="etiqueta ' + claseDeEtiquetaParaEstado(estado) + '">' + escaparHtml(estado) + '</span>';
}

/**
 * Muestra un mensaje flotante de éxito o de error.
 * Se usa textContent para que el texto nunca se interprete
 * como HTML.
 */
function mostrarMensaje(tipoDeMensaje, texto) {
    const contenedor = document.getElementById('contenedor-mensajes');
    const mensaje = document.createElement('div');

    mensaje.className = 'mensaje ' + (tipoDeMensaje === 'exito' ? 'mensaje-exito' : 'mensaje-error');
    mensaje.textContent = texto;

    contenedor.appendChild(mensaje);

    setTimeout(function() {
        mensaje.remove();
    }, 4500);
}

function mostrarMensajeExito(texto) {
    mostrarMensaje('exito', texto);
}

function mostrarMensajeError(texto) {
    mostrarMensaje('error', texto);
}

/**
 * Muestra el resultado de una operación de los módulos.
 */
function mostrarResultadoDeOperacion(resultado) {
    if (resultado.exito) {
        mostrarMensajeExito(resultado.mensaje);
    } else {
        mostrarMensajeError(resultado.mensaje);
    }
}

/**
 * Conecta un manejador de eventos a los botones que coincidan
 * con el selector dentro de un contenedor.
 */
function conectarBotones(contenedor, selector, manejador) {
    const botones = contenedor.querySelectorAll(selector);

    botones.forEach(function(boton) {
        boton.addEventListener('click', manejador);
    });
}

/**
 * Abre la ventana modal con el título y el contenido indicados.
 */
function abrirModal(titulo, contenidoHtml) {
    document.getElementById('titulo-modal').textContent = titulo;
    document.getElementById('contenido-modal').innerHTML = contenidoHtml;
    document.getElementById('fondo-modal').hidden = false;
}

/**
 * Cierra la ventana modal y limpia su contenido.
 */
function cerrarModal() {
    document.getElementById('fondo-modal').hidden = true;
    document.getElementById('contenido-modal').innerHTML = '';
    carritoActual = [];
    idPedidoEnEdicion = null;
}

/**
 * Conecta los botones de cancelar y cerrar de una ventana modal.
 */
function conectarBotonesDeCierreDelModal(contenedor) {
    conectarBotones(contenedor, '[data-accion="cancelar"]', cerrarModal);
    conectarBotones(contenedor, '[data-accion="cerrar"]', cerrarModal);
}

/* =============================================================
   2. INICIALIZACIÓN Y SESIÓN
   ============================================================= */

document.addEventListener('DOMContentLoaded', inicializarAplicacion);

/**
 * Registra los eventos principales de la aplicación y
 * restaura la sesión si todavía está vigente.
 */
function inicializarAplicacion() {
    document.getElementById('formulario-login')
        .addEventListener('submit', manejarInicioDeSesion);

    document.getElementById('boton-cerrar-sesion')
        .addEventListener('click', manejarCierreDeSesion);

    document.getElementById('boton-menu')
        .addEventListener('click', alternarMenuMovil);

    document.getElementById('boton-cerrar-modal')
        .addEventListener('click', cerrarModal);

    document.getElementById('fondo-modal')
        .addEventListener('click', manejarClicEnElFondoDelModal);

    document.addEventListener('keydown', manejarTeclaDeEscape);

    /* Botón de Google: queda pendiente mientras no exista Client ID. */
    configurarBotonGoogle(document.getElementById('contenedor-google'), function() {
        mostrarAplicacion();
    });

    /* Antes de mostrar nada se descifran los datos y la sesión. */
    prepararLaAplicacion();
}

/**
 * Descifra la información guardada y la sesión, y después
 * muestra la pantalla que corresponda.
 */
function prepararLaAplicacion() {
    prepararElAlmacenamiento()
        .then(function() {
            return prepararLaSesion();
        })
        .then(function() {
            restaurarSesionAlAbrirLaPagina();
        })
        .catch(function() {
            mostrarMensajeEnElLogin(
                'Este navegador no permite cifrar la información. '
                + 'Use un navegador actualizado y abra la página mediante HTTPS o localhost.'
            );
        });
}

/**
 * Comprueba si hay una sesión vigente y muestra la vista
 * correspondiente.
 */
function restaurarSesionAlAbrirLaPagina() {
    const sesion = obtenerSesionActual();

    if (sesion === null) {
        mostrarPantallaDeLogin();
        return;
    }

    mostrarAplicacion();
}

/**
 * Maneja el envío del formulario de inicio de sesión.
 */
function manejarInicioDeSesion(evento) {
    evento.preventDefault();

    /* Sin cifrado no se permite entrar: los datos no podrían
       guardarse de forma segura. */
    if (!elCifradoEstaDisponible()) {
        mostrarMensajeEnElLogin(
            'Este navegador no permite cifrar la información. '
            + 'Use un navegador actualizado y abra la página mediante HTTPS o localhost.'
        );
        return;
    }

    const campoUsuario = document.getElementById('campo-usuario');
    const campoContrasena = document.getElementById('campo-contrasena');

    const resultado = iniciarSesion(campoUsuario.value, campoContrasena.value);

    if (!resultado.exito) {
        mostrarMensajeEnElLogin(resultado.mensaje);
        return;
    }

    ocultarMensajeDelLogin();
    campoUsuario.value = '';
    campoContrasena.value = '';

    mostrarAplicacion();
    mostrarMensajeExito('Bienvenido al sistema.');
}

/**
 * Muestra un error dentro de la pantalla de inicio de sesión.
 */
function mostrarMensajeEnElLogin(texto) {
    const mensaje = document.getElementById('mensaje-login');
    mensaje.textContent = texto;
    mensaje.hidden = false;
}

function ocultarMensajeDelLogin() {
    const mensaje = document.getElementById('mensaje-login');
    mensaje.textContent = '';
    mensaje.hidden = true;
}

/**
 * Cierra la sesión actual y vuelve al formulario de acceso.
 */
function manejarCierreDeSesion() {
    cerrarSesion();
    mostrarPantallaDeLogin();
    mostrarMensajeExito('La sesión fue cerrada correctamente.');
}

/**
 * Se ejecuta cuando la sesión expira mientras el usuario
 * estaba trabajando.
 */
function manejarSesionExpirada() {
    cerrarSesion();
    mostrarPantallaDeLogin();
    mostrarMensajeError('La sesión expiró. Debe iniciar sesión nuevamente.');
}

function mostrarPantallaDeLogin() {
    document.getElementById('aplicacion').hidden = true;
    document.getElementById('pantalla-login').hidden = false;
    document.getElementById('contenido-principal').innerHTML = '';
    document.getElementById('lista-menu').innerHTML = '';
    ocultarMensajeDelLogin();
}

/**
 * Oculta el login y muestra la aplicación con el menú
 * correspondiente al rol del usuario.
 */
function mostrarAplicacion() {
    document.getElementById('pantalla-login').hidden = true;
    document.getElementById('aplicacion').hidden = false;

    const sesion = obtenerSesionActual();

    document.getElementById('nombre-usuario').textContent = sesion.nombreCompleto;
    document.getElementById('rol-usuario').textContent = sesion.rol;

    renderizarMenu();

    const primeraVistaPermitida = obtenerPrimeraVistaPermitida();

    if (primeraVistaPermitida) {
        navegarAVista(primeraVistaPermitida);
    }
}

/**
 * Devuelve la primera vista a la que el rol actual puede acceder.
 */
function obtenerPrimeraVistaPermitida() {
    const nombresDeVistas = Object.keys(VISTAS);

    for (let indice = 0; indice < nombresDeVistas.length; indice++) {
        const nombreDeVista = nombresDeVistas[indice];

        if (usuarioTienePermiso(VISTAS[nombreDeVista].permiso)) {
            return nombreDeVista;
        }
    }

    return null;
}

/* =============================================================
   3. MENÚ Y NAVEGACIÓN
   ============================================================= */

/**
 * Dibuja el menú lateral solamente con las vistas permitidas
 * para el rol del usuario.
 */
function renderizarMenu() {
    const listaMenu = document.getElementById('lista-menu');
    const nombresDeVistas = Object.keys(VISTAS);
    let html = '';

    nombresDeVistas.forEach(function(nombreDeVista) {
        const definicion = VISTAS[nombreDeVista];

        if (usuarioTienePermiso(definicion.permiso)) {
            html = html +
                '<li><button type="button" class="enlace-menu" data-vista="' + nombreDeVista + '">' +
                '<span class="icono-menu">' + definicion.icono + '</span>' +
                escaparHtml(definicion.titulo) +
                '</button></li>';
        }
    });

    listaMenu.innerHTML = html;

    conectarBotones(listaMenu, '.enlace-menu', function(evento) {
        const nombreDeVista = evento.currentTarget.getAttribute('data-vista');
        navegarAVista(nombreDeVista);
    });
}

/**
 * Cambia a la vista indicada. Siempre comprueba los permisos
 * antes de mostrar la información.
 */
function navegarAVista(nombreDeVista) {
    if (obtenerSesionActual() === null) {
        manejarSesionExpirada();
        return;
    }

    const definicion = VISTAS[nombreDeVista];

    if (!definicion) {
        mostrarMensajeError('La vista solicitada no existe.');
        return;
    }

    if (!usuarioTienePermiso(definicion.permiso)) {
        mostrarMensajeError('No tiene permisos para acceder a esta sección.');
        return;
    }

    vistaActual = nombreDeVista;

    document.getElementById('titulo-vista').textContent = definicion.titulo;
    definicion.funcion();

    marcarVistaActivaEnElMenu();
    cerrarMenuMovil();
}

/**
 * Resalta en el menú la vista que se está mostrando.
 */
function marcarVistaActivaEnElMenu() {
    const botones = document.querySelectorAll('#lista-menu .enlace-menu');

    botones.forEach(function(boton) {
        const esVistaActual = boton.getAttribute('data-vista') === vistaActual;
        boton.classList.toggle('activo', esVistaActual);
    });
}

function alternarMenuMovil() {
    document.getElementById('menu-lateral').classList.toggle('abierto');
}

function cerrarMenuMovil() {
    document.getElementById('menu-lateral').classList.remove('abierto');
}

function manejarClicEnElFondoDelModal(evento) {
    if (evento.target.id === 'fondo-modal') {
        cerrarModal();
    }
}

function manejarTeclaDeEscape(evento) {
    const fondoModal = document.getElementById('fondo-modal');

    if (evento.key === 'Escape' && !fondoModal.hidden) {
        cerrarModal();
    }
}

/* =============================================================
   4. VISTA: PANEL PRINCIPAL
   ============================================================= */

function renderizarDashboard() {
    const estadisticas = obtenerEstadisticas();
    const reservasRecientes = obtenerReservasRecientes(5);
    const pedidosRecientes = obtenerPedidosRecientes(5);
    const contenido = document.getElementById('contenido-principal');

    let html = '<div class="tarjetas-estadisticas">';
    html = html + crearTarjetaDeEstadistica('📅', estadisticas.reservasDeHoy, 'Reservas del día');
    html = html + crearTarjetaDeEstadistica('🍽️', estadisticas.platosPendientes, 'Platos pendientes');
    html = html + crearTarjetaDeEstadistica('🚚', estadisticas.despachosActivos, 'Despachos activos');
    html = html + crearTarjetaDeEstadistica('🪑', estadisticas.mesasOcupadas, 'Mesas ocupadas');
    html = html + '</div>';

    html = html + '<div class="columnas-dashboard">';
    html = html +
        '<div class="panel">' +
        '<h3 class="seccion-titulo">Reservas recientes</h3>' +
        crearListaDeReservasRecientes(reservasRecientes) +
        '</div>';
    html = html +
        '<div class="panel">' +
        '<h3 class="seccion-titulo">Pedidos recientes</h3>' +
        crearListaDePedidosRecientes(pedidosRecientes) +
        '</div>';
    html = html + '</div>';

    contenido.innerHTML = html;
}

/**
 * Crea una tarjeta de estadística del panel principal.
 */
function crearTarjetaDeEstadistica(icono, valor, etiqueta) {
    return '<div class="tarjeta-estadistica">' +
        '<span class="tarjeta-estadistica-icono">' + icono + '</span>' +
        '<span class="tarjeta-estadistica-valor">' + valor + '</span>' +
        '<span class="tarjeta-estadistica-etiqueta">' + escaparHtml(etiqueta) + '</span>' +
        '</div>';
}

function crearListaDeReservasRecientes(reservas) {
    if (reservas.length === 0) {
        return '<p class="texto-suave">Todavía no hay reservas registradas.</p>';
    }

    let html = '<ul class="lista-reciente">';

    reservas.forEach(function(reserva) {
        const mesa = buscarMesaPorId(reserva.idMesa);
        const numeroDeMesa = mesa ? mesa.numero : '—';

        html = html +
            '<li>' +
            '<span><strong>' + escaparHtml(reserva.nombreCliente) + '</strong>' +
            '<br><span class="datos-lista-reciente">Mesa ' + numeroDeMesa +
            ' · ' + escaparHtml(reserva.fecha) + ' · ' + escaparHtml(reserva.hora) + '</span></span>' +
            crearEtiquetaDeEstado(reserva.estado) +
            '</li>';
    });

    html = html + '</ul>';

    return html;
}

function crearListaDePedidosRecientes(pedidos) {
    if (pedidos.length === 0) {
        return '<p class="texto-suave">Todavía no hay pedidos registrados.</p>';
    }

    let html = '<ul class="lista-reciente">';

    pedidos.forEach(function(pedido) {
        const mesa = buscarMesaPorId(pedido.idMesa);
        const numeroDeMesa = mesa ? mesa.numero : '—';

        html = html +
            '<li>' +
            '<span><strong>Pedido N° ' + pedido.numero + '</strong>' +
            '<br><span class="datos-lista-reciente">Mesa ' + numeroDeMesa +
            ' · ' + escaparHtml(pedido.fecha) + ' · ' + formatearMoneda(pedido.total) + '</span></span>' +
            crearEtiquetaDeEstado(pedido.estado) +
            '</li>';
    });

    html = html + '</ul>';

    return html;
}

/* =============================================================
   5. VISTA: MESAS
   ============================================================= */

function renderizarMesas() {
    const mesas = obtenerMesas();
    const puedeEditar = usuarioTienePermiso('gestionarMesas');
    const contenido = document.getElementById('contenido-principal');

    let html = '<div class="fila-superior">' +
        '<div>' +
        '<h3 class="seccion-titulo">Estado de las mesas</h3>' +
        '<p class="texto-suave">Verde: disponible · Amarillo: reservada · Rojo: ocupada</p>' +
        '</div>' +
        '</div>';

    html = html + '<div class="rejilla-mesas">';

    mesas.forEach(function(mesa) {
        html = html + crearTarjetaDeMesa(mesa, puedeEditar);
    });

    html = html + '</div>';

    contenido.innerHTML = html;

    if (puedeEditar) {
        conectarBotones(contenido, '.boton-editar-mesa', function(evento) {
            const idMesa = evento.currentTarget.getAttribute('data-id-mesa');
            abrirModalDeEdicionDeMesa(idMesa);
        });
    }
}

/**
 * Crea la tarjeta visual de una mesa con su color de estado.
 */
function crearTarjetaDeMesa(mesa, puedeEditar) {
    let claseDeEstado = 'disponible';

    if (mesa.estado === 'Reservada') {
        claseDeEstado = 'reservada';
    } else if (mesa.estado === 'Ocupada') {
        claseDeEstado = 'ocupada';
    }

    let html = '<div class="tarjeta-mesa ' + claseDeEstado + '">' +
        '<span class="numero-mesa">Mesa ' + mesa.numero + '</span>' +
        '<span class="datos-mesa">Capacidad: ' + mesa.capacidad + ' personas</span>' +
        '<span>' + crearEtiquetaDeEstado(mesa.estado) + '</span>';

    if (puedeEditar) {
        html = html +
            '<button type="button" class="boton boton-secundario boton-pequeño boton-editar-mesa" ' +
            'data-id-mesa="' + mesa.id + '">Editar mesa</button>';
    }

    html = html + '</div>';

    return html;
}

/**
 * Abre la ventana para que el administrador modifique una mesa.
 */
function abrirModalDeEdicionDeMesa(idMesa) {
    const mesa = buscarMesaPorId(idMesa);

    if (!mesa) {
        mostrarMensajeError('La mesa indicada no existe.');
        return;
    }

    let opcionesDeEstado = '';

    ESTADOS_DE_MESA.forEach(function(estado) {
        const seleccionado = mesa.estado === estado ? ' selected' : '';
        opcionesDeEstado = opcionesDeEstado + '<option value="' + estado + '"' + seleccionado + '>' + estado + '</option>';
    });

    const html = '<form id="formulario-editar-mesa">' +
        '<p class="texto-suave">Mesa N° ' + mesa.numero + '</p>' +
        '<div class="campo">' +
        '<label for="mesa-capacidad">Capacidad</label>' +
        '<input type="number" id="mesa-capacidad" min="1" max="30" value="' + mesa.capacidad + '" required>' +
        '</div>' +
        '<div class="campo">' +
        '<label for="mesa-estado">Estado</label>' +
        '<select id="mesa-estado">' + opcionesDeEstado + '</select>' +
        '<p class="pista-campo">El estado se vuelve a calcular automáticamente cuando se crean reservas o pedidos.</p>' +
        '</div>' +
        '<div class="modal-acciones">' +
        '<button type="button" class="boton boton-secundario" data-accion="cancelar">Cancelar</button>' +
        '<button type="submit" class="boton boton-primario">Guardar cambios</button>' +
        '</div>' +
        '</form>';

    abrirModal('Editar mesa', html);

    const contenidoDelModal = document.getElementById('contenido-modal');
    conectarBotonesDeCierreDelModal(contenidoDelModal);

    document.getElementById('formulario-editar-mesa')
        .addEventListener('submit', function(evento) {
            evento.preventDefault();

            const datosDeLaMesa = {
                capacidad: document.getElementById('mesa-capacidad').value,
                estado: document.getElementById('mesa-estado').value
            };

            const resultado = actualizarMesa(idMesa, datosDeLaMesa);
            mostrarResultadoDeOperacion(resultado);

            if (resultado.exito) {
                cerrarModal();
                renderizarMesas();
            }
        });
}

/* =============================================================
   6. VISTA: RESERVAS
   ============================================================= */

function renderizarReservas() {
    const reservas = obtenerReservas();
    const puedeCrear = usuarioTienePermiso('crearReservas');
    const puedeCancelar = usuarioTienePermiso('cancelarReservas');
    const contenido = document.getElementById('contenido-principal');

    let html = '<div class="fila-superior">' +
        '<h3 class="seccion-titulo">Reservas registradas</h3>';

    if (puedeCrear) {
        html = html + '<button type="button" class="boton boton-primario" id="boton-nueva-reserva">Nueva reserva</button>';
    }

    html = html + '</div>';

    if (reservas.length === 0) {
        html = html + '<div class="panel"><p class="texto-suave">Todavía no hay reservas registradas.</p></div>';
    } else {
        html = html + '<div class="tabla-contenedor"><table class="tabla">' +
            '<thead><tr>' +
            '<th>Cliente</th><th>Mesa</th><th>Fecha</th><th>Hora</th>' +
            '<th>Personas</th><th>Estado</th><th>Acciones</th>' +
            '</tr></thead><tbody>';

        reservas.forEach(function(reserva) {
            html = html + crearFilaDeReserva(reserva, puedeCancelar);
        });

        html = html + '</tbody></table></div>';
    }

    contenido.innerHTML = html;

    if (puedeCrear) {
        document.getElementById('boton-nueva-reserva')
            .addEventListener('click', abrirModalDeNuevaReserva);
    }

    if (puedeCancelar) {
        conectarBotones(contenido, '.boton-cancelar-reserva', function(evento) {
            const idReserva = evento.currentTarget.getAttribute('data-id-reserva');
            const resultado = cancelarReserva(idReserva);
            mostrarResultadoDeOperacion(resultado);

            if (resultado.exito) {
                renderizarReservas();
            }
        });
    }
}

function crearFilaDeReserva(reserva, puedeCancelar) {
    const mesa = buscarMesaPorId(reserva.idMesa);
    const numeroDeMesa = mesa ? mesa.numero : '—';

    let acciones = '<span class="texto-suave">Sin acciones</span>';

    if (puedeCancelar && reserva.estado === 'Confirmada') {
        acciones = '<button type="button" class="boton boton-peligro boton-pequeño boton-cancelar-reserva" ' +
            'data-id-reserva="' + reserva.id + '">Cancelar</button>';
    }

    return '<tr>' +
        '<td>' + escaparHtml(reserva.nombreCliente) + '</td>' +
        '<td>Mesa ' + numeroDeMesa + '</td>' +
        '<td>' + escaparHtml(reserva.fecha) + '</td>' +
        '<td>' + escaparHtml(reserva.hora) + '</td>' +
        '<td>' + reserva.cantidadPersonas + '</td>' +
        '<td>' + crearEtiquetaDeEstado(reserva.estado) + '</td>' +
        '<td>' + acciones + '</td>' +
        '</tr>';
}

/**
 * Abre el formulario de nueva reserva con las mesas disponibles.
 */
function abrirModalDeNuevaReserva() {
    const mesas = obtenerMesas();
    let opcionesDeMesa = '<option value="">Seleccione una mesa</option>';

    mesas.forEach(function(mesa) {
        const estaOcupada = mesa.estado === 'Ocupada';
        const detalle = 'Mesa ' + mesa.numero + ' (' + mesa.capacidad + ' personas) - ' + mesa.estado;

        opcionesDeMesa = opcionesDeMesa +
            '<option value="' + mesa.id + '"' + (estaOcupada ? ' disabled' : '') + '>' +
            escaparHtml(detalle) +
            '</option>';
    });

    const html = '<form id="formulario-nueva-reserva">' +
        '<div class="campo">' +
        '<label for="reserva-cliente">Nombre del cliente</label>' +
        '<input type="text" id="reserva-cliente" maxlength="60" placeholder="Nombre y apellido" required>' +
        '</div>' +
        '<div class="fila-formulario">' +
        '<div class="campo">' +
        '<label for="reserva-fecha">Fecha</label>' +
        '<input type="date" id="reserva-fecha" min="' + obtenerFechaActual() + '" required>' +
        '</div>' +
        '<div class="campo">' +
        '<label for="reserva-hora">Hora</label>' +
        '<input type="time" id="reserva-hora" step="60" required>' +
        '</div>' +
        '</div>' +
        '<div class="fila-formulario">' +
        '<div class="campo">' +
        '<label for="reserva-personas">Cantidad de personas</label>' +
        '<input type="number" id="reserva-personas" min="1" max="50" value="1" required>' +
        '</div>' +
        '<div class="campo">' +
        '<label for="reserva-mesa">Mesa</label>' +
        '<select id="reserva-mesa" required>' + opcionesDeMesa + '</select>' +
        '</div>' +
        '</div>' +
        '<p class="pista-campo">Cada reserva ocupa la mesa durante aproximadamente 120 minutos.</p>' +
        '<div class="modal-acciones">' +
        '<button type="button" class="boton boton-secundario" data-accion="cancelar">Cancelar</button>' +
        '<button type="submit" class="boton boton-primario">Crear reserva</button>' +
        '</div>' +
        '</form>';

    abrirModal('Nueva reserva', html);

    const contenidoDelModal = document.getElementById('contenido-modal');
    conectarBotonesDeCierreDelModal(contenidoDelModal);

    document.getElementById('formulario-nueva-reserva')
        .addEventListener('submit', function(evento) {
            evento.preventDefault();

            const datosDeLaReserva = {
                nombreCliente: document.getElementById('reserva-cliente').value,
                fecha: document.getElementById('reserva-fecha').value,
                hora: document.getElementById('reserva-hora').value,
                cantidadPersonas: document.getElementById('reserva-personas').value,
                idMesa: document.getElementById('reserva-mesa').value
            };

            const resultado = crearReserva(datosDeLaReserva);
            mostrarResultadoDeOperacion(resultado);

            if (resultado.exito) {
                cerrarModal();
                renderizarReservas();
            }
        });
}

/* =============================================================
   7. VISTA: PEDIDOS
   ============================================================= */

function renderizarPedidos() {
    const pedidos = obtenerPedidos();
    const puedeModificar = usuarioTienePermiso('crearPedidos');
    const contenido = document.getElementById('contenido-principal');

    let html = '<div class="fila-superior">' +
        '<h3 class="seccion-titulo">Pedidos registrados</h3>';

    if (puedeModificar) {
        html = html + '<button type="button" class="boton boton-primario" id="boton-nuevo-pedido">Nuevo pedido</button>';
    }

    html = html + '</div>';

    if (pedidos.length === 0) {
        html = html + '<div class="panel"><p class="texto-suave">Todavía no hay pedidos registrados.</p></div>';
    } else {
        html = html + '<div class="tabla-contenedor"><table class="tabla">' +
            '<thead><tr>' +
            '<th>N°</th><th>Mesa</th><th>Fecha</th><th>Hora</th>' +
            '<th>Platos</th><th>Total</th><th>Estado</th><th>Acciones</th>' +
            '</tr></thead><tbody>';

        pedidos.forEach(function(pedido) {
            html = html + crearFilaDePedido(pedido, puedeModificar);
        });

        html = html + '</tbody></table></div>';
    }

    contenido.innerHTML = html;

    if (puedeModificar) {
        document.getElementById('boton-nuevo-pedido')
            .addEventListener('click', function() {
                abrirModalDePedido(null);
            });
    }

    conectarBotones(contenido, '.boton-detalle-pedido', function(evento) {
        const idPedido = evento.currentTarget.getAttribute('data-id-pedido');
        abrirModalDeDetalleDePedido(idPedido);
    });

    conectarBotones(contenido, '.boton-modificar-pedido', function(evento) {
        const idPedido = evento.currentTarget.getAttribute('data-id-pedido');
        abrirModalDePedido(idPedido);
    });
}

function crearFilaDePedido(pedido, puedeModificar) {
    const mesa = buscarMesaPorId(pedido.idMesa);
    const numeroDeMesa = mesa ? mesa.numero : '—';

    let acciones = '<button type="button" class="boton boton-secundario boton-pequeño boton-detalle-pedido" ' +
        'data-id-pedido="' + pedido.id + '">Detalle</button>';

    /* Solo se permite modificar un pedido activo mientras todos
       sus platos sigan en estado Pendiente. */
    const todosLosPlatosPendientes = pedido.platos.every(function(linea) {
        return linea.estado === 'Pendiente';
    });

    const sePuedeModificar = puedeModificar && pedido.estado === 'Activo' && todosLosPlatosPendientes;

    if (sePuedeModificar) {
        acciones = acciones +
            '<button type="button" class="boton boton-primario boton-pequeño boton-modificar-pedido" ' +
            'data-id-pedido="' + pedido.id + '">Modificar</button>';
    }

    return '<tr>' +
        '<td>' + pedido.numero + '</td>' +
        '<td>Mesa ' + numeroDeMesa + '</td>' +
        '<td>' + escaparHtml(pedido.fecha) + '</td>' +
        '<td>' + escaparHtml(pedido.hora) + '</td>' +
        '<td>' + pedido.platos.length + '</td>' +
        '<td>' + formatearMoneda(pedido.total) + '</td>' +
        '<td>' + crearEtiquetaDeEstado(pedido.estado) + '</td>' +
        '<td>' + acciones + '</td>' +
        '</tr>';
}

/**
 * Muestra el detalle completo de un pedido con todos sus platos.
 */
function abrirModalDeDetalleDePedido(idPedido) {
    const pedido = buscarPedidoPorId(idPedido);

    if (!pedido) {
        mostrarMensajeError('El pedido indicado no existe.');
        return;
    }

    const mesa = buscarMesaPorId(pedido.idMesa);
    const numeroDeMesa = mesa ? mesa.numero : '—';

    let filas = '';

    pedido.platos.forEach(function(linea) {
        filas = filas +
            '<tr>' +
            '<td>' + escaparHtml(linea.nombre) + '</td>' +
            '<td>' + linea.cantidad + '</td>' +
            '<td>' + formatearMoneda(linea.precioUnitario) + '</td>' +
            '<td>' + formatearMoneda(linea.subtotal) + '</td>' +
            '<td>' + crearEtiquetaDeEstado(linea.estado) + '</td>' +
            '</tr>';
    });

    const html = '<p class="texto-suave">Mesa ' + numeroDeMesa +
        ' · ' + escaparHtml(pedido.fecha) + ' · ' + escaparHtml(pedido.hora) + '</p>' +
        '<div class="tabla-contenedor">' +
        '<table class="tabla tabla-compacta">' +
        '<thead><tr><th>Plato</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th>Estado</th></tr></thead>' +
        '<tbody>' + filas + '</tbody>' +
        '</table></div>' +
        '<div class="total-pedido">Total: <strong>' + formatearMoneda(pedido.total) + '</strong></div>' +
        '<div class="modal-acciones">' +
        '<button type="button" class="boton boton-secundario" data-accion="cerrar">Cerrar</button>' +
        '</div>';

    abrirModal('Detalle del pedido N° ' + pedido.numero, html);
    conectarBotonesDeCierreDelModal(document.getElementById('contenido-modal'));
}

/**
 * Abre la ventana para crear un pedido o modificar uno existente.
 * @param {string|null} idPedido - null para crear uno nuevo.
 */
function abrirModalDePedido(idPedido) {
    const mesas = obtenerMesas();
    const platosDelMenu = obtenerPlatosDelMenu();

    idPedidoEnEdicion = idPedido;
    carritoActual = [];

    let pedidoExistente = null;

    if (idPedido !== null) {
        pedidoExistente = buscarPedidoPorId(idPedido);

        if (!pedidoExistente) {
            mostrarMensajeError('El pedido indicado no existe.');
            return;
        }

        carritoActual = construirElCarritoDeUnPedido(pedidoExistente);
    }

    let opcionesDeMesa = '';

    mesas.forEach(function(mesa) {
        if (pedidoExistente !== null) {
            const esLaMesaDelPedido = mesa.id === pedidoExistente.idMesa;

            if (esLaMesaDelPedido) {
                opcionesDeMesa = '<option value="' + mesa.id + '" selected disabled>Mesa ' + mesa.numero + '</option>';
            }
        } else {
            const estaOcupada = mesa.estado === 'Ocupada';
            const detalle = 'Mesa ' + mesa.numero + ' (' + mesa.capacidad + ' personas) - ' + mesa.estado;

            opcionesDeMesa = opcionesDeMesa +
                '<option value="' + mesa.id + '"' + (estaOcupada ? ' disabled' : '') + '>' +
                escaparHtml(detalle) +
                '</option>';
        }
    });

    if (idPedido === null) {
        opcionesDeMesa = '<option value="">Seleccione una mesa</option>' + opcionesDeMesa;
    }

    let opcionesDePlato = '';

    platosDelMenu.forEach(function(plato) {
        opcionesDePlato = opcionesDePlato +
            '<option value="' + plato.id + '">' +
            escaparHtml(plato.nombre) + ' - ' + formatearMoneda(plato.precio) +
            '</option>';
    });

    const tituloDelModal = idPedido !== null ? 'Modificar pedido' : 'Nuevo pedido';

    /* Al modificar un pedido la mesa queda bloqueada. */
    const mesaBloqueada = idPedido !== null ? ' disabled' : '';

    const html = '<form id="formulario-pedido">' +
        '<div class="campo">' +
        '<label for="select-mesa-pedido">Mesa</label>' +
        '<select id="select-mesa-pedido" required' + mesaBloqueada + '>' + opcionesDeMesa + '</select>' +
        '</div>' +
        '<div class="fila-agregar-plato">' +
        '<div class="campo">' +
        '<label for="select-plato-pedido">Plato</label>' +
        '<select id="select-plato-pedido">' + opcionesDePlato + '</select>' +
        '</div>' +
        '<div class="campo">' +
        '<label for="cantidad-plato-pedido">Cantidad</label>' +
        '<input type="number" id="cantidad-plato-pedido" min="1" max="50" value="1">' +
        '</div>' +
        '<button type="button" class="boton boton-secundario" id="boton-agregar-plato">Agregar</button>' +
        '</div>' +
        '<h4 class="seccion-titulo subtitulo-carrito">Platos del pedido</h4>' +
        '<div id="lista-carrito" class="lista-carrito"></div>' +
        '<div class="total-pedido">Total: <strong id="total-carrito">$0.00</strong></div>' +
        '<div class="modal-acciones">' +
        '<button type="button" class="boton boton-secundario" data-accion="cancelar">Cancelar</button>' +
        '<button type="submit" class="boton boton-primario">Guardar pedido</button>' +
        '</div>' +
        '</form>';

    abrirModal(tituloDelModal, html);

    const contenidoDelModal = document.getElementById('contenido-modal');
    conectarBotonesDeCierreDelModal(contenidoDelModal);
    actualizarVistaDelCarrito();

    document.getElementById('boton-agregar-plato')
        .addEventListener('click', agregarPlatoAlPedido);

    document.getElementById('formulario-pedido')
        .addEventListener('submit', guardarElPedido);
}

/**
 * Agrega un plato al carrito del pedido que se está construyendo.
 */
function agregarPlatoAlPedido() {
    const idPlatoMenu = document.getElementById('select-plato-pedido').value;
    const cantidad = document.getElementById('cantidad-plato-pedido').value;

    const resultado = agregarPlatoAlCarrito(carritoActual, idPlatoMenu, cantidad);

    if (!resultado.exito) {
        mostrarMensajeError(resultado.mensaje);
        return;
    }

    document.getElementById('cantidad-plato-pedido').value = '1';
    actualizarVistaDelCarrito();
}

/**
 * Vuelve a dibujar la lista de platos del carrito y su total.
 */
function actualizarVistaDelCarrito() {
    const contenedor = document.getElementById('lista-carrito');
    const totalElemento = document.getElementById('total-carrito');

    if (!contenedor || !totalElemento) {
        return;
    }

    recalcularSubtotalesDelCarrito(carritoActual);

    if (carritoActual.length === 0) {
        contenedor.innerHTML = '<div class="carrito-vacio">Todavía no hay platos en el pedido.</div>';
    } else {
        let html = '';

        carritoActual.forEach(function(item) {
            html = html +
                '<div class="fila-carrito">' +
                '<span>' + escaparHtml(item.nombre) + ' - ' + formatearMoneda(item.precioUnitario) + '</span>' +
                '<input type="number" class="entrada-cantidad-carrito" data-id-plato="' + item.idPlatoMenu + '" ' +
                'min="1" max="50" value="' + item.cantidad + '" aria-label="Cantidad de ' + escaparHtml(item.nombre) + '">' +
                '<span>' + formatearMoneda(item.subtotal) + '</span>' +
                '<button type="button" class="boton boton-peligro boton-pequeño boton-quitar-plato" ' +
                'data-id-plato="' + item.idPlatoMenu + '">Quitar</button>' +
                '</div>';
        });

        contenedor.innerHTML = html;
    }

    totalElemento.textContent = formatearMoneda(calcularTotalDelCarrito(carritoActual));

    conectarEventosDelCarrito();
}

/**
 * Conecta los eventos de cantidad y de quitar plato dentro
 * del carrito. Se llama después de cada actualización.
 */
function conectarEventosDelCarrito() {
    const contenidoDelModal = document.getElementById('contenido-modal');

    conectarBotones(contenidoDelModal, '.boton-quitar-plato', function(evento) {
        const idPlatoMenu = evento.currentTarget.getAttribute('data-id-plato');
        quitarPlatoDelCarrito(carritoActual, idPlatoMenu);
        actualizarVistaDelCarrito();
    });

    const entradasDeCantidad = contenidoDelModal.querySelectorAll('.entrada-cantidad-carrito');

    entradasDeCantidad.forEach(function(entrada) {
        entrada.addEventListener('change', function(evento) {
            const idPlatoMenu = evento.currentTarget.getAttribute('data-id-plato');
            const nuevaCantidad = evento.currentTarget.value;

            const resultado = cambiarCantidadDelPlatoEnElCarrito(carritoActual, idPlatoMenu, nuevaCantidad);

            if (!resultado.exito) {
                mostrarMensajeError(resultado.mensaje);
            }

            /* Se vuelve a dibujar para mostrar siempre un valor válido. */
            actualizarVistaDelCarrito();
        });
    });
}

/**
 * Guarda el pedido nuevo o las modificaciones del existente.
 */
function guardarElPedido(evento) {
    evento.preventDefault();

    const idMesa = document.getElementById('select-mesa-pedido').value;
    let resultado = null;

    if (idPedidoEnEdicion !== null) {
        resultado = actualizarPedido(idPedidoEnEdicion, carritoActual);
    } else {
        resultado = crearPedido(idMesa, carritoActual);
    }

    mostrarResultadoDeOperacion(resultado);

    if (resultado.exito) {
        cerrarModal();
        renderizarPedidos();
    }
}

/* =============================================================
   8. VISTA: COCINA
   ============================================================= */

function renderizarCocina() {
    const platos = obtenerPlatosEnCocina();
    const contenido = document.getElementById('contenido-principal');

    const pendientes = platos.filter(function(plato) {
        return plato.estado === 'Pendiente';
    });

    const enPreparacion = platos.filter(function(plato) {
        return plato.estado === 'En preparación';
    });

    const listos = platos.filter(function(plato) {
        return plato.estado === 'Listo';
    });

    let html = '<div class="fila-superior">' +
        '<h3 class="seccion-titulo">Platos en la cocina</h3>' +
        '</div>';

    html = html + '<div class="columnas-cocina">';
    html = html + crearColumnaDeCocina('Pendientes', pendientes, 'En preparación', 'Iniciar preparación', 'boton-primario');
    html = html + crearColumnaDeCocina('En preparación', enPreparacion, 'Listo', 'Marcar como listo', 'boton-exito');
    html = html + crearColumnaDeCocina('Listos', listos, null, null, null);
    html = html + '</div>';

    contenido.innerHTML = html;

    conectarBotones(contenido, '.boton-estado-plato', function(evento) {
        const boton = evento.currentTarget;

        const resultado = cambiarEstadoDePlato(
            boton.getAttribute('data-id-pedido'),
            boton.getAttribute('data-id-linea'),
            boton.getAttribute('data-nuevo-estado')
        );

        mostrarResultadoDeOperacion(resultado);

        if (resultado.exito) {
            renderizarCocina();
        }
    });
}

/**
 * Crea una columna de la vista de cocina con sus tarjetas.
 * @param {string|null} nuevoEstado - Estado al que lleva el botón.
 */
function crearColumnaDeCocina(titulo, listaDePlatos, nuevoEstado, textoDelBoton, claseDelBoton) {
    let html = '<div class="columna-cocina">' +
        '<div class="columna-cocina-titulo">' +
        '<strong>' + escaparHtml(titulo) + '</strong>' +
        '<span class="etiqueta etiqueta-gris">' + listaDePlatos.length + '</span>' +
        '</div>';

    if (listaDePlatos.length === 0) {
        html = html + '<div class="columna-vacia">No hay platos en esta columna.</div>';
    } else {
        listaDePlatos.forEach(function(plato) {
            html = html + crearTarjetaDePlato(plato, nuevoEstado, textoDelBoton, claseDelBoton);
        });
    }

    html = html + '</div>';

    return html;
}

function crearTarjetaDePlato(plato, nuevoEstado, textoDelBoton, claseDelBoton) {
    let html = '<div class="tarjeta-plato">' +
        '<div class="tarjeta-plato-cabecera">' +
        '<strong>' + escaparHtml(plato.nombre) + '</strong>' +
        crearEtiquetaDeEstado(plato.estado) +
        '</div>' +
        '<ul class="datos-plato">' +
        '<li><span>Cantidad</span><span>' + plato.cantidad + '</span></li>' +
        '<li><span>Pedido N°</span><span>' + plato.numeroPedido + '</span></li>' +
        '<li><span>Mesa</span><span>' + plato.numeroDeMesa + '</span></li>' +
        '<li><span>Hora</span><span>' + escaparHtml(plato.horaDelPedido) + '</span></li>' +
        '</ul>';

    if (nuevoEstado !== null) {
        html = html +
            '<div class="acciones-plato">' +
            '<button type="button" class="boton boton-pequeño ' + claseDelBoton + ' boton-estado-plato" ' +
            'data-id-pedido="' + plato.idPedido + '" ' +
            'data-id-linea="' + plato.idLinea + '" ' +
            'data-nuevo-estado="' + escaparHtml(nuevoEstado) + '">' +
            escaparHtml(textoDelBoton) +
            '</button>' +
            '</div>';
    }

    html = html + '</div>';

    return html;
}

/* =============================================================
   9. VISTA: DESPACHOS
   ============================================================= */

function renderizarDespachos() {
    const pedidosConPlatosListos = obtenerPedidosConPlatosListos();
    const despachos = obtenerDespachos();
    const puedeGestionar = usuarioTienePermiso('gestionarDespachos');
    const contenido = document.getElementById('contenido-principal');

    let html = '<h3 class="seccion-titulo">Platos listos para despachar</h3>';

    if (pedidosConPlatosListos.length === 0) {
        html = html + '<div class="panel"><p class="texto-suave">No hay platos listos pendientes de despacho.</p></div>';
    } else {
        pedidosConPlatosListos.forEach(function(pedidoListo) {
            html = html + crearTarjetaDePedidoListo(pedidoListo, puedeGestionar);
        });
    }

    html = html + '<h3 class="seccion-titulo separador-vista">Despachos registrados</h3>';

    if (despachos.length === 0) {
        html = html + '<div class="panel"><p class="texto-suave">Todavía no hay despachos registrados.</p></div>';
    } else {
        html = html + '<div class="tabla-contenedor"><table class="tabla">' +
            '<thead><tr>' +
            '<th>N°</th><th>Pedido</th><th>Mesa</th><th>Platos</th>' +
            '<th>Estado</th><th>Fecha</th><th>Hora</th><th>Acciones</th>' +
            '</tr></thead><tbody>';

        despachos.forEach(function(despacho) {
            html = html + crearFilaDeDespacho(despacho, puedeGestionar);
        });

        html = html + '</tbody></table></div>';
    }

    contenido.innerHTML = html;

    if (puedeGestionar) {
        conectarBotones(contenido, '.boton-crear-despacho', function(evento) {
            const idPedido = evento.currentTarget.getAttribute('data-id-pedido');
            abrirModalDeCreacionDeDespacho(idPedido);
        });

        conectarBotones(contenido, '.boton-estado-despacho', function(evento) {
            const boton = evento.currentTarget;

            const resultado = cambiarEstadoDeDespacho(
                boton.getAttribute('data-id-despacho'),
                boton.getAttribute('data-nuevo-estado')
            );

            mostrarResultadoDeOperacion(resultado);

            if (resultado.exito) {
                renderizarDespachos();
            }
        });
    }
}

function crearTarjetaDePedidoListo(pedidoListo, puedeGestionar) {
    let html = '<div class="tarjeta-despacho-listo">' +
        '<div class="cabecera-despacho">' +
        '<strong>Pedido N° ' + pedidoListo.numeroPedido + ' - Mesa ' + pedidoListo.numeroDeMesa + '</strong>' +
        crearEtiquetaDeEstado('Listo') +
        '</div>' +
        '<ul class="platos-listos">';

    pedidoListo.platosListos.forEach(function(linea) {
        html = html +
            '<li>' +
            '<span>' + escaparHtml(linea.nombre) + ' x ' + linea.cantidad + '</span>' +
            '<span>' + formatearMoneda(linea.subtotal) + '</span>' +
            '</li>';
    });

    html = html + '</ul>';

    if (puedeGestionar) {
        html = html +
            '<button type="button" class="boton boton-primario boton-crear-despacho" ' +
            'data-id-pedido="' + pedidoListo.idPedido + '">Crear despacho</button>';
    }

    html = html + '</div>';

    return html;
}

function crearFilaDeDespacho(despacho, puedeGestionar) {
    let nombresDePlatos = '';

    despacho.platos.forEach(function(linea) {
        if (nombresDePlatos !== '') {
            nombresDePlatos = nombresDePlatos + ', ';
        }

        nombresDePlatos = nombresDePlatos + linea.nombre + ' x' + linea.cantidad;
    });

    let acciones = '<span class="texto-suave">Sin acciones</span>';

    if (puedeGestionar && despacho.estado === 'Pendiente') {
        acciones = '<button type="button" class="boton boton-primario boton-pequeño boton-estado-despacho" ' +
            'data-id-despacho="' + despacho.id + '" data-nuevo-estado="En ruta">Iniciar ruta</button>';
    }

    if (puedeGestionar && despacho.estado === 'En ruta') {
        acciones = '<button type="button" class="boton boton-exito boton-pequeño boton-estado-despacho" ' +
            'data-id-despacho="' + despacho.id + '" data-nuevo-estado="Entregado">Marcar entregado</button>';
    }

    return '<tr>' +
        '<td>' + despacho.numero + '</td>' +
        '<td>N° ' + despacho.numeroDePedido + '</td>' +
        '<td>Mesa ' + despacho.numeroDeMesa + '</td>' +
        '<td>' + escaparHtml(nombresDePlatos) + '</td>' +
        '<td>' + crearEtiquetaDeEstado(despacho.estado) + '</td>' +
        '<td>' + escaparHtml(despacho.fecha) + '</td>' +
        '<td>' + escaparHtml(despacho.hora) + '</td>' +
        '<td>' + acciones + '</td>' +
        '</tr>';
}

/**
 * Abre la ventana para crear un despacho con los platos listos
 * de un pedido.
 */
function abrirModalDeCreacionDeDespacho(idPedido) {
    const pedido = buscarPedidoPorId(idPedido);

    if (!pedido) {
        mostrarMensajeError('El pedido indicado no existe.');
        return;
    }

    const platosListos = pedido.platos.filter(function(linea) {
        const sinDespacho = linea.idDespacho === null || linea.idDespacho === undefined;
        return linea.estado === 'Listo' && sinDespacho;
    });

    if (platosListos.length === 0) {
        mostrarMensajeError('Este pedido no tiene platos listos para despachar.');
        return;
    }

    const mesa = buscarMesaPorId(pedido.idMesa);
    const numeroDeMesa = mesa ? mesa.numero : '—';

    let casillas = '';

    platosListos.forEach(function(linea) {
        casillas = casillas +
            '<label class="opcion-lista">' +
            '<input type="checkbox" class="casilla-plato-despacho" value="' + linea.idLinea + '" checked> ' +
            '<span>' + escaparHtml(linea.nombre) + ' x ' + linea.cantidad +
            ' (' + formatearMoneda(linea.subtotal) + ')</span>' +
            '</label>';
    });

    const html = '<form id="formulario-despacho">' +
        '<p class="texto-suave">Pedido N° ' + pedido.numero + ' - Mesa ' + numeroDeMesa + '</p>' +
        '<fieldset>' +
        '<legend>Platos listos</legend>' +
        casillas +
        '</fieldset>' +
        '<div class="modal-acciones">' +
        '<button type="button" class="boton boton-secundario" data-accion="cancelar">Cancelar</button>' +
        '<button type="submit" class="boton boton-primario">Crear despacho</button>' +
        '</div>' +
        '</form>';

    abrirModal('Crear despacho', html);

    const contenidoDelModal = document.getElementById('contenido-modal');
    conectarBotonesDeCierreDelModal(contenidoDelModal);

    document.getElementById('formulario-despacho')
        .addEventListener('submit', function(evento) {
            evento.preventDefault();

            const casillasMarcadas = contenidoDelModal.querySelectorAll('.casilla-plato-despacho:checked');
            const idsDeLineas = [];

            casillasMarcadas.forEach(function(casilla) {
                idsDeLineas.push(casilla.value);
            });

            const resultado = crearDespacho(idPedido, idsDeLineas);
            mostrarResultadoDeOperacion(resultado);

            if (resultado.exito) {
                cerrarModal();
                renderizarDespachos();
            }
        });
}

/* =============================================================
   10. VISTA: USUARIOS
   ============================================================= */

function renderizarUsuarios() {
    const usuarios = obtenerUsuariosParaLaTabla();
    const puedeRestablecer = usuarioTienePermiso('restablecerDatos');
    const contenido = document.getElementById('contenido-principal');

    let html = '<div class="fila-superior">' +
        '<h3 class="seccion-titulo">Usuarios de demostración</h3>';

    if (puedeRestablecer) {
        html = html +
            '<button type="button" class="boton boton-peligro" id="boton-restablecer-datos">' +
            'Restablecer datos de demostración' +
            '</button>';
    }

    html = html + '</div>';

    html = html + '<div class="tabla-contenedor"><table class="tabla">' +
        '<thead><tr><th>Usuario</th><th>Nombre completo</th><th>Rol</th></tr></thead><tbody>';

    usuarios.forEach(function(usuario) {
        html = html +
            '<tr>' +
            '<td>' + escaparHtml(usuario.nombreUsuario) + '</td>' +
            '<td>' + escaparHtml(usuario.nombreCompleto) + '</td>' +
            '<td>' + crearEtiquetaDeEstado(usuario.rol) + '</td>' +
            '</tr>';
    });

    html = html + '</tbody></table></div>';

    html = html +
        '<div class="panel separador-vista">' +
        '<h3 class="seccion-titulo">Aviso de seguridad</h3>' +
        '<p class="texto-suave">Esta aplicación funciona sin backend. Las contraseñas, sesiones y permisos ' +
        'se validan en el navegador, por lo que no deben usarse como mecanismo de seguridad real. ' +
        'Para producción se necesita un servidor que verifique las credenciales y los permisos.</p>' +
        '</div>';

    contenido.innerHTML = html;

    if (puedeRestablecer) {
        document.getElementById('boton-restablecer-datos')
            .addEventListener('click', restablecerLosDatos);
    }
}

/**
 * Pide confirmación y restaura los datos iniciales.
 */
function restablecerLosDatos() {
    const confirmacion = confirm(
        '¿Está seguro de restablecer los datos de demostración?\n\n' +
        'Se eliminarán las reservas, pedidos y despachos creados.'
    );

    if (!confirmacion) {
        return;
    }

    const resultado = restablecerDatosDeDemostracion();
    mostrarResultadoDeOperacion(resultado);

    if (resultado.exito) {
        renderizarUsuarios();
    }
}
