    // js/supabase-init.js

    // Usar window para verificar si ya están definidas
    if (!window.SUPABASE_URL) {
        window.SUPABASE_URL = 'https://ogwkgukzodppwpuhkzpe.supabase.co';         // <-- ¡Reemplaza con tu URL!
    }
    
    if (!window.SUPABASE_ANON_KEY) {
        window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd2tndWt6b2RwcHdwdWhrenBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NjY1NTEsImV4cCI6MjA1OTU0MjU1MX0.PobZVi3cC_u6DdjoqkgEPtJ0weWTnrPwLoUO11PKX48'; // <-- ¡Reemplaza con tu Clave Anon!
    }

    // Verificar si el cliente ya existe
    if (!window.supabaseClient) {

    try {
        console.log("Iniciando configuración de Supabase...");

        // Verificar que las constantes estén definidas
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Faltan las credenciales de Supabase.');
        }

        // Verificar que los placeholders no se estén usando directamente (opcional pero recomendado)
        if (SUPABASE_URL === 'TU_SUPABASE_URL' || SUPABASE_ANON_KEY === 'TU_SUPABASE_ANON_KEY') {
            console.warn('Advertencia: Estás usando las credenciales placeholder de Supabase. Reemplázalas en js/supabase-init.js');
            // Podrías decidir lanzar un error aquí o permitir que continúe para pruebas iniciales
            // throw new Error('Reemplaza las credenciales placeholder de Supabase.');
        }

        // Crear el cliente de Supabase
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Cliente Supabase creado exitosamente");

        // Verificar la conexión inmediatamente
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Estado de autenticación cambiado:', event, session);
        });

        // Verificar si hay una sesión activa
        supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error('Error al verificar sesión:', error);
            } else {
                console.log('Estado de sesión inicial:', session ? 'Autenticado' : 'No autenticado');
            }
        });

    } catch (error) {
        console.error('Error inicializando Supabase:', error);
        // Podrías mostrar una notificación al usuario aquí si la inicialización falla
        // (Asegúrate que showNotification exista globalmente si la usas aquí)
        // if (typeof showNotification === 'function') {
        //    showNotification('Error crítico al conectar con el backend.', 'error');
        // }
        supabaseClient = null; // Asegurarse que esté nulo si falla
    }

    // Exponer el cliente para uso global
    window.supabaseClient = supabaseClient;
    window.supabase = supabaseClient; // Añadir alias compatible
}

    // Como estamos usando scripts simples sin módulos, la variable `supabaseClient`
    // estará disponible en el scope global para los scripts que se carguen DESPUÉS
    // de js/supabase-init.js en el HTML.