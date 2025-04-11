// Centro de Notificaciones - Sistema integrado para gestionar notificaciones

// Clase principal del Centro de Notificaciones
class NotificationsCenter {
    constructor() {
        this.notificationCount = 0;
        this.initialized = false;
        this.currentUser = null;
    }

    // Inicializar el sistema
    async init() {
        try {
            // Verificar usuario autenticado
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return false;
            
            this.currentUser = user;
            this.initialized = true;
            
            // Inicializar contador en la UI
            this.updateNotificationCount(0);
            
            // Configurar escucha de tiempo real para solicitudes de amistad
            this.setupRealtimeSubscription();
            
            return true;
        } catch (error) {
            console.error('Error al inicializar centro de notificaciones:', error);
            return false;
        }
    }

    // Configurar escucha en tiempo real para notificaciones
    setupRealtimeSubscription() {
        if (!this.currentUser) return;
        
        const channel = supabaseClient
            .channel('friend-requests-channel')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'friend_requests',
                filter: `receiver_id=eq.${this.currentUser.id}`
            }, (payload) => {
                console.log('Nueva solicitud de amistad recibida:', payload);
                this.handleNewFriendRequest(payload.new);
            })
            .subscribe();
            
        console.log('Suscripción a notificaciones en tiempo real establecida');
    }

    // Manejar nueva solicitud de amistad
    async handleNewFriendRequest(request) {
        try {
            // Obtener información del remitente
            const { data: sender, error: senderError } = await supabaseClient
                .from('profiles')
                .select('username, full_name, avatar_url')
                .eq('id', request.sender_id)
                .single();
                
            if (senderError) throw senderError;
            
            // Nombre para mostrar
            const senderName = sender.full_name || sender.username || 'Usuario';
            const avatarUrl = sender.avatar_url || 'https://i.ibb.co/ZRXTrM6w/ic-launcher.png';
            
            // Mostrar notificación flotante
            showFloatingNotification(
                'Nueva solicitud de amistad',
                `${senderName} quiere ser tu amigo`,
                avatarUrl,
                'Ver solicitudes',
                () => {
                    // Navegar a la sección de solicitudes
                    if (typeof handleNavigation === 'function') {
                        handleNavigation('notifications');
                        setTimeout(() => {
                            const requestsTab = document.querySelector('.notification-tab[data-type="friend-requests"]');
                            if (requestsTab) requestsTab.click();
                        }, 100);
                    }
                }
            );
            
            // Mostrar notificación estándar
            showNotification('friend', `Nueva solicitud de amistad de ${senderName}`);
            
            // Reproducir sonido
            if (typeof playNotificationSound === 'function') {
                playNotificationSound('friendRequest');
            }
            
            // Actualizar contador
            this.incrementNotificationCount();
            
        } catch (error) {
            console.error('Error al procesar nueva solicitud de amistad:', error);
        }
    }

    // Incrementar contador de notificaciones
    incrementNotificationCount() {
        this.notificationCount++;
        this.updateNotificationCount(this.notificationCount);
    }

    // Actualizar contador en la UI
    updateNotificationCount(count) {
        this.notificationCount = count;
        
        const badge = document.getElementById('notificationCountBadge');
        if (!badge) return;
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // Cargar sección de notificaciones
    loadNotificationsSection() {
        const mainContentArea = document.getElementById('mainContentArea');
        if (!mainContentArea) {
            console.error('No se encontró el área de contenido principal');
            return;
        }
        
        console.log('Cargando sección de notificaciones...');
        
        // Plantilla base del panel de notificaciones
        mainContentArea.innerHTML = `
            <div class="notifications-panel">
                <div class="notifications-header">
                    <div class="notifications-tabs">
                        <button class="notification-tab active" data-type="all">Todas</button>
                        <button class="notification-tab" data-type="friend-requests">Solicitudes</button>
                        <button class="notification-tab" data-type="mentions">Menciones</button>
                        <button class="notification-tab" data-type="system">Sistema</button>
                    </div>
                    <div class="notifications-actions">
                        <button class="mark-all-read-btn">
                            <i class="fas fa-check-double"></i> Marcar todo como leído
                        </button>
                    </div>
                </div>
                <div class="notifications-list" id="notificationsList">
                    <div class="loading-placeholder" style="text-align: center; padding: 20px;">
                        <i class="fas fa-spinner fa-spin"></i> Cargando notificaciones...
                    </div>
                </div>
            </div>
        `;
        
        // Configurar listeners de pestañas
        document.querySelectorAll('.notification-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.notification-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadNotifications(tab.dataset.type);
            });
        });
        
        // Botón para marcar todas como leídas
        const markAllReadBtn = document.querySelector('.mark-all-read-btn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => this.markAllNotificationsAsRead());
        }
        
        // Cargar notificaciones iniciales (todas)
        this.loadNotifications('all');
    }

    // Cargar notificaciones según el tipo
    async loadNotifications(type = 'all', silentMode = false) {
        // En modo silencioso solo contamos notificaciones sin actualizar la UI
        const notificationsList = silentMode ? null : document.getElementById('notificationsList');
        
        if (!silentMode && !notificationsList) return;
        if (!this.currentUser) return;
        
        // Mostrar estado de carga si no es modo silencioso
        if (!silentMode && notificationsList) {
            notificationsList.innerHTML = `
                <div class="loading-placeholder" style="text-align: center; padding: 20px;">
                    <i class="fas fa-spinner fa-spin"></i> Cargando notificaciones...
                </div>
            `;
        }
        
        try {
            // Diferentes tipos de notificaciones que debemos cargar
            let notifications = [];
            
            // 1. Cargar solicitudes de amistad pendientes
            if (type === 'all' || type === 'friend-requests') {
                const { data: friendRequests, error: requestsError } = await supabaseClient
                    .from('friend_requests')
                    .select(`
                        id, 
                        sender_id, 
                        sender_user_id,
                        status, 
                        created_at, 
                        message,
                        profiles!friend_requests_sender_id_fkey (
                            username, 
                            full_name,
                            avatar_url
                        )
                    `)
                    .eq('receiver_id', this.currentUser.id)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                    
                if (requestsError) {
                    console.error('Error al cargar solicitudes:', requestsError);
                } else if (friendRequests?.length > 0) {
                    // Convertir solicitudes a formato de notificación
                    const friendRequestNotifications = friendRequests.map(request => {
                        const sender = request.profiles || {};
                        return {
                            id: `friend-request-${request.id}`,
                            type: 'friend-request',
                            title: 'Nueva solicitud de amistad',
                            message: `${sender.full_name || sender.username || 'Usuario'} quiere ser tu amigo`,
                            avatarUrl: sender.avatar_url || 'https://i.ibb.co/ZRXTrM6w/ic-launcher.png',
                            timestamp: request.created_at,
                            data: {
                                requestId: request.id,
                                senderId: request.sender_id,
                                senderUserID: request.sender_user_id
                            },
                            read: false
                        };
                    });
                    
                    notifications = [...notifications, ...friendRequestNotifications];
                }
            }
            
            // Aquí se pueden agregar más tipos de notificaciones en el futuro
            
            // Si no hay notificaciones
            if (notifications.length === 0) {
                // Actualizar contador del botón (ocultar si no hay notificaciones)
                this.updateNotificationCount(0);
                
                // Si no estamos en modo silencioso, actualizar la UI
                if (!silentMode && notificationsList) {
                    notificationsList.innerHTML = `
                        <div class="placeholder-text" style="text-align: center; padding: 20px;">
                            No tienes notificaciones ${type !== 'all' ? 'de este tipo' : ''}
                        </div>
                    `;
                }
                
                return;
            }
            
            // Ordenar por fecha más reciente
            notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Actualizar contador del botón
            this.updateNotificationCount(notifications.length);
            
            // Si estamos en modo silencioso, terminamos aquí
            if (silentMode) return;
            
            // Generar HTML para cada notificación
            const notificationsHTML = notifications.map(notification => {
                let actionsHTML = '';
                
                // Diferentes acciones según el tipo de notificación
                if (notification.type === 'friend-request') {
                    actionsHTML = `
                        <div class="notification-actions">
                            <button class="notification-btn accept" 
                                data-request-id="${notification.data.requestId}" 
                                data-sender-id="${notification.data.senderId}" 
                                data-sender-user-id="${notification.data.senderUserID}">
                                Aceptar
                            </button>
                            <button class="notification-btn reject" 
                                data-request-id="${notification.data.requestId}">
                                Rechazar
                            </button>
                        </div>
                    `;
                }
                
                // Formato fecha
                const date = new Date(notification.timestamp);
                const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                
                return `
                    <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
                        <img src="${notification.avatarUrl}" alt="Avatar" class="notification-avatar">
                        <div class="notification-content">
                            <div class="notification-title">${notification.title}</div>
                            <div class="notification-message">${notification.message}</div>
                            <div class="notification-time">${formattedDate}</div>
                            ${actionsHTML}
                        </div>
                    </div>
                `;
            }).join('');
            
            notificationsList.innerHTML = notificationsHTML;
            
            // Agregar listeners para botones de acción
            this.setupNotificationActionListeners();
            
        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
            notificationsList.innerHTML = `
                <div class="placeholder-text" style="text-align: center; padding: 20px;">
                    Error al cargar notificaciones: ${error.message || 'Error desconocido'}
                </div>
            `;
        }
    }

    // Configurar listeners para acciones de notificaciones
    setupNotificationActionListeners() {
        // Botones para aceptar solicitudes de amistad
        document.querySelectorAll('.notification-btn.accept').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const requestId = btn.dataset.requestId;
                const senderId = btn.dataset.senderId;
                const senderUserID = btn.dataset.senderUserId;
                
                // Mostrar notificación de carga
                showNotification('info', 'Aceptando solicitud...', 2000);
                
                try {
                    // Llamar a la función de aceptar solicitud
                    await this.acceptFriendRequest(requestId, senderId, senderUserID);
                    
                    // Eliminar la notificación de la UI
                    const notificationItem = btn.closest('.notification-item');
                    if (notificationItem) {
                        notificationItem.remove();
                    }
                    
                    // Actualizar contador
                    const remainingNotifications = document.querySelectorAll('.notification-item').length;
                    this.updateNotificationCount(remainingNotifications);
                    
                    // Si no quedan notificaciones, mostrar mensaje
                    if (remainingNotifications === 0) {
                        document.getElementById('notificationsList').innerHTML = `
                            <div class="placeholder-text" style="text-align: center; padding: 20px;">
                                No tienes notificaciones
                            </div>
                        `;
                    }
                    
                    // Mostrar notificación de éxito
                    showNotification('success', 'Solicitud aceptada correctamente', 3000);
                } catch (error) {
                    console.error('Error al aceptar solicitud:', error);
                    showNotification('error', 'Error al aceptar solicitud', 3000);
                }
            });
        });
        
        // Botones para rechazar solicitudes de amistad
        document.querySelectorAll('.notification-btn.reject').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const requestId = btn.dataset.requestId;
                
                // Mostrar notificación de carga
                showNotification('info', 'Rechazando solicitud...', 2000);
                
                try {
                    // Llamar a la función de rechazar solicitud
                    await this.rejectFriendRequest(requestId);
                    
                    // Eliminar la notificación de la UI
                    const notificationItem = btn.closest('.notification-item');
                    if (notificationItem) {
                        notificationItem.remove();
                    }
                    
                    // Actualizar contador
                    const remainingNotifications = document.querySelectorAll('.notification-item').length;
                    this.updateNotificationCount(remainingNotifications);
                    
                    // Si no quedan notificaciones, mostrar mensaje
                    if (remainingNotifications === 0) {
                        document.getElementById('notificationsList').innerHTML = `
                            <div class="placeholder-text" style="text-align: center; padding: 20px;">
                                No tienes notificaciones
                            </div>
                        `;
                    }
                    
                    // Mostrar notificación de éxito
                    showNotification('info', 'Solicitud rechazada', 3000);
                } catch (error) {
                    console.error('Error al rechazar solicitud:', error);
                    showNotification('error', 'Error al rechazar solicitud', 3000);
                }
            });
        });
    }

    // Aceptar solicitud de amistad
    async acceptFriendRequest(requestId, senderId, senderUserID) {
        if (!this.currentUser) throw new Error('Usuario no autenticado');
        
        try {
            // Buscar el currentUserID
            let currentUserID = null;
            if (typeof getCurrentUserID === 'function') {
                currentUserID = await getCurrentUserID();
            } else {
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('user_id')
                    .eq('id', this.currentUser.id)
                    .single();
                
                if (profile) {
                    currentUserID = profile.user_id;
                }
            }
            
            if (!currentUserID) {
                throw new Error('No se pudo obtener el ID de usuario actual');
            }
            
            // Actualizar estado de la solicitud
            const { error: updateError } = await supabaseClient
                .from('friend_requests')
                .update({ status: 'accepted' })
                .eq('id', requestId);
            
            if (updateError) throw updateError;
            
            // Crear amistad con IDs de usuario
            const { error: friendshipError } = await supabaseClient
                .from('friendships')
                .insert([
                    {
                        user1_id: this.currentUser.id,
                        user2_id: senderId,
                        user1_user_id: currentUserID, 
                        user2_user_id: senderUserID
                    }
                ]);
            
            if (friendshipError) throw friendshipError;
            
            // Recargar listas si existen las funciones
            if (typeof loadFriendRequests === 'function') {
                loadFriendRequests();
            }
            
            if (typeof loadFriendsList === 'function') {
                loadFriendsList('all');
            }
            
            return true;
        } catch (error) {
            console.error('Error al aceptar solicitud de amistad:', error);
            throw error;
        }
    }

    // Rechazar solicitud de amistad
    async rejectFriendRequest(requestId) {
        try {
            // Actualizar estado de la solicitud
            const { error: updateError } = await supabaseClient
                .from('friend_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId);
            
            if (updateError) throw updateError;
            
            // Recargar lista si existe la función
            if (typeof loadFriendRequests === 'function') {
                loadFriendRequests();
            }
            
            return true;
        } catch (error) {
            console.error('Error al rechazar solicitud de amistad:', error);
            throw error;
        }
    }

    // Marcar todas las notificaciones como leídas
    markAllNotificationsAsRead() {
        // Marcar todas las notificaciones visibles como leídas
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
        });
        
        // Actualizar contador
        this.updateNotificationCount(0);
        
        // Mostrar notificación
        showNotification('success', 'Todas las notificaciones marcadas como leídas', 3000);
    }
}

// Inicializar centro de notificaciones
let notificationsCenter = null;

// Asegurarnos que se inicialice lo antes posible
(async function() {
    try {
        if (!notificationsCenter) {
            notificationsCenter = new NotificationsCenter();
            const initialized = await notificationsCenter.init();
            console.log('Centro de notificaciones inicializado:', initialized ? 'OK' : 'Error');
            
            // Cargar el contador inicialmente
            if (initialized) {
                await notificationsCenter.loadNotifications('all', true);
            }
        }
    } catch (error) {
        console.error('Error inicializando centro de notificaciones:', error);
    }
})();

// Función global para cargar la sección de notificaciones
function loadNotificationsSection() {
    console.log('Llamada a cargar sección de notificaciones');
    
    if (!notificationsCenter) {
        console.log('Creando nueva instancia del centro de notificaciones');
        notificationsCenter = new NotificationsCenter();
        notificationsCenter.init().then((initialized) => {
            console.log('Centro de notificaciones inicializado:', initialized);
            if (initialized) {
                notificationsCenter.loadNotificationsSection();
            } else {
                // Mostrar mensaje de error si no se pudo inicializar
                const mainContentArea = document.getElementById('mainContentArea');
                if (mainContentArea) {
                    mainContentArea.innerHTML = `
                        <div class="notifications-panel">
                            <div class="placeholder-text" style="text-align: center; padding: 40px;">
                                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--db-warning); margin-bottom: 20px;"></i>
                                <h3>No se pudo cargar el centro de notificaciones</h3>
                                <p>Verifica tu conexión a internet e inténtalo nuevamente.</p>
                                <button class="cyber-btn primary" onclick="window.loadNotificationsSection()">
                                    <i class="fas fa-sync"></i> Reintentar
                                </button>
                            </div>
                        </div>
                    `;
                }
            }
        }).catch(err => {
            console.error('Error al inicializar centro de notificaciones:', err);
            // Mostrar mensaje de error
            const mainContentArea = document.getElementById('mainContentArea');
            if (mainContentArea) {
                mainContentArea.innerHTML = `
                    <div class="notifications-panel">
                        <div class="placeholder-text" style="text-align: center; padding: 40px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--db-danger); margin-bottom: 20px;"></i>
                            <h3>Error al cargar el centro de notificaciones</h3>
                            <p>${err.message || 'Error desconocido'}</p>
                            <button class="cyber-btn primary" onclick="window.loadNotificationsSection()">
                                <i class="fas fa-sync"></i> Reintentar
                            </button>
                        </div>
                    </div>
                `;
            }
        });
    } else {
        console.log('Usando instancia existente del centro de notificaciones');
        notificationsCenter.loadNotificationsSection();
    }
}

// Exponer la función globalmente
window.loadNotificationsSection = loadNotificationsSection;

// Función para obtener el ID de usuario actual
async function getCurrentUserID() {
    try {
        // Verificar si el sistema userIDs está disponible
        if (typeof userIDSystem !== 'undefined' && userIDSystem) {
            return await userIDSystem.ensureUserHasID();
        }
        
        // Verificar si hay usuario autenticado
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;
        
        // Obtener perfil con ID personalizado
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('user_id')
            .eq('id', user.id)
            .single();
            
        return profile?.user_id || null;
    } catch (error) {
        console.error('Error al obtener ID de usuario:', error);
        return null;
    }
} 