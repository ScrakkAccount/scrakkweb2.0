// js/profile-id.js - Sistema de visualización de IDs en el perfil
document.addEventListener('DOMContentLoaded', () => {
    // Buscar o crear los elementos necesarios en el modal de perfil
    setupProfileIDElements();
    // Actualizar el ID en el perfil modal cuando se abra
    function initializeProfileIDSystem() {
        // Elementos del DOM para el ID de usuario
        const profileUserID = document.getElementById('profileUserID');
        const copyUserIDBtn = document.getElementById('copyUserIDBtn');
        const currentUserIDDisplay = document.getElementById('currentUserIDDisplay');
        
        // Configuración de botón para abrir el perfil
        const userProfileTrigger = document.getElementById('userProfileTrigger');
        if (userProfileTrigger) {
            const originalClick = userProfileTrigger.onclick;
            userProfileTrigger.onclick = async function(e) {
                // Ejecutar el evento original si existe
                if (originalClick) originalClick.call(this, e);
                
                // Actualizar ID de usuario en el modal
                await updateProfileUserID();
            };
        }
        
        // Configuración de botón para copiar ID
        if (copyUserIDBtn) {
            copyUserIDBtn.addEventListener('click', () => {
                const userID = profileUserID ? profileUserID.textContent : '';
                if (!userID || userID === 'No disponible' || userID === 'Cargando...') {
                    showNotification('No hay ID disponible para copiar', 'error');
                    return;
                }
                
                // Copiar al portapapeles
                navigator.clipboard.writeText(userID)
                    .then(() => {
                        showNotification('ID copiado al portapapeles', 'success');
                    })
                    .catch(err => {
                        console.error('Error al copiar ID:', err);
                        
                        // Método alternativo si navigator.clipboard falla
                        try {
                            const tempInput = document.createElement('input');
                            tempInput.value = userID;
                            document.body.appendChild(tempInput);
                            tempInput.select();
                            document.execCommand('copy');
                            document.body.removeChild(tempInput);
                            showNotification('ID copiado al portapapeles', 'success');
                        } catch (e) {
                            console.error('Error al usar método alternativo:', e);
                            showNotification('No se pudo copiar el ID', 'error');
                        }
                    });
            });
        }
        
        // También actualizar cuando cambia el estado de autenticación
        if (supabaseClient) {
            supabaseClient.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    updateProfileUserID();
                }
            });
        }
    }
    
    // Función para actualizar el ID de usuario en el perfil
    async function updateProfileUserID() {
        try {
            const profileUserID = document.getElementById('profileUserID');
            const currentUserIDDisplay = document.getElementById('currentUserIDDisplay');
            
            if (!profileUserID && !currentUserIDDisplay) return;
            
            // Mostrar estado de carga
            if (profileUserID) profileUserID.textContent = 'Cargando...';
            if (currentUserIDDisplay) currentUserIDDisplay.textContent = 'Cargando...';
            
            // Verificar si ya tenemos el ID guardado en window
            if (window.currentUserID) {
                if (profileUserID) profileUserID.textContent = window.currentUserID;
                if (currentUserIDDisplay) currentUserIDDisplay.textContent = window.currentUserID;
                console.log("Usando ID almacenado en caché:", window.currentUserID);
                return;
            }
            
            // Obtener el usuario actual
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError || !user) {
                console.error("Error al obtener usuario:", userError);
                if (profileUserID) profileUserID.textContent = 'No disponible';
                if (currentUserIDDisplay) currentUserIDDisplay.textContent = 'No disponible';
                return;
            }
            
            console.log("Obteniendo/creando ID para usuario:", user.id);
            
            // Generar manualmente un ID si todo falla
            let userID;
            
            try {
                // Intentar obtener o crear ID
                userID = await userIDSystem.ensureUserHasID(user.id);
            } catch (idError) {
                console.error("Error al obtener/crear ID:", idError);
                // Si falla, crear un ID temporal
                userID = 'SCRAKK-' + Math.random().toString(36).substr(2, 8).toUpperCase();
                console.log("ID temporal generado:", userID);
            }
            
            // Guardar en caché
            window.currentUserID = userID;
            
            // Actualizar en el DOM
            if (profileUserID) profileUserID.textContent = userID || 'No disponible';
            if (currentUserIDDisplay) currentUserIDDisplay.textContent = userID || 'No disponible';
            
            console.log("ID de usuario actualizado:", userID);
            
            // Intentar guardar el ID en el perfil de forma asíncrona
            if (userID && user.id) {
                saveUserIDToProfile(user.id, userID).catch(err => {
                    console.warn("No se pudo guardar el ID en el perfil:", err);
                });
            }
            
        } catch (error) {
            console.error("Error al actualizar ID de usuario:", error);
            const profileUserID = document.getElementById('profileUserID');
            const currentUserIDDisplay = document.getElementById('currentUserIDDisplay');
            
            if (profileUserID) profileUserID.textContent = 'Error';
            if (currentUserIDDisplay) currentUserIDDisplay.textContent = 'Error';
        }
    }
    
    // Función para configurar los elementos del ID en el perfil
    function setupProfileIDElements() {
        // Buscar el contenedor donde mostraremos el ID
        const profileInfoContainer = document.querySelector('.profile-info-container');
        if (!profileInfoContainer) return;
        
        // Verificar si ya existe la sección de ID
        if (!document.getElementById('profileUserIDContainer')) {
            // Crear elementos para mostrar y gestionar el ID
            const idContainer = document.createElement('div');
            idContainer.id = 'profileUserIDContainer';
            idContainer.className = 'profile-id-container';
            
            idContainer.innerHTML = `
                <div class="profile-id-header">
                    <span class="profile-id-label">Tu ID único:</span>
                </div>
                <div class="profile-id-content">
                    <span id="profileUserID">Cargando...</span>
                    <button id="copyUserIDBtn" class="btn-copy-id" title="Copiar ID">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="profile-id-actions">
                    <button id="generateNewIDBtn" class="btn-generate-id">
                        <i class="fas fa-sync-alt"></i> Generar nuevo ID
                    </button>
                </div>
                <div class="profile-id-info">
                    <p class="id-info-text">Este ID te permite conectar con amigos fácilmente.</p>
                </div>
            `;
            
            // Insertar después del contenedor de información del perfil
            profileInfoContainer.parentNode.insertBefore(idContainer, profileInfoContainer.nextSibling);
            
            // Configurar el evento para el botón de generar nuevo ID
            const generateNewIDBtn = document.getElementById('generateNewIDBtn');
            if (generateNewIDBtn) {
                generateNewIDBtn.addEventListener('click', generateNewUserID);
            }
        }
    }
    
    // Función para generar un nuevo ID de usuario
    async function generateNewUserID() {
        try {
            // Mostrar estado de carga
            const profileUserID = document.getElementById('profileUserID');
            if (profileUserID) profileUserID.textContent = 'Generando...';
            
            // Generar nuevo ID
            const newID = 'SCRAKK-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            
            // Obtener usuario actual
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                showNotification('No se pudo obtener el usuario', 'error');
                return;
            }
            
            // Intentar usar la función RPC para actualizar
            try {
                const { error } = await supabaseClient.rpc('set_user_id', { user_id_value: newID });
                if (error) throw error;
                
                // Actualizar en memoria
                window.currentUserID = newID;
                
                // Actualizar en la interfaz
                if (profileUserID) profileUserID.textContent = newID;
                const currentUserIDDisplay = document.getElementById('currentUserIDDisplay');
                if (currentUserIDDisplay) currentUserIDDisplay.textContent = newID;
                
                showNotification('ID generado correctamente', 'success');
            } catch (rpcError) {
                console.error("Error al usar RPC:", rpcError);
                
                // Intentar método tradicional
                await saveUserIDToProfile(user.id, newID);
                
                // Actualizar en memoria
                window.currentUserID = newID;
                
                // Actualizar en la interfaz
                if (profileUserID) profileUserID.textContent = newID;
                const currentUserIDDisplay = document.getElementById('currentUserIDDisplay');
                if (currentUserIDDisplay) currentUserIDDisplay.textContent = newID;
                
                showNotification('ID generado correctamente', 'success');
            }
        } catch (error) {
            console.error("Error al generar nuevo ID:", error);
            showNotification('Error al generar ID', 'error');
        }
    }
    
    // Función auxiliar para guardar el ID en el perfil
    async function saveUserIDToProfile(userId, userID) {
        if (!userId || !userID) return;
        
        try {
            // Usar upsert para crear o actualizar
            const { error } = await supabaseClient
                .from('profiles')
                .upsert({ 
                    id: userId, 
                    user_id: userID,
                    updated_at: new Date().toISOString()
                });
                
            if (error) {
                console.error("Error al guardar ID en perfil:", error);
            } else {
                console.log("ID guardado en perfil correctamente");
            }
        } catch (error) {
            console.error("Error inesperado al guardar ID:", error);
        }
    }
    
    // Iniciar el sistema
    initializeProfileIDSystem();
    setTimeout(updateProfileUserID, 1000); // Actualizar después de un breve retraso
});

// Añadir el botón para regenerar ID al perfil
function setupUserIDControls() {
    // Obtener el contenedor del ID
    const profileUserIDContainer = document.querySelector('.profile-id-container');
    
    if (profileUserIDContainer && !document.getElementById('regenerateUserIDBtn')) {
        // Crear el botón de regenerar ID
        const regenerateBtn = document.createElement('button');
        regenerateBtn.id = 'regenerateUserIDBtn';
        regenerateBtn.className = 'cyber-btn small warning';
        regenerateBtn.style.padding = '5px';
        regenerateBtn.style.fontSize = '0.8rem';
        regenerateBtn.style.marginLeft = '5px';
        regenerateBtn.title = 'Generar nuevo ID';
        regenerateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        
        // Añadir al contenedor
        profileUserIDContainer.appendChild(regenerateBtn);
        
        // Añadir evento click
        regenerateBtn.addEventListener('click', handleRegenerateUserID);
        
        // Añadir texto explicativo debajo
        const regenerateInfo = document.createElement('p');
        regenerateInfo.className = 'id-info';
        regenerateInfo.style.fontSize = '0.75rem';
        regenerateInfo.style.marginTop = '5px';
        regenerateInfo.style.opacity = '0.7';
        regenerateInfo.innerHTML = '<i class="fas fa-info-circle"></i> Puedes generar un nuevo ID si quieres cambiar tu identificador actual';
        
        // Añadir después del contenedor
        profileUserIDContainer.parentNode.insertBefore(regenerateInfo, profileUserIDContainer.nextSibling);
    }
}

// Manejar la regeneración del ID de usuario
async function handleRegenerateUserID() {
    try {
        // Mostrar confirmación
        if (!confirm('¿Estás seguro de generar un nuevo ID? Esto cambiará tu ID actual y tus amigos no podrán encontrarte con el ID anterior.')) {
            return;
        }
        
        // Mostrar cargando
        showNotification('Generando nuevo ID...', 'info');
        
        // Verificar que el usuario esté autenticado
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            showNotification('Debes iniciar sesión para realizar esta acción', 'error');
            return;
        }
        
        // Verificar disponibilidad de la función
        if (!window.userIDSystem || !window.userIDSystem.regenerateUserID) {
            console.error('La función regenerateUserID no está disponible');
            showNotification('Esta función no está disponible en este momento', 'error');
            return;
        }
        
        // Regenerar ID
        const result = await window.userIDSystem.regenerateUserID(user.id);
        
        if (!result.success) {
            showNotification(result.message, 'error');
            return;
        }
        
        // Actualizar ID en la UI
        const profileUserID = document.getElementById('profileUserID');
        if (profileUserID) {
            profileUserID.textContent = result.newId;
            
            // Efecto de animación
            profileUserID.style.transition = 'all 0.3s ease';
            profileUserID.style.backgroundColor = 'rgba(123, 47, 249, 0.2)';
            setTimeout(() => {
                profileUserID.style.backgroundColor = 'transparent';
            }, 2000);
        }
        
        // Actualizar la variable global
        window.currentUserID = result.newId;
        
        // Mostrar notificación de éxito
        showNotification(`ID regenerado exitosamente: ${result.newId}`, 'success', 6000);
        
    } catch (error) {
        console.error('Error al regenerar ID:', error);
        showNotification('Error al regenerar ID', 'error');
    }
}

// Función para mostrar notificaciones (respaldo si no existe globalmente)
function showNotification(message, type, duration) {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type, duration);
    } else {
        alert(`${message} (${type})`);
    }
}

// Asegurarse de que se llame a setupUserIDControls al cargar el perfil
document.addEventListener('DOMContentLoaded', function() {
    // Comprobar si estamos en una página con perfil
    if (document.querySelector('.profile-id-container')) {
        setupUserIDControls();
    }
});

// Exportar funciones si es necesario
window.profileIDFunctions = {
    setupUserIDControls,
    handleRegenerateUserID
};
