// js/db-setup.js - Configuración inicial de la base de datos

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar que Supabase esté inicializado
    if (!window.supabaseClient) {
        console.error('No se ha inicializado Supabase. Asegúrate de cargar supabase-init.js antes.');
        return;
    }
    
    console.log('Verificando esquema de base de datos...');
    
    try {
        // Primero, verificar si la extensión pgcrypto está disponible
        // (necesaria para generar UUIDs)
        try {
            await supabaseClient.rpc('check_pgcrypto_extension');
        } catch (err) {
            // Si falla, probablemente la función RPC no existe, lo cual es esperado
            console.log('No se pudo verificar pgcrypto (esperado si la función RPC no existe)');
        }
        
        // Verificar y crear la tabla de perfiles si no existe
        try {
            // Intenta obtener un registro de la tabla profiles
            const { error: profilesError } = await supabaseClient
                .from('profiles')
                .select('id')
                .limit(1);
                
            if (profilesError) {
                console.warn('Error al verificar tabla de perfiles:', profilesError);
                
                // Si ocurre un error, intentamos crear la tabla
                console.log('Intentando crear la tabla de perfiles...');
                try {
                    // Supabase en realidad no permite crear tablas via API directamente,
                    // pero podemos usar SQL a través de un procedimiento almacenado
                    // o guiar al usuario para que lo haga manualmente
                    console.warn('No se puede crear la tabla profiles automáticamente.');
                    console.warn('Por favor, accede al panel de Supabase y crea la tabla profiles con los siguientes campos:');
                    console.warn('- id (UUID, PRIMARY KEY)');
                    console.warn('- user_id (VARCHAR)');
                    console.warn('- username (VARCHAR)');
                    console.warn('- full_name (VARCHAR)');
                    console.warn('- bio (TEXT)');
                    console.warn('- avatar_url (VARCHAR)');
                    console.warn('- status (VARCHAR)');
                    console.warn('- created_at (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())');
                    console.warn('- updated_at (TIMESTAMP WITH TIME ZONE)');
                } catch (createError) {
                    console.error('Error al intentar crear tabla:', createError);
                }
            } else {
                console.log('Tabla de perfiles existe.');
            }
        } catch (error) {
            console.error('Error al verificar tabla de perfiles:', error);
        }
        
        // Verificar si la columna user_id existe en la tabla profiles
        try {
            const { data: userIdColumn, error: columnError } = await supabaseClient
                .rpc('check_column_exists', { 
                    p_table_name: 'profiles', 
                    p_column_name: 'user_id' 
                });
                
            if (columnError) {
                console.warn('Error al verificar columna user_id:', columnError);
                console.warn('Si la columna no existe, crea la columna user_id (VARCHAR) en la tabla profiles.');
            } else if (!userIdColumn) {
                console.warn('La columna user_id no existe en la tabla profiles.');
                console.warn('Por favor, añade la columna user_id (VARCHAR) a la tabla profiles.');
            } else {
                console.log('La columna user_id existe en la tabla profiles.');
            }
        } catch (error) {
            // La función RPC probablemente no existe, lo cual es esperado
            console.log('No se pudo verificar la columna user_id (esperado si la función RPC no existe)');
        }
        
        console.log('Verificación de esquema completada.');
        
    } catch (error) {
        console.error('Error durante la verificación del esquema:', error);
    }
});
