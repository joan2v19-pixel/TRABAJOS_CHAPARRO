/* =============================================================
   auth.js
   -------------------------------------------------------------
   Responsabilidades:
   - Inicio y cierre de sesión con usuario y contraseña.
   - Gestión de la sesión con tiempo de expiración.
   - Definición de roles y permisos.
   - Validación de permisos antes de cada operación.
   - Integración opcional con Google Identity Services.

   LIMITACIÓN DE SEGURIDAD IMPORTANTE:
   Esta aplicación no tiene backend. Por eso la sesión, los
   permisos y las contraseñas se controlan desde el navegador.
   La sesión y los datos se guardan cifrados, pero la clave de
   cifrado forma parte del código de la página, así que quien
   tenga el código fuente puede descifrarlos y alterarlos.
   Decodificar un JWT no equivale a verificar su firma.
   En producción se necesita un servidor que valide credenciales,
   contraseñas, sesiones y permisos.
   ============================================================= */

const CLAVE_SESION = 'sistemaReservasSesion';
const DURACION_SESION_EN_MINUTOS = 120;

/* Copia de trabajo de la sesión ya descifrada. Se carga al abrir
   la página con prepararLaSesion y se comprueba en cada consulta. */
let sesionEnMemoria = null;

/* ------------------------------------------------------------
   Configuración de Google (PENDIENTE DE COMPLETAR)
   - clientId: debe colocarse el Client ID de OAuth 2.0 que
     Google genera para esta aplicación. No se inventa ninguno.
   - Si queda vacío, el botón de Google no se dibuja.
   ------------------------------------------------------------ */
const CONFIGURACION_GOOGLE = {
    clientId: ''
};

/* ------------------------------------------------------------
   Lista de correos autorizados para ingresar con Google.
   Aquí se asigna el rol de forma explícita. El acceso con Google
   NUNCA otorga el rol de administrador de forma automática.
   Ejemplo de cómo completarla:
   [
       { correo: 'nombre@ejemplo.com', rol: 'Mesero' },
       { correo: 'otro@ejemplo.com', rol: 'Administrador' }
   ]
   ------------------------------------------------------------ */
const CORREOS_AUTORIZADOS_GOOGLE = [];

/* ------------------------------------------------------------
   Permisos permitidos para cada rol.
   ------------------------------------------------------------ */
const PERMISOS_POR_ROL = {
    'Administrador': [
        'verDashboard',
        'verMesas',
        'gestionarMesas',
        'verReservas',
        'crearReservas',
        'cancelarReservas',
        'verPedidos',
        'crearPedidos',
        'verCocina',
        'prepararPlatos',
        'verDespachos',
        'gestionarDespachos',
        'verUsuarios',
        'restablecerDatos'
    ],
    'Mesero': [
        'verMesas',
        'verReservas',
        'crearReservas',
        'cancelarReservas',
        'verPedidos',
        'crearPedidos',
        'verDespachos'
    ],
    'Cocina': [
        'verPedidos',
        'verCocina',
        'prepararPlatos'
    ],
    'Despacho': [
        'verDespachos',
        'gestionarDespachos'
    ]
};

/* =============================================================
   1. SESIÓN CON USUARIO Y CONTRASEÑA
   ============================================================= */

/**
 * Valida las credenciales y crea la sesión del usuario.
 * @returns {object} Resultado con propiedad "exito" y "mensaje".
 */
function iniciarSesion(nombreUsuario, contrasena) {
    const usuarioLimpio = String(nombreUsuario === undefined || nombreUsuario === null ? '' : nombreUsuario).trim();
    const contrasenaLimpia = String(contrasena === undefined || contrasena === null ? '' : contrasena);

    if (usuarioLimpio === '' || contrasenaLimpia === '') {
        return { exito: false, mensaje: 'Debe escribir el usuario y la contraseña.' };
    }

    if (usuarioLimpio.length > 50 || contrasenaLimpia.length > 100) {
        return { exito: false, mensaje: 'Los datos ingresados son demasiado largos.' };
    }

    const usuarios = obtenerUsuarios();

    const usuarioEncontrado = usuarios.find(function(usuario) {
        return usuario.nombreUsuario.toLowerCase() === usuarioLimpio.toLowerCase();
    });

    if (!usuarioEncontrado) {
        return { exito: false, mensaje: 'El usuario o la contraseña son incorrectos.' };
    }

    const hashIngresado = hashearTexto(contrasenaLimpia);

    if (usuarioEncontrado.contrasenaHash !== hashIngresado) {
        return { exito: false, mensaje: 'El usuario o la contraseña son incorrectos.' };
    }

    crearSesionDeUsuario(usuarioEncontrado);

    return { exito: true, mensaje: 'Sesión iniciada correctamente.' };
}

/**
 * Guarda los datos de la sesión en sessionStorage, cifrados,
 * con una fecha de expiración.
 */
function crearSesionDeUsuario(usuario) {
    const ahora = Date.now();

    const sesion = {
        nombreUsuario: usuario.nombreUsuario,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        origen: usuario.origen === undefined ? 'formulario' : usuario.origen,
        fechaInicio: ahora,
        fechaExpiracion: ahora + DURACION_SESION_EN_MINUTOS * 60 * 1000
    };

    sesionEnMemoria = sesion;
    guardarTextoCifrado(sessionStorage, CLAVE_SESION, JSON.stringify(sesion));
}

/**
 * Se ejecuta al abrir o recargar la página: descifra la sesión
 * guardada en sessionStorage y la deja en memoria. Si no existe
 * o está dañada, se elimina.
 */
function prepararLaSesion() {
    sesionEnMemoria = null;

    return leerTextoCifrado(sessionStorage, CLAVE_SESION)
        .then(function(textoDescifrado) {
            if (textoDescifrado === null || textoDescifrado === '') {
                return;
            }

            let sesionLeida = null;

            try {
                sesionLeida = JSON.parse(textoDescifrado);
            } catch (error) {
                sesionLeida = null;
            }

            if (esUnObjeto(sesionLeida) && typeof sesionLeida.rol === 'string') {
                sesionEnMemoria = sesionLeida;
            } else {
                sessionStorage.removeItem(CLAVE_SESION);
            }
        })
        .catch(function() {
            /* La sesión no se pudo descifrar: se elimina. */
            sessionStorage.removeItem(CLAVE_SESION);
            sesionEnMemoria = null;
        });
}

/**
 * Devuelve la sesión vigente en memoria. Si expiró, la elimina
 * del navegador y devuelve null.
 */
function obtenerSesionActual() {
    if (sesionEnMemoria === null) {
        return null;
    }

    if (typeof sesionEnMemoria.fechaExpiracion !== 'number'
        || Date.now() > sesionEnMemoria.fechaExpiracion) {
        cerrarSesion();
        return null;
    }

    return sesionEnMemoria;
}

/**
 * Elimina la sesión del usuario de la memoria y del navegador.
 * Funciona igual para el inicio de sesión con Google.
 */
function cerrarSesion() {
    sesionEnMemoria = null;
    sessionStorage.removeItem(CLAVE_SESION);
}

/* =============================================================
   2. ROLES Y PERMISOS
   ============================================================= */

/**
 * Devuelve la lista de permisos de un rol.
 */
function obtenerPermisosDeRol(rol) {
    const permisos = PERMISOS_POR_ROL[rol];

    if (!permisos) {
        return [];
    }

    return permisos;
}

/**
 * Comprueba si la sesión actual tiene un permiso.
 * Se debe llamar antes de ejecutar cualquier operación,
 * no solamente al dibujar el menú.
 */
function usuarioTienePermiso(permisoRequerido) {
    const sesion = obtenerSesionActual();

    if (sesion === null) {
        return false;
    }

    const permisos = obtenerPermisosDeRol(sesion.rol);

    return permisos.indexOf(permisoRequerido) !== -1;
}

/* =============================================================
   3. AUTENTICACIÓN CON GOOGLE IDENTITY SERVICES
   ============================================================= */

/**
 * Carga la librería oficial de Google solo cuando hace falta.
 */
function cargarScriptDeGoogle(funcionAlTerminar) {
    if (window.google && window.google.accounts) {
        funcionAlTerminar();
        return;
    }

    const scriptExistente = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

    if (scriptExistente) {
        scriptExistente.addEventListener('load', funcionAlTerminar);
        return;
    }

    const scriptDeGoogle = document.createElement('script');
    scriptDeGoogle.src = 'https://accounts.google.com/gsi/client';
    scriptDeGoogle.async = true;
    scriptDeGoogle.defer = true;

    scriptDeGoogle.onload = function() {
        funcionAlTerminar();
    };

    scriptDeGoogle.onerror = function() {
        mostrarMensajeError('No se pudo cargar la librería de Google. Revise su conexión a internet.');
    };

    document.head.appendChild(scriptDeGoogle);
}

/**
 * Dibuja el botón de Google dentro del contenedor indicado.
 * Si el Client_ID no está configurado, muestra un mensaje
 * indicando que falta la configuración.
 */
function configurarBotonGoogle(contenedor, funcionDeExito) {
    if (contenedor === null) {
        return;
    }

    if (CONFIGURACION_GOOGLE.clientId === '') {
        contenedor.innerHTML =
            '<p class="nota-configuracion">' +
            'Inicio de sesión con Google pendiente de configuración. ' +
            'Debe colocarse el Client ID en el archivo js/auth.js.' +
            '</p>';
        return;
    }

    cargarScriptDeGoogle(function() {
        window.google.accounts.id.initialize({
            client_id: CONFIGURACION_GOOGLE.clientId,
            callback: function(respuesta) {
                procesarTokenDeGoogle(respuesta, funcionDeExito);
            }
        });

        window.google.accounts.id.renderButton(contenedor, {
            theme: 'outline',
            size: 'large',
            text: 'continuar_con',
            width: 280
        });
    });
}

/**
 * Recibe la respuesta de Google y valida el token en dos pasos:
 * 1. Revisión local de emisor, audiencia y expiración.
 * 2. Verificación del token con el servicio de Google.
 */
function procesarTokenDeGoogle(respuesta, funcionDeExito) {
    if (!respuesta || typeof respuesta.credential !== 'string') {
        mostrarMensajeError('Google no devolvió un token válido.');
        return;
    }

    const datosDelToken = decodificarTokenJwt(respuesta.credential);
    const validacionLocal = validarDatosDelToken(datosDelToken);

    if (!validacionLocal.valido) {
        mostrarMensajeError(validacionLocal.mensaje);
        return;
    }

    verificarTokenConGoogle(respuesta.credential).then(function(resultado) {
        if (!resultado.verificado) {
            mostrarMensajeError(resultado.mensaje);
            return;
        }

        iniciarSesionConGoogle(datosDelToken, funcionDeExito);
    });
}

/**
 * Decodifica la parte de datos (payload) de un JWT.
 * IMPORTANTE: decodificar no significa verificar la firma.
 */
function decodificarTokenJwt(token) {
    const partes = token.split('.');

    if (partes.length !== 3) {
        return null;
    }

    let payload = partes[1].replace(/-/g, '+').replace(/_/g, '/');

    while (payload.length % 4 !== 0) {
        payload = payload + '=';
    }

    try {
        const textoCodificado = atob(payload);
        const bytes = Uint8Array.from(textoCodificado, function(caracter) {
            return caracter.charCodeAt(0);
        });
        const texto = new TextDecoder('utf-8').decode(bytes);
        return JSON.parse(texto);
    } catch (error) {
        return null;
    }
}

/**
 * Comprueba de forma local el emisor, la audiencia y la
 * expiración del token recibido.
 */
function validarDatosDelToken(datosDelToken) {
    if (!esUnObjeto(datosDelToken)) {
        return { valido: false, mensaje: 'El token de Google no tiene un formato válido.' };
    }

    if (CONFIGURACION_GOOGLE.clientId === '') {
        return { valido: false, mensaje: 'El inicio de sesión con Google está pendiente de configuración.' };
    }

    const emisoresPermitidos = ['https://accounts.google.com', 'accounts.google.com'];

    if (emisoresPermitidos.indexOf(datosDelToken.iss) === -1) {
        return { valido: false, mensaje: 'El token fue emitido por un origen no reconocido.' };
    }

    if (datosDelToken.aud !== CONFIGURACION_GOOGLE.clientId) {
        return { valido: false, mensaje: 'El token no fue emitido para esta aplicación.' };
    }

    const ahoraEnSegundos = Math.floor(Date.now() / 1000);

    if (typeof datosDelToken.exp !== 'number' || datosDelToken.exp <= ahoraEnSegundos) {
        return { valido: false, mensaje: 'El token de Google ha expirado. Vuelva a intentarlo.' };
    }

    if (typeof datosDelToken.email !== 'string' || datosDelToken.email.trim() === '') {
        return { valido: false, mensaje: 'El token no contiene un correo electrónico válido.' };
    }

    return { valido: true, mensaje: '' };
}

/**
 * Verifica el token contra el servicio de Google usando el
 * punto de verificación oficial de tokens de identidad.
 * Aun así, en producción la verificación debe hacerse en el
 * servidor con la librería oficial de Google.
 */
function verificarTokenConGoogle(token) {
    const urlDeVerificacion = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);

    return fetch(urlDeVerificacion)
        .then(function(respuesta) {
            if (!respuesta.ok) {
                return null;
            }

            return respuesta.json();
        })
        .then(function(datosDeGoogle) {
            if (!esUnObjeto(datosDeGoogle)) {
                return { verificado: false, mensaje: 'Google no pudo verificar el token recibido.' };
            }

            if (typeof datosDeGoogle.error === 'string') {
                return { verificado: false, mensaje: 'La verificación del token falló: ' + datosDeGoogle.error };
            }

            if (datosDeGoogle.aud !== CONFIGURACION_GOOGLE.clientId) {
                return { verificado: false, mensaje: 'El token verificado no corresponde a esta aplicación.' };
            }

            return { verificado: true, mensaje: '' };
        })
        .catch(function(error) {
            return {
                verificado: false,
                mensaje: 'No se pudo contactar con Google para verificar el token. Revise su conexión.'
            };
        });
}

/**
 * Asocia el correo del token con un rol autorizado y crea la
 * sesión. Si el correo no está en la lista, no se permite entrar.
 */
function iniciarSesionConGoogle(datosDelToken, funcionDeExito) {
    const correo = String(datosDelToken.email).toLowerCase().trim();

    const autorizacion = CORREOS_AUTORIZADOS_GOOGLE.find(function(item) {
        return item.correo === correo;
    });

    if (!autorizacion) {
        mostrarMensajeError('Su correo no tiene permisos para ingresar al sistema.');
        return;
    }

    if (!PERMISOS_POR_ROL[autorizacion.rol]) {
        mostrarMensajeError('El rol asignado a su correo no es válido.');
        return;
    }

    const usuarioDeGoogle = {
        id: generarIdentificador('USR'),
        nombreUsuario: correo,
        nombreCompleto: typeof datosDelToken.name === 'string' ? datosDelToken.name : correo,
        rol: autorizacion.rol,
        origen: 'google'
    };

    crearSesionDeUsuario(usuarioDeGoogle);

    mostrarMensajeExito('Sesión con Google iniciada correctamente.');

    if (typeof funcionDeExito === 'function') {
        funcionDeExito(obtenerSesionActual());
    }
}
