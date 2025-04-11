// js/userIDs.js - Sistema de IDs de usuario para Scrakk

/**
 * Sistema de IDs de usuario para Scrakk
 * Provee funcionalidades para:
 * - Generar y asignar IDs únicos a los usuarios
 * - Buscar usuarios por ID
 * - Validar formatos de ID
 * - Regenerar IDs de usuario
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

// Regenerar y actualizar el ID de un usuario existente
async function regenerateUserID(userId) {
    try {
        if (!userId) {
            console.error("ID de usuario no proporcionado para regeneración");
            return { success: false, message: "ID de usuario no proporcionado" };
        }
        
        console.log("Regenerando ID para usuario:", userId);
        
        // Verificar relaciones existentes que dependen del ID antiguo
        // 1. Obtener ID actual
        const { data: profileData, error: profileError } = await supabaseClient
            .from('profiles')
            .select('user_id')
            .eq('id', userId)
            .single();
            
        if (profileError) {
            console.error("Error al obtener perfil para regeneración de ID:", profileError);
            return { success: false, message: "Error al obtener perfil de usuario" };
        }
        
        const oldUserID = profileData.user_id;
        if (!oldUserID) {
            return { success: false, message: "El usuario no tiene un ID asignado actualmente" };
        }
        
        // 2. Verificar si el usuario tiene solicitudes de amistad pendientes
        const { data: pendingRequests, error: requestsError } = await supabaseClient
            .from('friend_requests')
            .select('id')
            .or(`sender_user_id.eq.${oldUserID},receiver_user_id.eq.${oldUserID}`)
            .eq('status', 'pending');
            
        if (pendingRequests && pendingRequests.length > 0) {
            return { 
                success: false, 
                message: "No puedes cambiar tu ID mientras tengas solicitudes de amistad pendientes" 
            };
        }
        
        // 3. Generar nuevo ID
        const newUserID = generateUserID();
        
        // 4. Actualizar perfil
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ user_id: newUserID })
            .eq('id', userId);
            
        if (updateError) {
            console.error("Error al actualizar ID de usuario:", updateError);
            return { success: false, message: "Error al actualizar ID de usuario" };
        }
        
        // 5. Actualizar referencias en amistades (opcional: depende de tu estructura)
        try {
            // Como user1_user_id
            await supabaseClient
                .from('friendships')
                .update({ user1_user_id: newUserID })
                .eq('user1_id', userId);
                
            // Como user2_user_id
            await supabaseClient
                .from('friendships')
                .update({ user2_user_id: newUserID })
                .eq('user2_id', userId);
        } catch (friendshipError) {
            // No interrumpir el flujo principal si esto falla
            console.warn("Error al actualizar referencias en amistades:", friendshipError);
        }
        
        console.log(`ID de usuario regenerado exitosamente: ${oldUserID} → ${newUserID}`);
        return { 
            success: true, 
            message: "ID de usuario regenerado exitosamente", 
            newId: newUserID,
            oldId: oldUserID
        };
    } catch (error) {
        console.error("Error inesperado al regenerar ID de usuario:", error);
        return { success: false, message: "Error inesperado al regenerar ID" };
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
    getCurrentUserID,
    regenerateUserID
};
