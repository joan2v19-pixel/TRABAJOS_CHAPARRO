/* =============================================================
   modules.js
   -------------------------------------------------------------
   Responsabilidades:
   - Gestión de mesas.
   - Gestión de reservas.
   - Gestión de pedidos y carrito de platos.
   - Gestión de cocina (preparación de platos).
   - Gestión de despachos.
   - Generación de estadísticas.
   - Gestión de usuarios de demostración.

   Cada operación que modifica datos vuelve a comprobar los
   permisos del usuario antes de ejecutarse. No basta con
   ocultar los botones en la interfaz.
   ============================================================= */

/* =============================================================
   1. ESTADOS Y REGLAS GENERALES
   ============================================================= */

/* Duración estimada de una reserva para detectar conflictos. */
const DURACION_DE_LA_RESERVA_EN_MINUTOS = 120;

/* Estados posibles de una mesa. */
const ESTADOS_DE_MESA = ['Disponible', 'Reservada', 'Ocupada'];

/* Estados posibles de una reserva. */
const ESTADOS_DE_RESERVA = ['Confirmada', 'Cancelada', 'Finalizada'];

/* Estados de preparación de cada plato dentro de un pedido. */
const ESTADOS_DE_PLATO = ['Pendiente', 'En preparación', 'Listo', 'Entregado'];

/* Estados de un pedido. */
const ESTADOS_DE_PEDIDO = ['Activo', 'Completado'];

/* Estados de un despacho. */
const ESTADOS_DE_DESPACHO = ['Pendiente', 'En ruta', 'Entregado'];

/* Permite avanzar de un estado a otro. Si el estado no está
   en la lista, no admite más cambios. */
const TRANSICIONES_DE_PLATO = {
    'Pendiente': ['En preparación'],
    'En preparación': ['Listo'],
    'Listo': [],
    'Entregado': []
};

const TRANSICIONES_DE_DESPACHO = {
    'Pendiente': ['En ruta'],
    'En ruta': ['Entregado'],
    'Entregado': []
};

/* =============================================================
   2. VALIDACIONES BÁSICAS
   ============================================================= */

/**
 * Comprueba una fecha con formato AAAA-MM-DD y que exista
 * realmente en el calendario (por ejemplo, el 31 de febrero no).
 */
function esFechaValida(fecha) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

    if (!partes) {
        return false;
    }

    const anio = Number(partes[1]);
    const mes = Number(partes[2]);
    const dia = Number(partes[3]);

    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
        return false;
    }

    const fechaObjeto = new Date(anio, mes - 1, dia);

    return fechaObjeto.getFullYear() === anio
        && fechaObjeto.getMonth() === mes - 1
        && fechaObjeto.getDate() === dia;
}

/**
 * Comprueba una hora con formato HH:MM dentro del día.
 */
function esHoraValida(hora) {
    const partes = /^(\d{2}):(\d{2})$/.exec(hora);

    if (!partes) {
        return false;
    }

    const horas = Number(partes[1]);
    const minutos = Number(partes[2]);

    return horas >= 0 && horas <= 23 && minutos >= 0 && minutos <= 59;
}

/**
 * Convierte una hora "HH:MM" a minutos desde el inicio del día.
 */
function convertirHoraAMinutos(hora) {
    const partes = hora.split(':');
    const horas = Number(partes[0]);
    const minutos = Number(partes[1]);
    return horas * 60 + minutos;
}

/**
 * Comprueba si dos intervalos de tiempo se solapan.
 */
function haySolapamientoDeHorario(inicioA, duracionA, inicioB, duracionB) {
    const finA = inicioA + duracionA;
    const finB = inicioB + duracionB;
    return inicioA < finB && inicioB < finA;
}

/**
 * Redondea un importe a dos decimales para evitar errores
 * de precisión con los precios.
 */
function redondearImporte(valor) {
    return Math.round(valor * 100) / 100;
}

/* =============================================================
   3. MÓDULO DE MESAS
   ============================================================= */

/**
 * Busca una mesa por su identificador.
 */
function buscarMesaPorId(idMesa) {
    const mesas = obtenerMesas();

    const mesaEncontrada = mesas.find(function(mesa) {
        return mesa.id === idMesa;
    });

    return mesaEncontrada;
}

/**
 * Recalcula el estado de una mesa según la información actual:
 * - Ocupada: tiene un pedido activo.
 * - Reservada: tiene una reserva confirmada para hoy.
 * - Disponible: no tiene nada pendiente.
 */
function recalcularEstadoDeLaMesa(idMesa) {
    const mesas = obtenerMesas();

    const mesa = mesas.find(function(item) {
        return item.id === idMesa;
    });

    if (!mesa) {
        return;
    }

    const pedidos = obtenerPedidos();
    const reservas = obtenerReservas();
    const fechaDeHoy = obtenerFechaActual();

    const pedidoActivo = pedidos.find(function(pedido) {
        return pedido.idMesa === idMesa && pedido.estado === 'Activo';
    });

    if (pedidoActivo) {
        mesa.estado = 'Ocupada';
    } else {
        const reservaConfirmada = reservas.find(function(reserva) {
            return reserva.idMesa === idMesa
                && reserva.estado === 'Confirmada'
                && reserva.fecha === fechaDeHoy;
        });

        mesa.estado = reservaConfirmada ? 'Reservada' : 'Disponible';
    }

    guardarMesas(mesas);
}

/**
 * Permite al administrador cambiar capacidad o estado de una mesa.
 * El estado manual puede ser modificado después por las reservas
 * y los pedidos, que recalculan la mesa automáticamente.
 */
function actualizarMesa(idMesa, datosDeLaMesa) {
    if (!usuarioTienePermiso('gestionarMesas')) {
        return { exito: false, mensaje: 'No tiene permisos para modificar mesas.' };
    }

    if (!esUnObjeto(datosDeLaMesa)) {
        return { exito: false, mensaje: 'No se recibieron los datos de la mesa.' };
    }

    const capacidad = Number(datosDeLaMesa.capacidad);
    const estado = String(datosDeLaMesa.estado || '').trim();

    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 30) {
        return { exito: false, mensaje: 'La capacidad debe ser un número entero entre 1 y 30.' };
    }

    if (ESTADOS_DE_MESA.indexOf(estado) === -1) {
        return { exito: false, mensaje: 'El estado seleccionado no es válido.' };
    }

    const mesas = obtenerMesas();

    const mesa = mesas.find(function(item) {
        return item.id === idMesa;
    });

    if (!mesa) {
        return { exito: false, mensaje: 'La mesa indicada no existe.' };
    }

    mesa.capacidad = capacidad;
    mesa.estado = estado;
    guardarMesas(mesas);

    return { exito: true, mensaje: 'La mesa fue actualizada correctamente.' };
}

/* =============================================================
   4. MÓDULO DE RESERVAS
   ============================================================= */

/**
 * Revisa que una reserva no choque con otra de la misma mesa
 * en la misma fecha y con horarios solapados.
 */
function existeConflictoDeHorario(idMesa, fecha, hora) {
    const reservas = obtenerReservas();
    const inicioDeLaNuevaReserva = convertirHoraAMinutos(hora);

    const existeConflicto = reservas.some(function(reserva) {
        if (reserva.idMesa !== idMesa) {
            return false;
        }

        if (reserva.fecha !== fecha) {
            return false;
        }

        if (reserva.estado !== 'Confirmada') {
            return false;
        }

        const inicioDeLaReservaExistente = convertirHoraAMinutos(reserva.hora);

        return haySolapamientoDeHorario(
            inicioDeLaNuevaReserva,
            DURACION_DE_LA_RESERVA_EN_MINUTOS,
            inicioDeLaReservaExistente,
            DURACION_DE_LA_RESERVA_EN_MINUTOS
        );
    });

    return existeConflicto;
}

/**
 * Valida todos los datos de una reserva antes de guardarla.
 */
function validarReserva(datosDeLaReserva) {
    const nombreCliente = String(datosDeLaReserva.nombreCliente || '').trim();
    const idMesa = String(datosDeLaReserva.idMesa || '').trim();
    const fecha = String(datosDeLaReserva.fecha || '').trim();
    const hora = String(datosDeLaReserva.hora || '').trim();
    const cantidadPersonas = Number(datosDeLaReserva.cantidadPersonas);

    if (nombreCliente === '' || idMesa === '' || fecha === '' || hora === '') {
        return { valido: false, mensaje: 'Todos los campos de la reserva son obligatorios.' };
    }

    if (nombreCliente.length < 3 || nombreCliente.length > 60) {
        return { valido: false, mensaje: 'El nombre del cliente debe tener entre 3 y 60 caracteres.' };
    }

    if (!Number.isInteger(cantidadPersonas) || cantidadPersonas < 1) {
        return { valido: false, mensaje: 'La cantidad de personas debe ser un número entero mayor o igual a 1.' };
    }

    if (cantidadPersonas > 50) {
        return { valido: false, mensaje: 'La cantidad de personas no puede superar los 50.' };
    }

    if (!esFechaValida(fecha)) {
        return { valido: false, mensaje: 'La fecha no es válida. Use el formato AAAA-MM-DD.' };
    }

    if (fecha < obtenerFechaActual()) {
        return { valido: false, mensaje: 'No se pueden crear reservas con fechas pasadas.' };
    }

    if (!esHoraValida(hora)) {
        return { valido: false, mensaje: 'La hora no es válida. Use el formato HH:MM.' };
    }

    const mesa = buscarMesaPorId(idMesa);

    if (!mesa) {
        return { valido: false, mensaje: 'La mesa seleccionada no existe.' };
    }

    if (mesa.estado === 'Ocupada') {
        return { valido: false, mensaje: 'La mesa ' + mesa.numero + ' está ocupada y no puede reservarse.' };
    }

    if (cantidadPersonas > mesa.capacidad) {
        return {
            valido: false,
            mensaje: 'La mesa ' + mesa.numero + ' solo tiene capacidad para ' + mesa.capacidad + ' personas.'
        };
    }

    if (existeConflictoDeHorario(idMesa, fecha, hora)) {
        return {
            valido: false,
            mensaje: 'Ya existe una reserva para la mesa ' + mesa.numero + ' en ese horario.'
        };
    }

    return { valido: true, mensaje: '' };
}

/**
 * Crea una reserva si todas las validaciones son correctas.
 */
function crearReserva(datosDeLaReserva) {
    if (!usuarioTienePermiso('crearReservas')) {
        return { exito: false, mensaje: 'No tiene permisos para crear reservas.' };
    }

    if (!esUnObjeto(datosDeLaReserva)) {
        return { exito: false, mensaje: 'No se recibieron los datos de la reserva.' };
    }

    const reservaNormalizada = {
        nombreCliente: String(datosDeLaReserva.nombreCliente || '').trim(),
        idMesa: String(datosDeLaReserva.idMesa || '').trim(),
        fecha: String(datosDeLaReserva.fecha || '').trim(),
        hora: String(datosDeLaReserva.hora || '').trim(),
        cantidadPersonas: Number(datosDeLaReserva.cantidadPersonas)
    };

    const validacion = validarReserva(reservaNormalizada);

    if (!validacion.valido) {
        return { exito: false, mensaje: validacion.mensaje };
    }

    const reservas = obtenerReservas();

    const nuevaReserva = {
        id: generarIdentificador('RES'),
        nombreCliente: reservaNormalizada.nombreCliente,
        idMesa: reservaNormalizada.idMesa,
        fecha: reservaNormalizada.fecha,
        hora: reservaNormalizada.hora,
        cantidadPersonas: reservaNormalizada.cantidadPersonas,
        estado: 'Confirmada',
        fechaDeCreacion: new Date().toISOString()
    };

    reservas.push(nuevaReserva);
    guardarReservas(reservas);
    recalcularEstadoDeLaMesa(nuevaReserva.idMesa);

    return {
        exito: true,
        mensaje: 'La reserva fue creada correctamente.',
        reserva: nuevaReserva
    };
}

/**
 * Cancela una reserva que todavía esté confirmada y
 * recalcula el estado de su mesa.
 */
function cancelarReserva(idReserva) {
    if (!usuarioTienePermiso('cancelarReservas')) {
        return { exito: false, mensaje: 'No tiene permisos para cancelar reservas.' };
    }

    const reservas = obtenerReservas();

    const reserva = reservas.find(function(item) {
        return item.id === idReserva;
    });

    if (!reserva) {
        return { exito: false, mensaje: 'La reserva indicada no existe.' };
    }

    if (reserva.estado !== 'Confirmada') {
        return { exito: false, mensaje: 'Solo se pueden cancelar reservas confirmadas.' };
    }

    reserva.estado = 'Cancelada';
    guardarReservas(reservas);
    recalcularEstadoDeLaMesa(reserva.idMesa);

    return { exito: true, mensaje: 'La reserva fue cancelada correctamente.' };
}

/**
 * Marca como finalizadas las reservas confirmadas de hoy de una
 * mesa. Se ejecuta cuando se crea un pedido para esa mesa, es
 * decir, cuando los clientes llegan a sentarse.
 */
function finalizarReservasDeLaMesa(idMesa) {
    const reservas = obtenerReservas();
    const fechaDeHoy = obtenerFechaActual();
    let cantidadDeCambios = 0;

    reservas.forEach(function(reserva) {
        const esReservaDeHoy = reserva.fecha === fechaDeHoy;
        const estaConfirmada = reserva.estado === 'Confirmada';

        if (reserva.idMesa === idMesa && esReservaDeHoy && estaConfirmada) {
            reserva.estado = 'Finalizada';
            cantidadDeCambios = cantidadDeCambios + 1;
        }
    });

    if (cantidadDeCambios > 0) {
        guardarReservas(reservas);
    }
}

/**
 * Devuelve las últimas reservas creadas, de la más reciente a la
 * más antigua, para el panel principal.
 */
function obtenerReservasRecientes(cantidad) {
    const reservas = obtenerReservas();
    return reservas.slice(-cantidad).reverse();
}

/* =============================================================
   5. MÓDULO DE PEDIDOS
   ============================================================= */

/**
 * Busca un plato del menú por su identificador.
 */
function buscarPlatoDelMenuPorId(idPlatoMenu) {
    const platos = obtenerPlatosDelMenu();

    const platoEncontrado = platos.find(function(plato) {
        return plato.id === idPlatoMenu;
    });

    return platoEncontrado;
}

/**
 * Busca un pedido por su identificador.
 */
function buscarPedidoPorId(idPedido) {
    const pedidos = obtenerPedidos();

    const pedidoEncontrado = pedidos.find(function(pedido) {
        return pedido.id === idPedido;
    });

    return pedidoEncontrado;
}

/**
 * Calcula el total sumando los subtotales de cada línea.
 */
function calcularTotalDePlatos(listaDePlatos) {
    let total = 0;

    listaDePlatos.forEach(function(plato) {
        total = total + plato.subtotal;
    });

    return redondearImporte(total);
}

/**
 * Agrega un plato al carrito. Si ya existe, suma la cantidad.
 * Los precios siempre se tomen del menú, nunca del formulario.
 */
function agregarPlatoAlCarrito(carrito, idPlatoMenu, cantidad) {
    const platoDelMenu = buscarPlatoDelMenuPorId(idPlatoMenu);

    if (!platoDelMenu) {
        return { exito: false, mensaje: 'El plato seleccionado no existe en el menú.' };
    }

    const cantidadNumerica = Number(cantidad);

    if (!Number.isInteger(cantidadNumerica) || cantidadNumerica < 1 || cantidadNumerica > 50) {
        return { exito: false, mensaje: 'La cantidad debe ser un número entero entre 1 y 50.' };
    }

    const platoExistente = carrito.find(function(item) {
        return item.idPlatoMenu === idPlatoMenu;
    });

    if (platoExistente) {
        const nuevaCantidad = platoExistente.cantidad + cantidadNumerica;

        if (nuevaCantidad > 50) {
            return { exito: false, mensaje: 'La cantidad máxima de un mismo plato es 50.' };
        }

        platoExistente.cantidad = nuevaCantidad;
    } else {
        carrito.push({
            idPlatoMenu: idPlatoMenu,
            nombre: platoDelMenu.nombre,
            precioUnitario: platoDelMenu.precio,
            cantidad: cantidadNumerica
        });
    }

    recalcularSubtotalesDelCarrito(carrito);

    return { exito: true, mensaje: 'Plato agregado al pedido.' };
}

/**
 * Cambia la cantidad de un plato ya agregado al carrito.
 */
function cambiarCantidadDelPlatoEnElCarrito(carrito, idPlatoMenu, nuevaCantidad) {
    const platoExistente = carrito.find(function(item) {
        return item.idPlatoMenu === idPlatoMenu;
    });

    if (!platoExistente) {
        return { exito: false, mensaje: 'El plato no está en el pedido.' };
    }

    const cantidadNumerica = Number(nuevaCantidad);

    if (!Number.isInteger(cantidadNumerica) || cantidadNumerica < 1 || cantidadNumerica > 50) {
        return { exito: false, mensaje: 'La cantidad debe ser un número entero entre 1 y 50.' };
    }

    platoExistente.cantidad = cantidadNumerica;
    recalcularSubtotalesDelCarrito(carrito);

    return { exito: true, mensaje: 'Cantidad actualizada.' };
}

/**
 * Elimina un plato del carrito.
 */
function quitarPlatoDelCarrito(carrito, idPlatoMenu) {
    const posicion = carrito.findIndex(function(item) {
        return item.idPlatoMenu === idPlatoMenu;
    });

    if (posicion === -1) {
        return { exito: false, mensaje: 'El plato no está en el pedido.' };
    }

    carrito.splice(posicion, 1);

    return { exito: true, mensaje: 'Plato eliminado del pedido.' };
}

/**
 * Recalcula el subtotal de cada plato del carrito.
 */
function recalcularSubtotalesDelCarrito(carrito) {
    carrito.forEach(function(item) {
        item.subtotal = redondearImporte(item.precioUnitario * item.cantidad);
    });
}

/**
 * Devuelve la suma de los subtotales del carrito.
 */
function calcularTotalDelCarrito(carrito) {
    let total = 0;

    carrito.forEach(function(item) {
        total = total + (item.subtotal || 0);
    });

    return redondearImporte(total);
}

/**
 * Valida la lista de platos antes de crear o actualizar un pedido.
 */
function validarListaDePlatos(listaDePlatos) {
    if (!esUnaLista(listaDePlatos) || listaDePlatos.length === 0) {
        return { valido: false, mensaje: 'Debe agregar al menos un plato al pedido.' };
    }

    if (listaDePlatos.length > 30) {
        return { valido: false, mensaje: 'Un pedido no puede tener más de 30 líneas de platos.' };
    }

    for (let indice = 0; indice < listaDePlatos.length; indice++) {
        const item = listaDePlatos[indice];
        const cantidad = Number(item.cantidad);
        const platoDelMenu = buscarPlatoDelMenuPorId(item.idPlatoMenu);

        if (!platoDelMenu) {
            return { valido: false, mensaje: 'Uno de los platos seleccionados no existe en el menú.' };
        }

        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) {
            return {
                valido: false,
                mensaje: 'La cantidad del plato "' + platoDelMenu.nombre + '" no es válida.'
            };
        }
    }

    return { valido: true, mensaje: '' };
}

/**
 * Convierte los datos del carrito en las líneas definitivas del
 * pedido, con precio y subtotal tomados del menú.
 */
function construirPlatosDelPedido(listaDePlatos) {
    const listaConstruida = [];

    listaDePlatos.forEach(function(item) {
        const platoDelMenu = buscarPlatoDelMenuPorId(item.idPlatoMenu);
        const cantidad = Number(item.cantidad);

        listaConstruida.push({
            idLinea: generarIdentificador('LIN'),
            idPlatoMenu: platoDelMenu.id,
            nombre: platoDelMenu.nombre,
            cantidad: cantidad,
            precioUnitario: platoDelMenu.precio,
            subtotal: redondearImporte(platoDelMenu.precio * cantidad),
            estado: 'Pendiente',
            idDespacho: null
        });
    });

    return listaConstruida;
}

/**
 * Valida que la mesa esté apta para recibir un pedido.
 */
function validarMesaParaPedido(idMesa) {
    if (String(idMesa || '').trim() === '') {
        return { valido: false, mensaje: 'Debe seleccionar una mesa.' };
    }

    const mesa = buscarMesaPorId(idMesa);

    if (!mesa) {
        return { valido: false, mensaje: 'La mesa seleccionada no existe.' };
    }

    if (mesa.estado === 'Ocupada') {
        return {
            valido: false,
            mensaje: 'La mesa ' + mesa.numero + ' ya tiene un pedido activo.'
        };
    }

    return { valido: true, mensaje: '' };
}

/**
 * Crea un pedido para una mesa con la lista de platos indicada.
 */
function crearPedido(idMesa, listaDePlatos) {
    if (!usuarioTienePermiso('crearPedidos')) {
        return { exito: false, mensaje: 'No tiene permisos para crear pedidos.' };
    }

    const validacionDeMesa = validarMesaParaPedido(idMesa);

    if (!validacionDeMesa.valido) {
        return { exito: false, mensaje: validacionDeMesa.mensaje };
    }

    const validacionDePlatos = validarListaDePlatos(listaDePlatos);

    if (!validacionDePlatos.valido) {
        return { exito: false, mensaje: validacionDePlatos.mensaje };
    }

    const platosConstruidos = construirPlatosDelPedido(listaDePlatos);

    const nuevoPedido = {
        id: generarIdentificador('PED'),
        numero: obtenerSiguienteNumero('pedidos'),
        idMesa: idMesa,
        fecha: obtenerFechaActual(),
        hora: obtenerHoraActual(),
        platos: platosConstruidos,
        total: calcularTotalDePlatos(platosConstruidos),
        estado: 'Activo',
        fechaDeCreacion: new Date().toISOString()
    };

    const pedidos = obtenerPedidos();
    pedidos.push(nuevoPedido);
    guardarPedidos(pedidos);

    /* Si había una reserva de hoy para esa mesa, los clientes
       ya se sentaron, así que se finaliza la reserva. */
    finalizarReservasDeLaMesa(idMesa);
    recalcularEstadoDeLaMesa(idMesa);

    return {
        exito: true,
        mensaje: 'El pedido N° ' + nuevoPedido.numero + ' fue creado correctamente.',
        pedido: nuevoPedido
    };
}

/**
 * Carga los platos pendientes de un pedido dentro del carrito
 * para poder modificarlos.
 */
function construirElCarritoDeUnPedido(pedido) {
    const carrito = [];

    pedido.platos.forEach(function(linea) {
        if (linea.estado === 'Pendiente') {
            carrito.push({
                idPlatoMenu: linea.idPlatoMenu,
                nombre: linea.nombre,
                precioUnitario: linea.precioUnitario,
                cantidad: linea.cantidad,
                subtotal: linea.subtotal
            });
        }
    });

    return carrito;
}

/**
 * Actualiza los platos de un pedido. Solo se permite mientras
 * ningún plato haya salido del estado "Pendiente".
 */
function actualizarPedido(idPedido, listaDePlatos) {
    if (!usuarioTienePermiso('crearPedidos')) {
        return { exito: false, mensaje: 'No tiene permisos para modificar pedidos.' };
    }

    const pedido = buscarPedidoPorId(idPedido);

    if (!pedido) {
        return { exito: false, mensaje: 'El pedido indicado no existe.' };
    }

    if (pedido.estado !== 'Activo') {
        return { exito: false, mensaje: 'Solo se pueden modificar pedidos activos.' };
    }

    const platosEnPreparacion = pedido.platos.filter(function(linea) {
        return linea.estado !== 'Pendiente';
    });

    if (platosEnPreparacion.length > 0) {
        return {
            exito: false,
            mensaje: 'Este pedido ya tiene platos en preparación y no puede modificarse.'
        };
    }

    const validacionDePlatos = validarListaDePlatos(listaDePlatos);

    if (!validacionDePlatos.valido) {
        return { exito: false, mensaje: validacionDePlatos.mensaje };
    }

    const platosConstruidos = construirPlatosDelPedido(listaDePlatos);

    pedido.platos = platosConstruidos;
    pedido.total = calcularTotalDePlatos(platosConstruidos);
    guardarPedidos(obtenerPedidosConElPedidoActualizado(pedido));

    return { exito: true, mensaje: 'El pedido fue actualizado correctamente.' };
}

/**
 * Devuelve la lista completa de pedidos con uno de ellos ya
 * reemplazado por la versión modificada.
 */
function obtenerPedidosConElPedidoActualizado(pedidoActualizado) {
    const pedidos = obtenerPedidos();

    const listaActualizada = pedidos.map(function(pedido) {
        if (pedido.id === pedidoActualizado.id) {
            return pedidoActualizado;
        }

        return pedido;
    });

    return listaActualizada;
}

/**
 * Consulta los últimos pedidos creados, del más reciente al más
 * antiguo, para el panel principal.
 */
function obtenerPedidosRecientes(cantidad) {
    const pedidos = obtenerPedidos();
    return pedidos.slice(-cantidad).reverse();
}

/* =============================================================
   6. MÓDULO DE COCINA
   ============================================================= */

/**
 * Devuelve todos los platos que todavía pasan por la cocina
 * (pendientes, en preparación o listos) junto con los datos
 * del pedido al que pertenecen.
 */
function obtenerPlatosEnCocina() {
    const pedidos = obtenerPedidos();
    const platosEnCocina = [];

    pedidos.forEach(function(pedido) {
        const mesa = buscarMesaPorId(pedido.idMesa);
        const numeroDeMesa = mesa ? mesa.numero : '—';

        pedido.platos.forEach(function(linea) {
            if (linea.estado !== 'Entregado') {
                platosEnCocina.push({
                    idPedido: pedido.id,
                    numeroPedido: pedido.numero,
                    idMesa: pedido.idMesa,
                    numeroDeMesa: numeroDeMesa,
                    horaDelPedido: pedido.hora,
                    idLinea: linea.idLinea,
                    nombre: linea.nombre,
                    cantidad: linea.cantidad,
                    estado: linea.estado
                });
            }
        });
    });

    return platosEnCocina;
}

/**
 * Cambia el estado de un plato siguiendo la secuencia:
 * Pendiente -> En preparación -> Listo.
 * El cambio se guarda dentro del pedido correspondiente.
 */
function cambiarEstadoDePlato(idPedido, idLinea, nuevoEstado) {
    if (!usuarioTienePermiso('prepararPlatos')) {
        return { exito: false, mensaje: 'No tiene permisos para gestionar la cocina.' };
    }

    if (ESTADOS_DE_PLATO.indexOf(nuevoEstado) === -1) {
        return { exito: false, mensaje: 'El estado indicado no es válido.' };
    }

    const pedidos = obtenerPedidos();

    const pedido = pedidos.find(function(item) {
        return item.id === idPedido;
    });

    if (!pedido) {
        return { exito: false, mensaje: 'El pedido indicado no existe.' };
    }

    const linea = pedido.platos.find(function(item) {
        return item.idLinea === idLinea;
    });

    if (!linea) {
        return { exito: false, mensaje: 'El plato indicado no existe en el pedido.' };
    }

    const estadosPermitidos = TRANSICIONES_DE_PLATO[linea.estado] || [];

    if (estadosPermitidos.indexOf(nuevoEstado) === -1) {
        return {
            exito: false,
            mensaje: 'No se puede pasar de "' + linea.estado + '" a "' + nuevoEstado + '".'
        };
    }

    linea.estado = nuevoEstado;
    guardarPedidos(pedidos);

    return {
        exito: true,
        mensaje: 'El plato "' + linea.nombre + '" ahora está en estado "' + nuevoEstado + '".'
    };
}

/* =============================================================
   7. MÓDULO DE DESPACHOS
   ============================================================= */

/**
 * Devuelve los pedidos que tienen platos listos y todavía no
 * asignados a ningún despacho.
 */
function obtenerPedidosConPlatosListos() {
    const pedidos = obtenerPedidos();
    const resultado = [];

    pedidos.forEach(function(pedido) {
        const platosListos = pedido.platos.filter(function(linea) {
            const sinDespacho = linea.idDespacho === null || linea.idDespacho === undefined;
            return linea.estado === 'Listo' && sinDespacho;
        });

        if (platosListos.length > 0) {
            const mesa = buscarMesaPorId(pedido.idMesa);

            resultado.push({
                idPedido: pedido.id,
                numeroPedido: pedido.numero,
                numeroDeMesa: mesa ? mesa.numero : '—',
                platosListos: platosListos
            });
        }
    });

    return resultado;
}

/**
 * Crea un despacho con los platos listos seleccionados de un
 * pedido. No se permite crear despachos sin platos listos.
 */
function crearDespacho(idPedido, idsDeLineasSeleccionadas) {
    if (!usuarioTienePermiso('gestionarDespachos')) {
        return { exito: false, mensaje: 'No tiene permisos para crear despachos.' };
    }

    if (!esUnaLista(idsDeLineasSeleccionadas) || idsDeLineasSeleccionadas.length === 0) {
        return { exito: false, mensaje: 'Debe seleccionar al menos un plato listo.' };
    }

    if (idsDeLineasSeleccionadas.length > 30) {
        return { exito: false, mensaje: 'Un despacho no puede llevar más de 30 líneas de platos.' };
    }

    const pedido = buscarPedidoPorId(idPedido);

    if (!pedido) {
        return { exito: false, mensaje: 'El pedido indicado no existe.' };
    }

    /* Primero se comprueba que todas las líneas seleccionadas
       sean válidas. Si una sola falla, no se guarda nada. */
    for (let indice = 0; indice < idsDeLineasSeleccionadas.length; indice++) {
        const idLinea = idsDeLineasSeleccionadas[indice];

        const linea = pedido.platos.find(function(item) {
            return item.idLinea === idLinea;
        });

        if (!linea) {
            return { exito: false, mensaje: 'Uno de los platos seleccionados no existe en el pedido.' };
        }

        if (linea.estado !== 'Listo') {
            return { exito: false, mensaje: 'El plato "' + linea.nombre + '" todavía no está listo.' };
        }

        if (linea.idDespacho !== null && linea.idDespacho !== undefined) {
            return { exito: false, mensaje: 'El plato "' + linea.nombre + '" ya pertenece a otro despacho.' };
        }
    }

    const idDelDespacho = generarIdentificador('DES');

    const platosDelDespacho = [];

    pedido.platos.forEach(function(linea) {
        if (idsDeLineasSeleccionadas.indexOf(linea.idLinea) !== -1) {
            platosDelDespacho.push({
                idLinea: linea.idLinea,
                nombre: linea.nombre,
                cantidad: linea.cantidad,
                precioUnitario: linea.precioUnitario,
                subtotal: linea.subtotal
            });
        }
    });

    const mesa = buscarMesaPorId(pedido.idMesa);

    const nuevoDespacho = {
        id: idDelDespacho,
        numero: obtenerSiguienteNumero('despachos'),
        idPedido: pedido.id,
        numeroDePedido: pedido.numero,
        idMesa: pedido.idMesa,
        numeroDeMesa: mesa ? mesa.numero : '—',
        platos: platosDelDespacho,
        estado: 'Pendiente',
        fecha: obtenerFechaActual(),
        hora: obtenerHoraActual(),
        fechaDeCreacion: new Date().toISOString()
    };

    /* Se marca cada línea como parte de este despacho para que
       no pueda entregarse dos veces. */
    pedido.platos.forEach(function(linea) {
        if (idsDeLineasSeleccionadas.indexOf(linea.idLinea) !== -1) {
            linea.idDespacho = idDelDespacho;
        }
    });

    guardarPedidos(obtenerPedidosConElPedidoActualizado(pedido));

    const despachos = obtenerDespachos();
    despachos.push(nuevoDespacho);
    guardarDespachos(despachos);

    return {
        exito: true,
        mensaje: 'El despacho N° ' + nuevoDespacho.numero + ' fue creado correctamente.',
        despacho: nuevoDespacho
    };
}

/**
 * Cambia el estado de un despacho: Pendiente -> En ruta ->
 * Entregado. Al entregarlo se marcan sus platos y se revisa
 * si el pedido queda completado.
 */
function cambiarEstadoDeDespacho(idDespacho, nuevoEstado) {
    if (!usuarioTienePermiso('gestionarDespachos')) {
        return { exito: false, mensaje: 'No tiene permisos para gestionar despachos.' };
    }

    if (ESTADOS_DE_DESPACHO.indexOf(nuevoEstado) === -1) {
        return { exito: false, mensaje: 'El estado indicado no es válido.' };
    }

    const despachos = obtenerDespachos();

    const despacho = despachos.find(function(item) {
        return item.id === idDespacho;
    });

    if (!despacho) {
        return { exito: false, mensaje: 'El despacho indicado no existe.' };
    }

    const estadosPermitidos = TRANSICIONES_DE_DESPACHO[despacho.estado] || [];

    if (estadosPermitidos.indexOf(nuevoEstado) === -1) {
        return {
            exito: false,
            mensaje: 'No se puede pasar de "' + despacho.estado + '" a "' + nuevoEstado + '".'
        };
    }

    despacho.estado = nuevoEstado;
    guardarDespachos(despachos);

    if (nuevoEstado === 'Entregado') {
        marcarLineasComoEntregadas(despacho);
    }

    return {
        exito: true,
        mensaje: 'El despacho N° ' + despacho.numero + ' ahora está "' + nuevoEstado + '".'
    };
}

/**
 * Marca como entregados los platos del pedido que formaban parte
 * de un despacho, y recalcula el pedido y la mesa.
 */
function marcarLineasComoEntregadas(despacho) {
    const pedidos = obtenerPedidos();

    const pedido = pedidos.find(function(item) {
        return item.id === despacho.idPedido;
    });

    if (!pedido) {
        return;
    }

    let huboCambios = false;

    pedido.platos.forEach(function(linea) {
        if (linea.idDespacho === despacho.id) {
            linea.estado = 'Entregado';
            huboCambios = true;
        }
    });

    if (!huboCambios) {
        return;
    }

    const todosEntregados = pedido.platos.every(function(linea) {
        return linea.estado === 'Entregado';
    });

    pedido.estado = todosEntregados ? 'Completado' : 'Activo';

    guardarPedidos(pedidos);
    recalcularEstadoDeLaMesa(pedido.idMesa);
}

/* =============================================================
   8. ESTADÍSTICAS DEL PANEL PRINCIPAL
   ============================================================= */

/**
 * Calcula los cuatro indicadores del panel principal usando
 * los datos guardados en LocalStorage.
 */
function obtenerEstadisticas() {
    const reservas = obtenerReservas();
    const pedidos = obtenerPedidos();
    const despachos = obtenerDespachos();
    const mesas = obtenerMesas();
    const fechaDeHoy = obtenerFechaActual();

    let reservasDeHoy = 0;
    reservas.forEach(function(reserva) {
        if (reserva.fecha === fechaDeHoy && reserva.estado === 'Confirmada') {
            reservasDeHoy = reservasDeHoy + 1;
        }
    });

    /* Cuenta los platos que todavía requieren trabajo de cocina:
       pendientes y en preparación. */
    let platosPendientes = 0;
    pedidos.forEach(function(pedido) {
        pedido.platos.forEach(function(linea) {
            if (linea.estado === 'Pendiente' || linea.estado === 'En preparación') {
                platosPendientes = platosPendientes + 1;
            }
        });
    });

    let despachosActivos = 0;
    despachos.forEach(function(despacho) {
        if (despacho.estado !== 'Entregado') {
            despachosActivos = despachosActivos + 1;
        }
    });

    let mesasOcupadas = 0;
    mesas.forEach(function(mesa) {
        if (mesa.estado === 'Ocupada') {
            mesasOcupadas = mesasOcupadas + 1;
        }
    });

    return {
        reservasDeHoy: reservasDeHoy,
        platosPendientes: platosPendientes,
        despachosActivos: despachosActivos,
        mesasOcupadas: mesasOcupadas
    };
}

/* =============================================================
   9. USUARIOS DE DEMOSTRACIÓN
   ============================================================= */

/**
 * Devuelve los usuarios sin incluir el hash de la contraseña.
 * La contraseña nunca debe mostrarse en la interfaz.
 */
function obtenerUsuariosParaLaTabla() {
    const usuarios = obtenerUsuarios();

    return usuarios.map(function(usuario) {
        return {
            nombreUsuario: usuario.nombreUsuario,
            nombreCompleto: usuario.nombreCompleto,
            rol: usuario.rol
        };
    });
}

/**
 * Restaura todos los datos iniciales: usuarios, mesas, menú,
 * reservas, pedidos y despachos.
 */
function restablecerDatosDeDemostracion() {
    if (!usuarioTienePermiso('restablecerDatos')) {
        return { exito: false, mensaje: 'No tiene permisos para restablecer los datos.' };
    }

    const datosNuevos = crearDatosDeDemostracion();
    guardarDatosCompletos(datosNuevos);

    return { exito: true, mensaje: 'Los datos de demostración fueron restablecidos.' };
}
