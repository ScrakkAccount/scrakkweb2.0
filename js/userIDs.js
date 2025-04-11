// js/userIDs.js - Sistema de IDs de usuario para Scrakk

/**
 * Sistema de IDs de usuario para Scrakk
 * Provee funcionalidades para:
 * - Generar y asignar IDs únicos a los usuarios
 * - Buscar usuarios por ID
 * - Validar formatos de ID
 */

// Función para generar un ID de usuario único (alfanumérico)
function generateUserID(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    // Prefijo "SCRAKK-" seguido de caracteres aleatorios
    result = 'SCRAKK-';
    
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
}

// Asignar un ID de usuario si no tiene uno
async function ensureUserHasID(userId) {
    try {
        if (!userId) {
            console.error("ID de usuario no proporcionado");
            return null;
        }
        
        console.log("Verificando ID para usuario:", userId);
        
        // Verificar si el usuario ya tiene un ID asignado - uso una consulta más simple
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('user_id')
            .eq('id', userId)
            .maybeSingle();
            
        if (error) {
            console.error("Error al verificar ID de usuario:", error);
            
            // Intentar crear un perfil si no existe
            if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
                return await createProfileWithID(userId);
            }
            
            return null;
        }
        
        // Si el usuario no tiene ID o es nulo, generar uno nuevo
        if (!data || !data.user_id) {
            return await createProfileWithID(userId);
        }
        
        console.log("ID de usuario encontrado:", data.user_id);
        return data.user_id;
    } catch (error) {
        console.error("Error inesperado al asegurar ID de usuario:", error);
        return null;
    }
}

// Función auxiliar para crear un perfil con ID
async function createProfileWithID(userId) {
    try {
        const newUserID = generateUserID();
        
        // Intentar crear un nuevo perfil
        const { data, error } = await supabaseClient
            .from('profiles')
            .upsert({ id: userId, user_id: newUserID })
            .select();
            
        if (error) {
            console.error("Error al crear perfil con ID:", error);
            return null;
        }
        
        console.log(`Nuevo ID asignado al usuario: ${newUserID}`);
        return newUserID;
    } catch (error) {
        console.error("Error al crear perfil con ID:", error);
        return null;
    }
}

// Buscar usuario por ID
async function findUserByID(userID) {
    try {
        if (!userID || typeof userID !== 'string') {
            console.error("ID de usuario inválido:", userID);
            return null;
        }
        
        console.log("Buscando usuario con ID:", userID);
        
        // Usar una consulta alternativa que evite problemas con caracteres especiales
        // Solo seleccionamos columnas que sabemos que existen
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, user_id');
            
        if (error) {
            console.error("Error al consultar perfiles:", error);
            return null;
        }
        
        // Filtrar manualmente para encontrar el usuario con el ID exacto
        const userData = data.find(profile => profile.user_id === userID);
        
        if (!userData) {
            console.log("No se encontró ningún usuario con el ID:", userID);
            return null;
        }
        
        return userData;
    } catch (error) {
        console.error("Error inesperado al buscar usuario por ID:", error);
        return null;
    }
}

// Validar formato de ID de usuario
function isValidUserID(userID) {
    if (!userID || typeof userID !== 'string') {
        return false;
    }
    
    // Formato esperado: SCRAKK-XXXXXXXX (donde X es cualquier carácter alfanumérico)
    const pattern = /^SCRAKK-[A-Za-z0-9]{8,}$/;
    return pattern.test(userID);
}

// Obtener el ID del usuario actual
async function getCurrentUserID() {
    try {
        // Obtener el usuario actual
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError || !user) {
            console.error("Error al obtener usuario actual:", userError);
            return null;
        }
        
        // Verificar y asegurar que tenga un ID
        return await ensureUserHasID(user.id);
    } catch (error) {
        console.error("Error inesperado al obtener ID de usuario actual:", error);
        return null;
    }
}

// Exponer funciones globalmente
window.userIDSystem = {
    generateUserID,
    ensureUserHasID,
    findUserByID,
    isValidUserID,
    getCurrentUserID
};
