/* =============================================================
   storage.js
   -------------------------------------------------------------
   Responsabilidades:
   - Inicializar y restablecer los datos de demostración.
   - Cifrar y descifrar la información guardada en el navegador.
   - Guardar, consultar, actualizar y eliminar información.
   - Validar la estructura de los datos recuperados.
   - Generar identificadores y números consecutivos.
   - Crear un hash simple de contraseñas (solo demostración).

   Todo se guarda cifrado en LocalStorage bajo una única clave.
   ============================================================= */

const CLAVE_ALMACENAMIENTO = 'sistemaReservasRestaurante';

/* =============================================================
   1. UTILIDADES GENERALES
   ============================================================= */

/**
 * Comprueba si un valor es una lista (arreglo).
 */
function esUnaLista(valor) {
    return Array.isArray(valor);
}

/**
 * Comprueba si un valor es un objeto simple (no nulo ni arreglo).
 */
function esUnObjeto(valor) {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Devuelve la fecha de hoy en formato AAAA-MM-DD.
 * Se usa para validar reservas y para el campo min de los formularios.
 */
function obtenerFechaActual() {
    const fechaDeHoy = new Date();
    const anio = fechaDeHoy.getFullYear();
    const mes = String(fechaDeHoy.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaDeHoy.getDate()).padStart(2, '0');
    return anio + '-' + mes + '-' + dia;
}

/**
 * Devuelve la hora actual en formato HH:MM.
 */
function obtenerHoraActual() {
    const fechaDeHoy = new Date();
    const horas = String(fechaDeHoy.getHours()).padStart(2, '0');
    const minutos = String(fechaDeHoy.getMinutes()).padStart(2, '0');
    return horas + ':' + minutos;
}

/**
 * Crea un identificador único combinando un prefijo,
 * la hora actual y un número aleatorio.
 */
function generarIdentificador(prefijo) {
    const marcaDeTiempo = Date.now();
    const numeroAleatorio = Math.floor(Math.random() * 1000000);
    return prefijo + '-' + marcaDeTiempo + '-' + numeroAleatorio;
}

/* =============================================================
   2. CIFRADO DE LA INFORMACIÓN GUARDADA
   ============================================================= */

/* Clave de cifrado de la aplicación (AES-GCM de 256 bits).

   ADVERTENCIA DE SEGURIDAD:
   Esta clave vive en el código de la página porque el proyecto no
   tiene backend. El cifrado evita que se lean o se modifiquen de
   forma casual los datos desde las herramientas del navegador
   (ya no se guarda texto plano), pero cualquier persona que tenga
   el código fuente puede descifrarlos. En producción, la clave y
   el descifrado deben residir en el servidor, nunca en el cliente. */
const CLAVE_DE_CIFRADO_DE_LA_APLICACION = 'RAfLN8tcnApPVf7xRMndop1o0mIsBySLI1p3cKxExUM=';

/* Copia de trabajo de los datos ya descifrados. Toda la aplicación
   lee y modifica esta copia; al guardarla se vuelve a cifrar. */
let datosEnMemoria = null;

/* Cola de escrituras: conserva el orden cuando se producen varios
   guardados muy seguidos (el cifrado es asíncrono). */
let colaDeEscrituras = Promise.resolve();

/**
 * Comprueba que el navegador disponga de la API Web Crypto,
 * necesaria para cifrar y descifrar.
 */
function elCifradoEstaDisponible() {
    return typeof crypto !== 'undefined'
        && crypto !== null
        && typeof crypto.subtle !== 'undefined'
        && crypto.subtle !== null;
}

/**
 * Convierte una lista de bytes en texto Base64.
 */
function convertirBytesABase64(bytes) {
    let texto = '';

    for (let posicion = 0; posicion < bytes.length; posicion++) {
        texto = texto + String.fromCharCode(bytes[posicion]);
    }

    return btoa(texto);
}

/**
 * Convierte texto Base64 en una lista de bytes.
 * Lanza un error si el texto no es Base64 válido.
 */
function convertirBase64ABytes(texto) {
    const textoDecodificado = atob(texto);
    const listaDeBytes = [];

    for (let posicion = 0; posicion < textoDecodificado.length; posicion++) {
        listaDeBytes.push(textoDecodificado.charCodeAt(posicion));
    }

    return new Uint8Array(listaDeBytes);
}

/**
 * Prepara la clave de la aplicación para usarla con AES-GCM.
 */
function importarLaClaveDeCifrado() {
    const bytesDeLaClave = convertirBase64ABytes(CLAVE_DE_CIFRADO_DE_LA_APLICACION);

    return crypto.subtle.importKey(
        'raw',
        bytesDeLaClave,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Cifra un texto con AES-GCM y devuelve "iv.cifrado" en Base64.
 * Se usa un vector de inicio aleatorio en cada guardado para que
 * dos textos iguales no produzcan el mismo resultado.
 */
function cifrarTexto(textoPlano) {
    if (!elCifradoEstaDisponible()) {
        return Promise.reject(new Error('El navegador no permite cifrar la información.'));
    }

    const vectorDeInicio = crypto.getRandomValues(new Uint8Array(12));

    return importarLaClaveDeCifrado()
        .then(function(clave) {
            const bytesDelTexto = new TextEncoder().encode(textoPlano);

            return crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: vectorDeInicio },
                clave,
                bytesDelTexto
            );
        })
        .then(function(bufferCifrado) {
            const textoDelVector = convertirBytesABase64(vectorDeInicio);
            const textoCifrado = convertirBytesABase64(new Uint8Array(bufferCifrado));
            return textoDelVector + '.' + textoCifrado;
        });
}

/**
 * Descifra un texto con formato "iv.cifrado" en Base64.
 * Si el contenido está dañado o fue alterado, se rechaza la
 * promesa (GCM detecta cualquier modificación).
 */
function descifrarTexto(textoCifrado) {
    const partes = String(textoCifrado).split('.');

    if (partes.length !== 2) {
        return Promise.reject(new Error('El contenido guardado no tiene un formato válido.'));
    }

    let vectorDeInicio = null;
    let bytesCifrados = null;

    try {
        vectorDeInicio = convertirBase64ABytes(partes[0]);
        bytesCifrados = convertirBase64ABytes(partes[1]);
    } catch (error) {
        return Promise.reject(new Error('El contenido guardado está dañado.'));
    }

    return importarLaClaveDeCifrado()
        .then(function(clave) {
            return crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: vectorDeInicio },
                clave,
                bytesCifrados
            );
        })
        .then(function(bufferDescifrado) {
            return new TextDecoder().decode(bufferDescifrado);
        });
}

/**
 * Cifra un texto y lo escribe en el navegador (puede ser
 * LocalStorage o SessionStorage). Las escrituras se encadenan en
 * una cola para conservar el orden de los cambios.
 * Devuelve una promesa que nunca se rechaza: si falla, se avisa
 * al usuario y la cola queda lista para el siguiente guardado.
 */
function guardarTextoCifrado(almacenamiento, clave, textoPlano) {
    colaDeEscrituras = colaDeEscrituras
        .then(function() {
            return cifrarTexto(textoPlano);
        })
        .then(function(textoCifrado) {
            almacenamiento.setItem(clave, textoCifrado);
        })
        .catch(function() {
            avisarQueNoSePudoGuardar();
        });

    return colaDeEscrituras;
}

/**
 * Lee y descifra un texto del navegador. Devuelve null cuando
 * todavía no existe nada guardado con esa clave.
 */
function leerTextoCifrado(almacenamiento, clave) {
    const textoCifrado = almacenamiento.getItem(clave);

    if (textoCifrado === null || textoCifrado === '') {
        return Promise.resolve(null);
    }

    return descifrarTexto(textoCifrado);
}

/**
 * Avisa al usuario si un guardado falló (navegador sin cifrado o
 * memoria del navegador llena). Si la interfaz todavía no está
 * disponible, se omite el aviso.
 */
function avisarQueNoSePudoGuardar() {
    try {
        if (typeof mostrarMensajeError === 'function') {
            mostrarMensajeError('No se pudo guardar la información cifrada en el navegador.');
        }
    } catch (error) {
        /* La interfaz aún no está lista: se omite el aviso. */
    }
}

/**
 * Convierte el texto descifrado en el objeto de datos de la
 * aplicación. Si el texto no existe o no es válido, devuelve los
 * datos de demostración.
 */
function convertirElTextoEnDatos(textoDescifrado) {
    if (textoDescifrado === null || textoDescifrado === '') {
        return crearDatosDeDemostracion();
    }

    let datosLeidos = null;

    try {
        datosLeidos = JSON.parse(textoDescifrado);
    } catch (error) {
        datosLeidos = null;
    }

    if (!validarEstructuraDatos(datosLeidos)) {
        return crearDatosDeDemostracion();
    }

    return datosLeidos;
}

/**
 * Se ejecita una sola vez al abrir la aplicación: descifra los
 * datos guardados y los deja en memoria. Si no existen, están
 * corruptos o no se pueden descifrar, se crean los de
 * demostración y se guardan cifrados.
 */
function prepararElAlmacenamiento() {
    if (!elCifradoEstaDisponible()) {
        return Promise.reject(new Error('El navegador no permite cifrar la información.'));
    }

    return leerTextoCifrado(localStorage, CLAVE_ALMACENAMIENTO)
        .then(function(textoDescifrado) {
            datosEnMemoria = convertirElTextoEnDatos(textoDescifrado);
        })
        .catch(function() {
            /* El contenido no se pudo descifrar: se generan datos
               nuevos para poder utilizar la aplicación. */
            datosEnMemoria = crearDatosDeDemostracion();
        })
        .then(function() {
            return guardarDatosCompletos(datosEnMemoria);
        });
}

/* =============================================================
   3. HASH DE CONTRASEÑAS (DEMOSTRACIÓN)
   ============================================================= */

/**
 * Genera un hash de 32 caracteres para el texto recibido.
 *
 * ADVERTENCIA DE SEGURIDAD:
 * Este hash se ejecuta dentro del navegador, no usa una clave
 * secreta y puede ser reproducido fuera de la aplicación. Sirve
 * únicamente para que las contraseñas no queden en texto plano
 * durante una demostración. En producción es obligatorio guardar
 * las contraseñas en un backend con algoritmos lentos y con sal,
 * como bcrypt, scrypt o argon2.
 */
function hashearTexto(texto) {
    const listaDeSemillas = [2166136261, 374761393, 668265263, 2246822519];
    let resultado = '';

    for (let posicion = 0; posicion < listaDeSemillas.length; posicion++) {
        let valorHash = listaDeSemillas[posicion];
        const textoConSal = 'sistemaReservas::' + posicion + '::' + String(texto);

        for (let indice = 0; indice < textoConSal.length; indice++) {
            valorHash = (valorHash ^ textoConSal.charCodeAt(indice)) >>> 0;
            valorHash = Math.imul(valorHash, 16777619) >>> 0;
        }

        resultado = resultado + valorHash.toString(16).padStart(8, '0');
    }

    return resultado;
}

/* =============================================================
   4. DATOS DE DEMOSTRACIÓN
   ============================================================= */

/**
 * Crea la lista de usuarios de prueba con sus contraseñas ya hasheadas.
 */
function crearUsuariosDeDemostracion() {
    return [
        {
            id: generarIdentificador('USR'),
            nombreUsuario: 'admin',
            contrasenaHash: hashearTexto('admin123'),
            nombreCompleto: 'Administrador del Sistema',
            rol: 'Administrador'
        },
        {
            id: generarIdentificador('USR'),
            nombreUsuario: 'mesero',
            contrasenaHash: hashearTexto('mesero123'),
            nombreCompleto: 'Mesero de Prueba',
            rol: 'Mesero'
        },
        {
            id: generarIdentificador('USR'),
            nombreUsuario: 'cocina',
            contrasenaHash: hashearTexto('cocina123'),
            nombreCompleto: 'Personal de Cocina',
            rol: 'Cocina'
        },
        {
            id: generarIdentificador('USR'),
            nombreUsuario: 'despacho',
            contrasenaHash: hashearTexto('despacho123'),
            nombreCompleto: 'Personal de Despacho',
            rol: 'Despacho'
        }
    ];
}

/**
 * Crea ocho mesas precargadas con distinta capacidad.
 * Todas comienzan disponibles.
 */
function crearMesasDeDemostracion() {
    const capacidades = [2, 2, 4, 4, 4, 6, 6, 8];
    const listaDeMesas = [];

    for (let indice = 0; indice < capacidades.length; indice++) {
        const mesa = {
            id: generarIdentificador('MESA'),
            numero: indice + 1,
            capacidad: capacidades[indice],
            estado: 'Disponible'
        };
        listaDeMesas.push(mesa);
    }

    return listaDeMesas;
}

/**
 * Crea ocho platos del menú con nombre, precio y descripción.
 */
function crearPlatosDeDemostracion() {
    return [
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Ensalada César',
            precio: 6.50,
            descripcion: 'Lechuga, pollo, crutones y aderezo César.'
        },
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Sopa del Día',
            precio: 5.00,
            descripcion: 'Sopa caliente preparada con ingredientes frescos.'
        },
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Lomo al Horno',
            precio: 12.90,
            descripcion: 'Lomo de res al horno con papas y vegetales.'
        },
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Pollo a la Parrilla',
            precio: 10.50,
            descripcion: 'Pechuga de pollo a la parrilla con arroz y ensalada.'
        },
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Pasta Alfredo',
            precio: 9.75,
            descripcion: 'Pasta con salsa Alfredo y queso parmesano.'
        },
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Pescado al Ajillo',
            precio: 13.20,
            descripcion: 'Filete de pescado al ajillo con guarnición.'
        },
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Postre de Chocolate',
            precio: 4.50,
            descripcion: 'Bizcocho de chocolate con salsa tibia.'
        },
        {
            id: generarIdentificador('PLATO'),
            nombre: 'Jugo Natural',
            precio: 3.00,
            descripcion: 'Jugo de frutas natural preparado al momento.'
        }
    ];
}

/**
 * Arma la estructura completa de datos con la información inicial.
 */
function crearDatosDeDemostracion() {
    return {
        version: 1,
        contadores: {
            pedidos: 0,
            despachos: 0
        },
        usuarios: crearUsuariosDeDemostracion(),
        mesas: crearMesasDeDemostracion(),
        platosDelMenu: crearPlatosDeDemostracion(),
        reservas: [],
        pedidos: [],
        despachos: []
    };
}

/* =============================================================
   5. VALIDACIÓN DE LA ESTRUCTURA
   ============================================================= */

/**
 * Comprueba que todos los elementos de una lista contengan
 * las propiedades indicadas. Evita leer datos corruptos.
 */
function todosLosElementosTienenPropiedades(lista, propiedadesRequeridas) {
    for (let indice = 0; indice < lista.length; indice++) {
        const elemento = lista[indice];

        if (!esUnObjeto(elemento)) {
            return false;
        }

        for (let posicion = 0; posicion < propiedadesRequeridas.length; posicion++) {
            const propiedad = propiedadesRequeridas[posicion];
            if (!(propiedad in elemento)) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Valida que los datos recuperados de LocalStorage tengan
 * la forma esperada por la aplicación.
 */
function validarEstructuraDatos(datos) {
    if (!esUnObjeto(datos)) {
        return false;
    }

    if (!esUnaLista(datos.usuarios) || datos.usuarios.length === 0) {
        return false;
    }

    if (!esUnaLista(datos.mesas)) {
        return false;
    }

    if (!esUnaLista(datos.platosDelMenu) || datos.platosDelMenu.length === 0) {
        return false;
    }

    if (!esUnaLista(datos.reservas) || !esUnaLista(datos.pedidos) || !esUnaLista(datos.despachos)) {
        return false;
    }

    if (!esUnObjeto(datos.contadores)) {
        return false;
    }

    if (!todosLosElementosTienenPropiedades(datos.usuarios, ['nombreUsuario', 'contrasenaHash', 'rol'])) {
        return false;
    }

    if (!todosLosElementosTienenPropiedades(datos.mesas, ['numero', 'capacidad', 'estado'])) {
        return false;
    }

    if (!todosLosElementosTienenPropiedades(datos.platosDelMenu, ['nombre', 'precio', 'descripcion'])) {
        return false;
    }

    return true;
}

/* =============================================================
   6. GUARDAR Y CONSULTAR LA INFORMACIÓN
   ============================================================= */

/**
 * Consulta todos los datos de la aplicación. Se trabaja sobre la
 * copia en memoria que descifró prepararElAlmacenamiento al abrir
 * la página; los cambios se cifran de nuevo al guardarlos.
 */
function obtenerDatosCompletos() {
    if (datosEnMemoria === null) {
        /* Solo ocurre si la aplicación aún no se inicializó. */
        datosEnMemoria = crearDatosDeDemostracion();
    }

    return datosEnMemoria;
}

/**
 * Guarda el objeto completo de datos: se deja en memoria y se
 * escribe cifrado en LocalStorage.
 */
function guardarDatosCompletos(datos) {
    datosEnMemoria = datos;
    return guardarTextoCifrado(localStorage, CLAVE_ALMACENAMIENTO, JSON.stringify(datos));
}

/**
 * Consulta la lista de usuarios.
 */
function obtenerUsuarios() {
    return obtenerDatosCompletos().usuarios;
}

/**
 * Reemplaza la lista de usuarios.
 */
function guardarUsuarios(listaDeUsuarios) {
    const datos = obtenerDatosCompletos();
    datos.usuarios = listaDeUsuarios;
    guardarDatosCompletos(datos);
}

/**
 * Consulta la lista de mesas.
 */
function obtenerMesas() {
    return obtenerDatosCompletos().mesas;
}

/**
 * Reemplaza la lista de mesas.
 */
function guardarMesas(listaDeMesas) {
    const datos = obtenerDatosCompletos();
    datos.mesas = listaDeMesas;
    guardarDatosCompletos(datos);
}

/**
 * Consulta los platos del menú.
 */
function obtenerPlatosDelMenu() {
    return obtenerDatosCompletos().platosDelMenu;
}

/**
 * Reemplaza la lista de platos del menú.
 */
function guardarPlatosDelMenu(listaDePlatos) {
    const datos = obtenerDatosCompletos();
    datos.platosDelMenu = listaDePlatos;
    guardarDatosCompletos(datos);
}

/**
 * Consulta la lista de reservas.
 */
function obtenerReservas() {
    return obtenerDatosCompletos().reservas;
}

/**
 * Reemplaza la lista de reservas.
 */
function guardarReservas(listaDeReservas) {
    const datos = obtenerDatosCompletos();
    datos.reservas = listaDeReservas;
    guardarDatosCompletos(datos);
}

/**
 * Consulta la lista de pedidos.
 */
function obtenerPedidos() {
    return obtenerDatosCompletos().pedidos;
}

/**
 * Reemplaza la lista de pedidos.
 */
function guardarPedidos(listaDePedidos) {
    const datos = obtenerDatosCompletos();
    datos.pedidos = listaDePedidos;
    guardarDatosCompletos(datos);
}

/**
 * Consulta la lista de despachos.
 */
function obtenerDespachos() {
    return obtenerDatosCompletos().despachos;
}

/**
 * Reemplaza la lista de despachos.
 */
function guardarDespachos(listaDeDespachos) {
    const datos = obtenerDatosCompletos();
    datos.despachos = listaDeDespachos;
    guardarDatosCompletos(datos);
}

/**
 * Aumenta y devuelve el número consecutivo de pedidos o despachos.
 * @param {string} tipoDeDato - 'pedidos' o 'despachos'.
 */
function obtenerSiguienteNumero(tipoDeDato) {
    const datos = obtenerDatosCompletos();

    if (typeof datos.contadores[tipoDeDato] !== 'number') {
        datos.contadores[tipoDeDato] = 0;
    }

    datos.contadores[tipoDeDato] = datos.contadores[tipoDeDato] + 1;
    guardarDatosCompletos(datos);

    return datos.contadores[tipoDeDato];
}
