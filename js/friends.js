// js/friends.js - Sistema de amigos y chat para Scrakk

// Variables globales - usar window para evitar redeclaraciones
if (typeof window.currentUser === 'undefined') window.currentUser = null;
if (typeof window.currentUserID === 'undefined') window.currentUserID = null; // ID personalizado de usuario
if (typeof window.currentFriendsList === 'undefined') window.currentFriendsList = [];
if (typeof window.currentFriendRequests === 'undefined') window.currentFriendRequests = [];
if (typeof window.currentChats === 'undefined') window.currentChats = {};
if (typeof window.activeChatId === 'undefined') window.activeChatId = null;
if (typeof window.friendsSystemInitialized === 'undefined') window.friendsSystemInitialized = false;

// NO crear alias locales, usar directamente window.X para evitar redeclaraciones
// Estas líneas causaban el error 'Identifier has already been declared'

// Sistema de Amigos Mejorado
class FriendsSystem {
    constructor() {
        this.initialized = false;
        this.currentUser = null;
        this.currentUserID = null;
        this.friendRequestsChannel = null;
    }

    async init() {
        if (this.initialized) return;
        
        console.log("Inicializando sistema de amigos...");
        
        try {
            // Obtener usuario actual
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) throw new Error("Error al obtener usuario actual");
            if (!user) throw new Error("No hay usuario autenticado");
            
            this.currentUser = user;
            
            // Asegurar que el usuario tenga un ID personalizado
            this.currentUserID = await userIDSystem.ensureUserHasID(user.id);
            
            // Verificar tablas necesarias
            await this.setupFriendshipTables();
            
            // Configurar suscripciones en tiempo real
            this.setupRealtimeSubscriptions();
            
            this.initialized = true;
            console.log("Sistema de amigos inicializado correctamente");
            
        } catch (error) {
            console.error("Error al inicializar sistema de amigos:", error);
            showNotification("Error al inicializar sistema de amigos", "error");
        }
    }

    async setupFriendshipTables() {
        // Verificar y crear tablas si no existen
        const tables = ['friendships', 'friend_requests'];
        
        for (const table of tables) {
            const { error } = await supabaseClient
                .from(table)
                .select('id')
                .limit(1);
                
            if (error) {
                console.error(`Error al verificar tabla ${table}:`, error);
                showNotification(`Error al verificar tabla ${table}`, "error");
            }
        }
    }

    setupRealtimeSubscriptions() {
        if (!this.currentUser) return;
        
        // Suscribirse a cambios en solicitudes de amistad
        this.friendRequestsChannel = supabaseClient
            .channel('friend_requests_changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'friend_requests', 
                    filter: `receiver_id=eq.${this.currentUser.id}` 
                },
                this.handleFriendRequestChange.bind(this)
            )
            .subscribe((status) => {
                console.log("Estado de suscripción a solicitudes:", status);
                
                if (status === 'CHANNEL_ERROR') {
                    console.error("Error en la suscripción a solicitudes");
                    setTimeout(() => this.setupRealtimeSubscriptions(), 5000);
                }
            });
    }

    async handleFriendRequestChange(payload) {
        console.log("Cambio en solicitud de amistad:", payload);
        
        if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            await this.handleNewFriendRequest(payload.new);
        } else if (payload.eventType === 'UPDATE') {
            await this.handleFriendRequestUpdate(payload.new);
        }
    }

    async handleNewFriendRequest(request) {
        try {
            // Obtener datos del remitente
            const { data: senderProfile } = await supabaseClient
                .from('profiles')
                .select('username, full_name, avatar_url')
                .eq('id', request.sender_id)
                .single();
            
            const senderName = senderProfile?.full_name || senderProfile?.username || "Alguien";
            
            // Mostrar notificación principal
            showNotification(
                `¡${senderName} te ha enviado una solicitud de amistad!`,
                'friend-request',
                8000
            );
            
            // Mostrar notificación flotante
            showFloatingNotification({
                title: 'Nueva solicitud de amistad',
                message: `${senderName} quiere ser tu amigo`,
                type: 'friend-request',
                icon: 'user-plus',
                avatar: senderProfile?.avatar_url,
                duration: 10000,
                action: () => this.openFriendRequests()
            });
            
            // Recargar solicitudes
            await this.loadFriendRequests();
            
        } catch (error) {
            console.error("Error al procesar nueva solicitud:", error);
            showNotification("Has recibido una nueva solicitud de amistad", 'friend-request');
        }
    }

    async handleFriendRequestUpdate(request) {
        if (request.status === 'accepted') {
            showNotification("¡Nuevo amigo añadido!", "success");
            await this.loadFriendsList();
        }
    }

    async sendFriendRequest(friendID) {
        try {
            if (!this.initialized) await this.init();
            
            // Validar ID
            if (!userIDSystem.isValidUserID(friendID)) {
                showNotification("ID de usuario inválido", "error");
                return false;
            }
            
            // Buscar usuario
            const user = await userIDSystem.findUserByID(friendID);
            if (!user) {
                showNotification("Usuario no encontrado", "error");
                return false;
            }
            
            // Verificar que no sea el mismo usuario
            if (user.id === this.currentUser.id) {
                showNotification("No puedes enviarte una solicitud a ti mismo", "warning");
                return false;
            }
            
            // Verificar si ya son amigos
            const { data: existingFriendship } = await supabaseClient
                .from('friendships')
                .select('id')
                .or(`and(user1_id.eq.${this.currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${this.currentUser.id})`)
                .maybeSingle();
                
            if (existingFriendship) {
                showNotification("Ya son amigos", "info");
                return false;
            }
            
            // Verificar solicitudes existentes
            const { data: existingRequest } = await supabaseClient
                .from('friend_requests')
                .select('id, status')
                .eq('sender_id', this.currentUser.id)
                .eq('receiver_id', user.id)
                .maybeSingle();
                
            if (existingRequest) {
                if (existingRequest.status === 'pending') {
                    showNotification("Ya enviaste una solicitud a este usuario", "info");
                    return false;
                } else if (existingRequest.status === 'rejected') {
                    showNotification("Este usuario rechazó tu solicitud anteriormente", "warning");
                    return false;
                }
            }
            
            // Verificar si el otro usuario ya envió una solicitud
            const { data: receivedRequest } = await supabaseClient
                .from('friend_requests')
                .select('id, status')
                .eq('sender_id', user.id)
                .eq('receiver_id', this.currentUser.id)
                .maybeSingle();
                
            if (receivedRequest?.status === 'pending') {
                showNotification("Este usuario ya te envió una solicitud. Aceptando automáticamente.", "success");
                await this.acceptFriendRequest(receivedRequest.id, user.id, friendID);
                return true;
            }
            
            // Enviar nueva solicitud
            const { error: requestError } = await supabaseClient
                .from('friend_requests')
                .insert([{
                    sender_id: this.currentUser.id,
                    receiver_id: user.id,
                    sender_user_id: this.currentUserID,
                    receiver_user_id: friendID,
                    status: 'pending',
                    message: 'Hola, me gustaría añadirte como amigo'
                }]);
                
            if (requestError) throw requestError;
            
            showNotification("Solicitud enviada exitosamente", "success");
            return true;
            
        } catch (error) {
            console.error("Error al enviar solicitud:", error);
            showNotification("Error al enviar la solicitud", "error");
            return false;
        }
    }

    async acceptFriendRequest(requestId, senderId, senderUserID) {
        try {
            if (!this.initialized) await this.init();
            
            // Actualizar estado de la solicitud
            const { error: updateError } = await supabaseClient
                .from('friend_requests')
                .update({ status: 'accepted' })
                .eq('id', requestId);
                
            if (updateError) throw updateError;
            
            // Crear amistad
            const { error: friendshipError } = await supabaseClient
                .from('friendships')
                .insert([{
                    user1_id: this.currentUser.id,
                    user2_id: senderId,
                    user1_user_id: this.currentUserID,
                    user2_user_id: senderUserID
                }]);
                
            if (friendshipError) throw friendshipError;
            
            showNotification("Solicitud aceptada", "success");
            await this.loadFriendRequests();
            await this.loadFriendsList();
            
        } catch (error) {
            console.error("Error al aceptar solicitud:", error);
            showNotification("Error al aceptar la solicitud", "error");
        }
    }

    async rejectFriendRequest(requestId) {
        try {
            if (!this.initialized) await this.init();
            
            const { error } = await supabaseClient
                .from('friend_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId);
                
            if (error) throw error;
            
            showNotification("Solicitud rechazada", "info");
            await this.loadFriendRequests();
            
        } catch (error) {
            console.error("Error al rechazar solicitud:", error);
            showNotification("Error al rechazar la solicitud", "error");
        }
    }

    async loadFriendRequests() {
        try {
            if (!this.initialized) await this.init();
            
            const { data: requests, error } = await supabaseClient
                .from('friend_requests')
                .select('id, sender_id, sender_user_id, status, created_at, message')
                .eq('receiver_id', this.currentUser.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            // Actualizar UI
            this.updateFriendRequestsUI(requests);
            
            return requests;
            
        } catch (error) {
            console.error("Error al cargar solicitudes:", error);
            showNotification("Error al cargar solicitudes", "error");
            return [];
        }
    }

    async loadFriendsList(filter = 'all') {
        try {
            if (!this.initialized) await this.init();
            
            let query = supabaseClient
                .from('friendships')
                .select(`
                    id,
                    user1_id,
                    user2_id,
                    user1_user_id,
                    user2_user_id,
                    created_at,
                    profiles!friendships_user1_id_fkey(username, full_name, avatar_url, status),
                    profiles!friendships_user2_id_fkey(username, full_name, avatar_url, status)
                `)
                .or(`user1_id.eq.${this.currentUser.id},user2_id.eq.${this.currentUser.id}`);
                
            if (filter === 'online') {
                query = query.or('profiles!friendships_user1_id_fkey.status.eq.online,profiles!friendships_user2_id_fkey.status.eq.online');
            }
            
            const { data: friendships, error } = await query;
            
            if (error) throw error;
            
            // Actualizar UI
            this.updateFriendsListUI(friendships, filter);
            
            return friendships;
            
        } catch (error) {
            console.error("Error al cargar lista de amigos:", error);
            showNotification("Error al cargar lista de amigos", "error");
            return [];
        }
    }

    updateFriendRequestsUI(requests) {
        const pendingTab = document.getElementById('pendingTab');
        const friendList = document.getElementById('friendList');
        
        if (!pendingTab || !friendList) return;
        
        // Actualizar contador
        const countBadge = pendingTab.querySelector('.pending-count') || document.createElement('span');
        countBadge.className = 'pending-count';
        countBadge.textContent = requests?.length || 0;
        
        if (requests?.length > 0 && !pendingTab.contains(countBadge)) {
            pendingTab.appendChild(countBadge);
        } else if (requests?.length === 0 && pendingTab.contains(countBadge)) {
            countBadge.remove();
        }
        
        // Actualizar lista
        if (document.querySelector('.friend-tab.active')?.id === 'pendingTab') {
            if (requests?.length > 0) {
                friendList.innerHTML = requests.map(request => this.createFriendRequestHTML(request)).join('');
                this.setupRequestButtons();
            } else {
                friendList.innerHTML = '<p class="placeholder-text">No tienes solicitudes pendientes</p>';
            }
        }
    }

    updateFriendsListUI(friendships, filter) {
        const friendList = document.getElementById('friendList');
        if (!friendList) return;
        
        if (friendships?.length > 0) {
            friendList.innerHTML = friendships
                .map(friendship => this.createFriendItemHTML(friendship))
                .join('');
        } else {
            friendList.innerHTML = `<p class="placeholder-text">No tienes amigos ${filter === 'online' ? 'en línea' : ''}</p>`;
        }
    }

    createFriendRequestHTML(request) {
        return `
            <div class="friend-request-item" data-request-id="${request.id}">
                <div class="friend-request-info">
                    <h4>${request.sender_user_id}</h4>
                    <p>${request.message || 'Hola, me gustaría añadirte como amigo'}</p>
                    <small>${new Date(request.created_at).toLocaleString()}</small>
                </div>
                <div class="friend-request-actions">
                    <button class="friend-action-btn accept-btn" data-request-id="${request.id}" data-sender-id="${request.sender_id}" data-sender-user-id="${request.sender_user_id}">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="friend-action-btn reject-btn" data-request-id="${request.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }

    createFriendItemHTML(friendship) {
        const friend = friendship.user1_id === this.currentUser.id ? 
            friendship.profiles_friendships_user2_id_fkey : 
            friendship.profiles_friendships_user1_id_fkey;
            
        return `
            <div class="friend-item" data-friend-id="${friend.id}">
                <img src="${friend.avatar_url || 'https://i.ibb.co/ZRXTrM6w/ic-launcher.png'}" alt="Avatar" class="friend-avatar">
                <div class="friend-info">
                    <h4>${friend.full_name || friend.username}</h4>
                    <p class="friend-status ${friend.status}">${this.getStatusText(friend.status)}</p>
                </div>
                <div class="friend-actions">
                    <button class="friend-action-btn chat-btn" title="Enviar mensaje">
                        <i class="fas fa-comment"></i>
                    </button>
                </div>
            </div>
        `;
    }

    setupRequestButtons() {
        document.querySelectorAll('.accept-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.dataset.requestId;
                const senderId = btn.dataset.senderId;
                const senderUserID = btn.dataset.senderUserId;
                
                showNotification('Aceptando solicitud...', 'info');
                this.acceptFriendRequest(requestId, senderId, senderUserID);
            });
        });
        
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.dataset.requestId;
                showNotification('Rechazando solicitud...', 'info');
                this.rejectFriendRequest(requestId);
            });
        });
    }

    getStatusText(status) {
        const statusTexts = {
            online: 'En línea',
            idle: 'Ausente',
            dnd: 'No molestar',
            invisible: 'Invisible',
            offline: 'Desconectado'
        };
        return statusTexts[status] || 'Desconectado';
    }

    openFriendRequests() {
        const friendsNavBtn = document.querySelector('.nav-item[data-section="friends"]');
        if (friendsNavBtn) {
            friendsNavBtn.click();
            setTimeout(() => {
                const pendingTab = document.getElementById('pendingTab');
                if (pendingTab) pendingTab.click();
            }, 300);
        }
    }
}

// Inicializar sistema de amigos
window.friendsSystem = new FriendsSystem();
window.friendsSystem.init();

// Inicialización del sistema de amigos
async function initFriendsSystem() {
    console.log("Inicializando sistema de amigos...");
    
    // Si ya está inicializado, no hacerlo de nuevo
    if (window.friendsSystemInitialized) {
        console.log("Sistema de amigos ya inicializado");
        return;
    }
    
    try {
        // Obtener el usuario actual
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError) {
            console.error("Error al obtener usuario:", userError);
            showNotification("Error al inicializar sistema de amigos", "error");
            return;
        }
        
        if (!user) {
            console.log("No hay usuario autenticado");
            return;
        }
        
        window.currentUser = user;
        console.log("Usuario actual:", window.currentUser);
        
        // Asegurarse de que el usuario tenga un ID personalizado
        window.currentUserID = await userIDSystem.ensureUserHasID(user.id);
        console.log("ID personalizado del usuario:", window.currentUserID);
        
        // Verificar si existen las tablas necesarias
        await setupFriendshipTables();
        
        // Suscribirse a cambios en tiempo real
        setupRealtimeSubscriptions();
        
        // Marcar como inicializado
        window.friendsSystemInitialized = true;
        console.log("Sistema de amigos inicializado correctamente");
    } catch (error) {
        console.error("Error inesperado al inicializar sistema de amigos:", error);
        showNotification("Error al inicializar sistema de amigos", "error");
    }
}

// Configurar tablas de amistad si no existen
async function setupFriendshipTables() {
    try {
        // Verificar si la tabla friend_requests existe
        const { error: checkError } = await supabaseClient
            .from('friend_requests')
            .select('id')
            .limit(1)
            .throwOnError();
        
        // Si hay un error, probablemente la tabla no existe
        if (checkError && checkError.code === '42P01') {
            console.log("La tabla friend_requests no existe, creando...")
            // En una aplicación real, deberías crear la tabla desde el panel de Supabase
            // Aquí solo mostramos un mensaje informativo
            console.warn("Las tablas necesarias no existen en Supabase. Por favor, crea las siguientes tablas:")
            console.warn("1. friend_requests (id, sender_id, receiver_id, status, created_at)")
            console.warn("2. friendships (id, user1_id, user2_id, created_at)")
            console.warn("3. messages (id, sender_id, receiver_id, content, read, created_at)")
        }
    } catch (error) {
        console.error("Error al verificar tablas:", error);
    }
}

// Configurar suscripciones en tiempo real
function setupRealtimeSubscriptions() {
    // Verificar que tengamos un usuario antes de suscribirnos
    if (!window.currentUser || !window.currentUser.id) {
        console.warn("No hay usuario autenticado para suscripciones en tiempo real");
        return;
    }

    // Si ya existe una suscripción activa, removerla primero
    if (window.friendRequestsChannel) {
        console.log("Removiendo suscripción existente antes de crear una nueva");
        window.friendRequestsChannel.unsubscribe();
    }
    
    console.log("Configurando suscripciones en tiempo real para solicitudes de amistad");
    
    // Canal para solicitudes de amistad
    const userId = window.currentUser.id;
    console.log(`Creando suscripción para el usuario ${userId}`);
    
    window.friendRequestsChannel = supabaseClient
        .channel('friend_requests_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
            async (payload) => {
                console.log("Cambio detectado en solicitudes de amistad:", payload);
                
                // Verificar el tipo de evento
                if (payload.eventType === 'INSERT' && payload.new && payload.new.status === 'pending') {
                    console.log("Nueva solicitud de amistad recibida");
                    
                    // Buscar datos del remitente para la notificación
                    try {
                        const { data: senderProfile } = await supabaseClient
                            .from('profiles')
                            .select('username, full_name, avatar_url')
                            .eq('id', payload.new.sender_id)
                            .single();
                        
                        const senderName = senderProfile?.full_name || senderProfile?.username || "Alguien";
                        
                        // Mostrar notificación
                        showNotification(`¡${senderName} te ha enviado una solicitud de amistad!`, 'friend-request', 8000);
                        
                        // Mostrar notificación flotante más detallada
                        showFloatingNotification({
                            title: 'Nueva solicitud de amistad',
                            message: `${senderName} quiere ser tu amigo`,
                            type: 'friend-request',
                            icon: 'user-plus',
                            duration: 10000,
                            sound: 'friend-request',
                            action: () => {
                                // Cargar la sección de amigos
                                const friendsNavBtn = document.querySelector('.nav-item[data-section="friends"]');
                                if (friendsNavBtn) {
                                    friendsNavBtn.click();
                                    
                                    // Activar la pestaña de pendientes
                                    setTimeout(() => {
                                        const pendingTab = document.getElementById('pendingTab');
                                        if (pendingTab) pendingTab.click();
                                    }, 300);
                                }
                            }
                        });
                        
                        // Reproducir sonido
                        playNotificationSound('friend-request');
                    } catch (error) {
                        console.error("Error al obtener datos del remitente:", error);
                        showNotification("Has recibido una nueva solicitud de amistad", 'friend-request');
                    }
                    
                    // Recargar solicitudes para actualizar UI
                    loadFriendRequests().catch(err => {
                        console.error("Error al recargar solicitudes:", err);
                    });
                } 
                // Actualización de estado (aceptada/rechazada)
                else if (payload.eventType === 'UPDATE') {
                    console.log(`Solicitud de amistad actualizada a estado: ${payload.new.status}`);
                    
                    // Recargar la lista de amigos si la solicitud fue aceptada
                    if (payload.new.status === 'accepted') {
                        loadFriendsList().catch(err => {
                            console.error("Error al recargar lista de amigos:", err);
                        });
                    }
                }
            }
        )
        .subscribe((status) => {
            console.log("Estado de suscripción a solicitudes de amistad:", status);
            
            if (status === 'SUBSCRIBED') {
                console.log("✅ Suscripción a solicitudes de amistad activa");
            } else if (status === 'CHANNEL_ERROR') {
                console.error("❌ Error en la suscripción a solicitudes de amistad");
                
                // Reintentar después de un tiempo
                setTimeout(() => {
                    console.log("Reintentando suscripción...");
                    setupRealtimeSubscriptions();
                }, 5000);
            }
        });
}

// Cargar la sección de amigos
async function loadFriendsSection() {
    const contentTitle = document.getElementById('contentTitle');
    const mainContentArea = document.getElementById('mainContentArea');
    
    if (contentTitle) contentTitle.textContent = 'Amigos';
    
    if (mainContentArea) {
        mainContentArea.innerHTML = `
            <div class="friends-container">
                <div class="friends-header">
                    <div class="friends-tabs">
                        <button class="friend-tab active" data-filter="online">En línea</button>
                        <button class="friend-tab" data-filter="all">Todos</button>
                        <button class="friend-tab" data-filter="pending">Pendientes</button>
                        <button class="friend-tab" data-filter="blocked">Bloqueados</button>
                    </div>
                    <button class="cyber-btn primary small" id="addFriendBtn">Añadir amigo</button>
                </div>
                
                <div class="add-friend-section" style="display: none;">
                    <label for="addFriendInput">Añade un amigo con su ID (SCRAKK-XXXXXXXX)</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="addFriendInput" placeholder="Ingresa un ID de usuario (SCRAKK-XXXXXXXX)" class="cyber-input flex-grow">
                        <button class="cyber-btn success small" id="sendFriendRequestBtn">Enviar solicitud</button>
                    </div>
                    <div class="friend-id-info" style="margin-top: 8px; font-size: 0.9em; opacity: 0.7;">
                        <p>Tu ID: <span id="currentUserIDDisplay" style="font-weight: bold; user-select: all;">Cargando...</span></p>
                        <p><i class="fas fa-info-circle"></i> Comparte este ID para que otros usuarios puedan enviarte solicitudes</p>
                    </div>
                    <span id="addFriendError" class="error-message" style="color: var(--db-dnd);"></span>
                    <span id="addFriendSuccess" class="success-message" style="color: var(--db-online);"></span>
                </div>
                
                <div class="friend-list-container">
                    <h3 id="friendListTitle">En línea — <span id="friendCount">0</span></h3>
                    <div id="friendList" class="friend-list">
                        <p class="placeholder-text">Cargando amigos...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Asegurarse de que el sistema de amigos está inicializado antes de continuar
        if (!window.friendsSystemInitialized) {
            await initFriendsSystem();
        }
        
        // Configurar listeners
        setupFriendsListeners();
        
        // Cargar amigos
        await loadFriendsList('online');
        
        // Cargar solicitudes pendientes
        await loadFriendRequests();
    }
}

// Configurar listeners para la sección de amigos
function setupFriendsListeners() {
    const addFriendBtn = document.getElementById('addFriendBtn');
    const addFriendSection = document.querySelector('.add-friend-section');
    const sendFriendRequestBtn = document.getElementById('sendFriendRequestBtn');
    const addFriendInput = document.getElementById('addFriendInput');
    const friendTabs = document.querySelectorAll('.friend-tab');
    
    // Mostrar/ocultar sección para añadir amigos
    if (addFriendBtn && addFriendSection) {
        addFriendBtn.addEventListener('click', () => {
            const isVisible = addFriendSection.style.display === 'block';
            addFriendSection.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                // Mostrar el ID del usuario actual
                const currentUserIDDisplay = document.getElementById('currentUserIDDisplay');
                if (currentUserIDDisplay) {
                    currentUserIDDisplay.textContent = currentUserID || 'No disponible';
                }
                
                addFriendInput.focus();
            }
        });
    }
    
    // Enviar solicitud de amistad
    if (sendFriendRequestBtn && addFriendInput) {
        const sendFriendRequest = async () => {
            const userID = addFriendInput.value.trim();
            const errorElement = document.getElementById('addFriendError');
            const successElement = document.getElementById('addFriendSuccess');
            
            if (!userID) {
                errorElement.textContent = 'Por favor, ingresa un ID de usuario';
                successElement.textContent = '';
                return;
            }
            
            // Validar formato del ID
            if (!userIDSystem.isValidUserID(userID)) {
                errorElement.textContent = 'ID de usuario inválido. Debe tener el formato SCRAKK-XXXXXXXX';
                successElement.textContent = '';
                return;
            }
            
            // Verificar que no sea el ID propio
            if (userID === currentUserID) {
                errorElement.textContent = 'No puedes enviarte una solicitud a ti mismo';
                successElement.textContent = '';
                return;
            }
            
            try {
                console.log(`Buscando usuario con ID: ${userID}`);
                
                // Verificar primero si ya estamos autenticados
                if (!window.currentUser || !window.currentUser.id) {
                    errorElement.textContent = 'Necesitas iniciar sesión para enviar solicitudes';
                    successElement.textContent = '';
                    return;
                }
                
                // Buscar usuario por ID usando una consulta directa más fiable
                const { data: profiles, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('id, username, full_name, user_id')
                    .eq('user_id', userID)
                    .limit(1);
                    
                if (profileError) {
                    console.error('Error al buscar usuario:', profileError);
                    errorElement.textContent = 'Error al buscar usuario';
                    successElement.textContent = '';
                    return;
                }
                
                const foundUser = profiles && profiles.length > 0 ? profiles[0] : null;
                
                console.log('Usuario encontrado:', foundUser);
                
                if (!foundUser) {
                    errorElement.textContent = 'Usuario no encontrado con ese ID';
                    successElement.textContent = '';
                    return;
                }
                
                if (foundUser.id === window.currentUser.id) {
                    errorElement.textContent = 'No puedes enviarte una solicitud a ti mismo';
                    successElement.textContent = '';
                    return;
                }
                
                // Verificar si ya existe una solicitud pendiente
                const { data: existingRequest, error: checkError } = await supabaseClient
                    .from('friend_requests')
                    .select('*')
                    .eq('sender_id', window.currentUser.id)
                    .eq('receiver_id', foundUser.id)
                    .eq('status', 'pending')
                    .maybeSingle();
                    
                if (checkError && checkError.code !== 'PGRST116') {
                    console.error('Error al verificar solicitud existente:', checkError);
                    errorElement.textContent = 'Error al verificar solicitud existente';
                    successElement.textContent = '';
                    return;
                }
                
                if (existingRequest) {
                    errorElement.textContent = 'Ya has enviado una solicitud a este usuario';
                    successElement.textContent = '';
                    return;
                }
                
                // Verificar si ya son amigos
                const { data: existingFriendship, error: friendshipError } = await supabaseClient
                    .from('friendships')
                    .select('*')
                    .or(`and(user1_id.eq.${window.currentUser.id},user2_id.eq.${foundUser.id}),and(user1_id.eq.${foundUser.id},user2_id.eq.${window.currentUser.id})`)
                    .maybeSingle();
                    
                if (friendshipError && friendshipError.code !== 'PGRST116') {
                    console.error('Error al verificar amistad existente:', friendshipError);
                    errorElement.textContent = 'Error al verificar amistad existente';
                    successElement.textContent = '';
                    return;
                }
                
                if (existingFriendship) {
                    errorElement.textContent = 'Ya eres amigo de este usuario';
                    successElement.textContent = '';
                    return;
                }
                
                // Enviar solicitud
                const { data: newRequest, error: insertError } = await supabaseClient
                    .from('friend_requests')
                    .insert([{
                        sender_id: window.currentUser.id,
                        receiver_id: foundUser.id,
                        sender_user_id: window.currentUserID,
                        receiver_user_id: userID,
                        status: 'pending',
                        created_at: new Date().toISOString()
                    }])
                    .select();
                
                if (insertError) {
                    console.error('Error al insertar solicitud:', insertError);
                    errorElement.textContent = 'Error al enviar la solicitud';
                    successElement.textContent = '';
                    return;
                }
                
                errorElement.textContent = '';
                successElement.textContent = `Solicitud enviada a ${foundUser.full_name || foundUser.username || 'Usuario'}`;
                addFriendInput.value = '';
                
                // Mostrar notificación
                showNotification(`Solicitud enviada a ${foundUser.full_name || foundUser.username || 'Usuario'}`, 'success');
                
                // Actualizar lista de solicitudes pendientes
                loadFriendRequests();
                
                console.log('Solicitud enviada exitosamente:', newRequest);
                
            } catch (error) {
                console.error('Error al enviar solicitud:', error);
                errorElement.textContent = 'Error al enviar la solicitud';
                successElement.textContent = '';
            }
        };
        
        sendFriendRequestBtn.addEventListener('click', sendFriendRequest);
        
        // También enviar al presionar Enter
        addFriendInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendFriendRequest();
            }
        });
    }
    
    // Cambiar filtro de amigos
    if (friendTabs) {
        friendTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Quitar clase activa de todas las pestañas
                friendTabs.forEach(t => t.classList.remove('active'));
                // Añadir clase activa a la pestaña clickeada
                tab.classList.add('active');
                
                // Cargar lista según el filtro
                const filter = tab.dataset.filter;
                loadFriendsList(filter);
            });
        });
    }
}

// Enviar solicitud de amistad
async function sendFriendRequest() {
    try {
        // Obtener el valor del ID ingresado
        const friendIDInput = document.getElementById('addFriendInput');
        
        if (!friendIDInput) {
            console.error("No se encontró el campo de entrada de ID");
            showNotification("Error al procesar la solicitud", "error");
            return;
        }
        
        const friendID = friendIDInput.value.trim();
        
        // Validar que se haya ingresado un ID
        if (!friendID) {
            showNotification("Ingresa el ID del usuario", "warning");
            return;
        }
        
        // Validar formato del ID
        if (!userIDSystem.isValidUserID(friendID)) {
            showNotification("El formato del ID no es válido. Debe comenzar con SCRAKK-", "warning");
            return;
        }
        
        // Mostrar estado de carga
        showNotification("Buscando usuario...", "info");
        
        // Verificar si el usuario existe
        const user = await userIDSystem.findUserByID(friendID);
        
        if (!user) {
            console.log("No se encontró usuario con ID:", friendID);
            showNotification("No se encontró ningún usuario con ese ID", "error");
            return;
        }
        
        // Verificar que no sea el mismo usuario
        const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
        
        if (user.id === currentUser.id) {
            showNotification("No puedes enviarte una solicitud a ti mismo", "warning");
            return;
        }
        
        console.log(`Usuario encontrado: ${user.id}, verificando si ya son amigos...`);
        
        // Verificar si ya son amigos
        const { data: existingFriendship, error: friendshipError } = await supabaseClient
            .from('friendships')
            .select('id')
            .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
            .maybeSingle();
        
        if (friendshipError) {
            console.error("Error al verificar amistad:", friendshipError);
            showNotification("Error al verificar si ya son amigos", "error");
            return;
        }
        
        if (existingFriendship) {
            showNotification("Ya son amigos", "info");
            return;
        }
        
        // Verificar si ya existe una solicitud pendiente del usuario actual
        const { data: existingSentRequest, error: sentRequestError } = await supabaseClient
            .from('friend_requests')
            .select('id, status')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', user.id)
            .maybeSingle();
        
        if (sentRequestError) {
            console.error("Error al verificar solicitud enviada:", sentRequestError);
            showNotification("Error al verificar solicitudes enviadas", "error");
            return;
        }
        
        // Si ya existe una solicitud pendiente, no enviar otra
        if (existingSentRequest) {
            if (existingSentRequest.status === 'pending') {
                showNotification("Ya enviaste una solicitud a este usuario", "info");
                return;
            } else if (existingSentRequest.status === 'rejected') {
                showNotification("Este usuario rechazó tu solicitud anteriormente", "warning");
                return;
            }
        }
        
        // Verificar solicitudes recibidas
        const { data: existingReceivedRequest, error: receivedRequestError } = await supabaseClient
            .from('friend_requests')
            .select('id, status')
            .eq('sender_id', user.id)
            .eq('receiver_id', currentUser.id)
            .maybeSingle();
            
        if (receivedRequestError) {
            console.error("Error al verificar solicitud recibida:", receivedRequestError);
        } else if (existingReceivedRequest) {
            if (existingReceivedRequest.status === 'pending') {
                // Si hay una solicitud pendiente del otro usuario, aceptarla automáticamente
                showNotification("Este usuario ya te envió una solicitud. Aceptando automáticamente.", "success");
                
                // Aceptar solicitud
                await acceptFriendRequest(
                    existingReceivedRequest.id, 
                    user.id, 
                    friendID  // Este es el user_id personalizado
                );
                
                return;
            }
        }
        
        // Obtener nuestro ID personalizado
        const senderUserID = await userIDSystem.ensureUserHasID(currentUser.id);
        
        // Todo está bien, enviar solicitud
        showNotification("Enviando solicitud...", "info");
        
        // Registrar la solicitud en la base de datos
        const { data: newRequest, error: requestError } = await supabaseClient
            .from('friend_requests')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: user.id,
                    sender_user_id: senderUserID,
                    receiver_user_id: friendID,
                    status: 'pending',
                    message: 'Hola, me gustaría añadirte como amigo'
                }
            ])
            .select();
        
        if (requestError) {
            console.error("Error al enviar solicitud:", requestError);
            showNotification("Error al enviar la solicitud", "error");
            return;
        }
        
        console.log("Solicitud enviada exitosamente:", newRequest);
        
        // Limpiar campo
        friendIDInput.value = '';
        
        // Mensaje de éxito
        showNotification("Solicitud enviada exitosamente", "success");
        
    } catch (error) {
        console.error("Error al enviar solicitud de amistad:", error);
        showNotification("Error al procesar la solicitud", "error");
    }
}

// Cargar lista de amigos según el filtro
async function loadFriendsList(filter = 'online') {
    console.log(`Cargando lista de amigos (filtro: ${filter})...`);
    
    try {
        // Verificar autenticación primero
        if (!window.currentUser) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            
            if (!user) {
                console.log("No hay usuario autenticado para cargar lista de amigos");
                const friendList = document.getElementById('friendList');
                if (friendList) {
                    friendList.innerHTML = `<p class="placeholder-text">Inicia sesión para ver tus amigos</p>`;
                }
                return;
            }
            
            window.currentUser = user;
            
            // También necesitamos asegurarnos de tener el ID personalizado
            if (!window.currentUserID) {
                window.currentUserID = await userIDSystem.ensureUserHasID(user.id);
            }
        }
        
        // Actualizar el título según el filtro
        const friendListTitle = document.getElementById('friendListTitle');
        if (friendListTitle) {
            let title = '';
            switch (filter) {
                case 'online': title = 'En línea'; break;
                case 'all': title = 'Todos'; break;
                case 'pending': title = 'Pendientes'; break;
                case 'blocked': title = 'Bloqueados'; break;
                default: title = 'Amigos';
            }
            friendListTitle.innerHTML = `${title} — <span id="friendCount">0</span>`;
        }
        
        // Obtener lista de amigos
        const { data: friendships, error: friendshipsError } = await supabaseClient
            .from('friendships')
            .select('id, user1_id, user2_id')
            .or(`user1_id.eq.${window.currentUser.id},user2_id.eq.${window.currentUser.id}`);
        
        if (friendshipsError) {
            console.error('Error al cargar amistades:', friendshipsError);
            const friendList = document.getElementById('friendList');
            if (friendList) {
                friendList.innerHTML = '<p class="placeholder-text">Error al cargar amigos</p>';
            }
            return;
        }
        
        if (!friendships || friendships.length === 0) {
            const friendList = document.getElementById('friendList');
            if (friendList) {
                friendList.innerHTML = '<p class="placeholder-text">No tienes amigos aún</p>';
            }
            return;
        }
        
        // Extraer IDs de amigos
        const friendIds = friendships.map(friendship => {
            return friendship.user1_id === window.currentUser.id ? friendship.user2_id : friendship.user1_id;
        });
        
        // Obtener perfiles de amigos
        const { data: friendProfiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name, avatar_url, status')
            .in('id', friendIds);
        
        if (profilesError) {
            console.error('Error al cargar perfiles de amigos:', profilesError);
            const friendList = document.getElementById('friendList');
            if (friendList) {
                friendList.innerHTML = '<p class="placeholder-text">Error al cargar perfiles</p>';
            }
            return;
        }
        
        // Filtrar según el tipo
        let filteredFriends = friendProfiles;
        if (filter === 'online') {
            filteredFriends = friendProfiles.filter(friend => friend.status === 'online');
        }
        
        // Actualizar contador
        const friendCount = document.getElementById('friendCount');
        if (friendCount) {
            friendCount.textContent = filteredFriends.length.toString();
        }
        
        // Guardar lista actual
        window.currentFriendsList = filteredFriends;
        
        // Si no hay amigos después del filtro
        if (filteredFriends.length === 0) {
            const friendList = document.getElementById('friendList');
            if (friendList) {
                friendList.innerHTML = `<p class="placeholder-text">No tienes amigos ${filter === 'online' ? 'en línea' : ''}</p>`;
            }
            return;
        }
        
        // Renderizar lista
        let friendsHTML = '';
        filteredFriends.forEach(friend => {
            friendsHTML += `
                <div class="friend-item" data-friend-id="${friend.id}">
                    <div class="friend-avatar">
                        <img src="${friend.avatar_url || 'img/default-avatar.png'}" alt="${friend.full_name || friend.username}">
                        <div class="friend-status ${friend.status || 'offline'}"></div>
                    </div>
                    <div class="friend-info">
                        <div class="friend-name">${friend.full_name || friend.username}</div>
                        <div class="friend-status-text">${getStatusText(friend.status || 'offline')}</div>
                    </div>
                    <div class="friend-actions">
                        <button class="friend-action-btn chat-btn" title="Enviar mensaje" data-friend-id="${friend.id}">
                            <i class="fas fa-comment"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        const friendList = document.getElementById('friendList');
        if (friendList) {
            friendList.innerHTML = friendsHTML;
        }
        
        // Añadir listeners a los botones de chat
        const chatButtons = document.querySelectorAll('.chat-btn');
        chatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const friendId = btn.dataset.friendId;
                openChat(friendId);
            });
        });
        
    } catch (error) {
        console.error("Error al cargar lista de amigos:", error);
        const friendList = document.getElementById('friendList');
        if (friendList) {
            friendList.innerHTML = '<p class="placeholder-text">Error al cargar amigos</p>';
        }
    }
}

// Cargar solicitudes de amistad pendientes
async function loadFriendRequests() {
    console.log("Cargando solicitudes de amistad...");
    
    try {
        // Verificar autenticación primero
        if (!window.currentUser) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            
            if (!user) {
                console.log("No hay usuario autenticado para cargar solicitudes de amistad");
                return;
            }
            
            window.currentUser = user;
            
            // También necesitamos asegurarnos de tener el ID personalizado
            if (!window.currentUserID) {
                window.currentUserID = await userIDSystem.ensureUserHasID(user.id);
            }
        }
        
        // Obtener solicitudes pendientes donde este usuario es el receptor
        const { data: requests, error: requestsError } = await supabaseClient
            .from('friend_requests')
            .select('id, sender_id, sender_user_id, status, created_at, message')
            .eq('receiver_id', window.currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (requestsError) {
            console.error("Error al cargar solicitudes de amistad:", requestsError);
            const pendingTab = document.getElementById('pendingTab');
            if (pendingTab) {
                if (pendingTab.querySelector('.pending-count')) {
                    pendingTab.querySelector('.pending-count').remove();
                }
            }
            
            // Si hay un elemento friendList, mostrar el error
            const friendList = document.getElementById('friendList');
            if (friendList) {
                friendList.innerHTML = `<p class="placeholder-text">Error al cargar solicitudes: ${requestsError.message || 'Error desconocido'}</p>`;
            }
            
            showNotification('Error al cargar solicitudes de amistad', 'error');
            return;
        }
        
        console.log("Solicitudes pendientes encontradas:", requests?.length || 0);
        
        // Obtener el contenedor donde se muestran las solicitudes
        const friendList = document.getElementById('friendList');
        
        // Asegurarnos de que estamos en la tab correcta
        const pendingTab = document.getElementById('pendingTab');
        if (pendingTab) {
            // Actualizar indicador de solicitudes pendientes
            updateFriendsNavIndicator(requests?.length || 0);
            
            // Si hay solicitudes, mostrarlas
            if (requests && requests.length > 0) {
                // Si hay un contador en el tab, actualizarlo
                let countBadge = pendingTab.querySelector('.pending-count');
                if (!countBadge) {
                    countBadge = document.createElement('span');
                    countBadge.className = 'pending-count';
                    pendingTab.appendChild(countBadge);
                }
                countBadge.textContent = requests.length;
                
                // Mostrar notificaciones si es necesario
                if (!window.initialRequestsLoaded) {
                    window.initialRequestsLoaded = true;
                    showFriendRequestNotifications(requests);
                }
                
                // Si friendList existe y estamos en la pestaña correcta, mostrar las solicitudes
                if (friendList && document.querySelector('.friend-tab.active')?.id === 'pendingTab') {
                    console.log("Mostrando solicitudes en el DOM");
                    await displayPendingRequests(requests);
                }
            } else {
                // Si no hay solicitudes, eliminar el contador si existe
                const countBadge = pendingTab.querySelector('.pending-count');
                if (countBadge) {
                    countBadge.remove();
                }
                
                // Si friendList existe y estamos en la pestaña correcta, mostrar mensaje vacío
                if (friendList && document.querySelector('.friend-tab.active')?.id === 'pendingTab') {
                    friendList.innerHTML = '<p class="placeholder-text">No tienes solicitudes pendientes</p>';
                }
            }
        }
        
        return requests;
    } catch (error) {
        console.error("Error inesperado al cargar solicitudes:", error);
        
        // Mostrar error en la interfaz
        const friendList = document.getElementById('friendList');
        if (friendList) {
            friendList.innerHTML = `<p class="placeholder-text">Error inesperado: ${error.message || 'Error desconocido'}</p>`;
        }
        
        // Notificar al usuario
        showNotification('Error al cargar solicitudes de amistad', 'error');
    }
}

// Mostrar notificaciones para nuevas solicitudes de amistad
async function showFriendRequestNotifications(newRequests) {
    if (!newRequests || newRequests.length === 0) return;
    
    // Notificar sobre cada solicitud recibida
    for (const request of newRequests) {
        try {
            // Obtener información del usuario que envía la solicitud
            const { data: senderData, error: senderError } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', request.sender_id)
                .single();
                
            if (senderError) throw senderError;
            
            const username = senderData?.username || 'Usuario';
            const avatarUrl = senderData?.avatar_url || 'https://i.ibb.co/ZRXTrM6w/ic-launcher.png';
            
            // Mostrar notificación flotante con la nueva solicitud
            showFloatingNotification(
                'Nueva solicitud de amistad',
                `${username} quiere ser tu amigo`,
                avatarUrl,
                'Ver solicitudes',
                () => {
                    loadSectionContent('friends');
                    setTimeout(() => {
                        document.getElementById('friendRequestsTab')?.click();
                    }, 100);
                }
            );
            
            // Notificación estándar
            showNotification('friend', `Nueva solicitud de amistad de ${username}`, 5000);
            
            // Reproducir sonido
            if (window.notifications) {
                window.notifications.playSound('friendRequest');
            }
            
            // Actualizar indicador en la barra lateral
            updateFriendsNavIndicator(newRequests.length);
            
        } catch (error) {
            console.error('Error al mostrar notificación de solicitud:', error);
        }
    }
}

// Mostrar solicitudes pendientes
async function displayPendingRequests(requests) {
    console.log("Mostrando solicitudes pendientes:", requests);
    const friendList = document.getElementById('friendList');
    const friendCount = document.getElementById('friendCount');
    
    if (!friendList) {
        console.error("No se encontró el elemento friendList");
        return;
    }
    
    if (!requests || requests.length === 0) {
        friendList.innerHTML = '<p class="placeholder-text">No tienes solicitudes pendientes</p>';
        if (friendCount) friendCount.textContent = '0';
        return;
    }
    
    // Actualizar contador
    if (friendCount) friendCount.textContent = requests.length.toString();
    
    try {
        // Obtener perfiles de los remitentes
        const senderIds = requests.map(req => req.sender_id);
        console.log("IDs de remitentes a buscar:", senderIds);
        
        if (senderIds.length === 0) {
            friendList.innerHTML = '<p class="placeholder-text">Error: No se pudieron obtener los IDs de los remitentes</p>';
            return;
        }
        
        const { data: senderProfiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name, avatar_url, bio, status')
            .in('id', senderIds);
        
        if (profilesError) {
            console.error('Error al cargar perfiles de remitentes:', profilesError);
            friendList.innerHTML = `<p class="placeholder-text">Error al cargar perfiles: ${profilesError.message || 'Error desconocido'}</p>`;
            return;
        }
        
        if (!senderProfiles || senderProfiles.length === 0) {
            console.warn("No se encontraron perfiles para los remitentes:", senderIds);
            // Mostrar solicitudes sin información de perfil
            let simpleRequestsHTML = '';
            requests.forEach(request => {
                simpleRequestsHTML += `
                    <div class="friend-request-item" data-request-id="${request.id}">
                        <div class="friend-avatar">
                            <img src="img/default-avatar.png" alt="Usuario">
                        </div>
                        <div class="friend-request-info">
                            <div class="friend-name">Usuario (ID: ${request.sender_id})</div>
                            <div class="friend-user-id">ID: <span class="user-id-display">${request.sender_user_id || 'No disponible'}</span></div>
                            <div class="friend-status-text">
                                <div>Solicitud recibida el ${new Date(request.created_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                        <div class="friend-request-actions">
                            <button class="friend-action-btn accept-btn" title="Aceptar solicitud" data-request-id="${request.id}" data-sender-id="${request.sender_id}" data-sender-user-id="${request.sender_user_id || ''}">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="friend-action-btn reject-btn" title="Rechazar solicitud" data-request-id="${request.id}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            friendList.innerHTML = simpleRequestsHTML;
            setupRequestButtons();
            return;
        }
        
        console.log("Perfiles de remitentes obtenidos:", senderProfiles);
        
        // Crear mapa de perfiles para acceso rápido
        const profilesMap = {};
        senderProfiles.forEach(profile => {
            profilesMap[profile.id] = profile;
        });
        
        // Renderizar solicitudes
        let requestsHTML = '';
        requests.forEach(request => {
            const sender = profilesMap[request.sender_id] || { username: 'Usuario desconocido' };
            const requestDate = new Date(request.created_at).toLocaleDateString();
            const requestTime = new Date(request.created_at).toLocaleTimeString();
            const senderUserID = request.sender_user_id || 'ID no disponible';
            const statusText = getStatusText(sender.status);
            
            requestsHTML += `
                <div class="friend-request-item" data-request-id="${request.id}">
                    <div class="friend-avatar">
                        <img src="${sender.avatar_url || 'img/default-avatar.png'}" alt="${sender.full_name || sender.username || 'Usuario'}">
                    </div>
                    <div class="friend-request-info">
                        <div class="friend-name">${sender.full_name || sender.username || 'Usuario'}</div>
                        <div class="friend-user-id">ID: <span class="user-id-display">${senderUserID}</span></div>
                        <div class="friend-status-text">
                            ${sender.bio ? `<div class="friend-bio">"${sender.bio.substring(0, 50)}${sender.bio.length > 50 ? '...' : ''}"</div>` : ''}
                            <div>Solicitud recibida el ${requestDate} a las ${requestTime}</div>
                        </div>
                    </div>
                    <div class="friend-request-actions">
                        <button class="friend-action-btn accept-btn" title="Aceptar solicitud" data-request-id="${request.id}" data-sender-id="${request.sender_id}" data-sender-user-id="${senderUserID}">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="friend-action-btn reject-btn" title="Rechazar solicitud" data-request-id="${request.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        friendList.innerHTML = requestsHTML;
        setupRequestButtons();
        
    } catch (error) {
        console.error("Error al mostrar solicitudes pendientes:", error);
        friendList.innerHTML = `<p class="placeholder-text">Error inesperado: ${error.message || 'Error desconocido'}</p>`;
    }
    
    // Función interna para configurar los botones de solicitud
    function setupRequestButtons() {
        // Añadir listeners a los botones
        const acceptButtons = document.querySelectorAll('.accept-btn');
        const rejectButtons = document.querySelectorAll('.reject-btn');
        
        acceptButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.dataset.requestId;
                const senderId = btn.dataset.senderId;
                const senderUserID = btn.dataset.senderUserId;
                
                // Mostrar mensaje de carga
                showNotification('Aceptando solicitud...', 'info');
                
                // Ejecutar la acción
                acceptFriendRequest(requestId, senderId, senderUserID);
            });
        });
        
        rejectButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.dataset.requestId;
                
                // Mostrar mensaje de carga
                showNotification('Rechazando solicitud...', 'info');
                
                // Ejecutar la acción
                rejectFriendRequest(requestId);
            });
        });
    }
}

// Aceptar solicitud de amistad
async function acceptFriendRequest(requestId, senderId, senderUserID) {
    try {
        // Obtener detalles de la solicitud (para obtener sender_user_id si no fue pasado)
        let userSenderID = senderUserID;
        if (!userSenderID) {
            const { data: requestData, error: getError } = await supabaseClient
                .from('friend_requests')
                .select('sender_user_id')
                .eq('id', requestId)
                .single();
                
            if (!getError && requestData) {
                userSenderID = requestData.sender_user_id;
            }
        }
        
        // Actualizar estado de la solicitud
        const { error: updateError } = await supabaseClient
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);
        
        if (updateError) {
            console.error('Error al actualizar solicitud:', updateError);
            showNotification('Error al aceptar solicitud', 'error');
            return;
        }
        
        // Crear amistad con IDs de usuario
        const { error: friendshipError } = await supabaseClient
            .from('friendships')
            .insert([
                {
                    user1_id: currentUser.id,
                    user2_id: senderId,
                    user1_user_id: currentUserID, 
                    user2_user_id: userSenderID
                }
            ]);
        
        if (friendshipError) {
            console.error('Error al crear amistad:', friendshipError);
            showNotification('Error al crear amistad', 'error');
            return;
        }
        
        // Actualizar UI
        showNotification('Solicitud aceptada', 'success');
        
        // Recargar solicitudes y amigos
        loadFriendRequests();
        loadFriendsList('all');
        
    } catch (error) {
        console.error('Error al aceptar solicitud de amistad:', error);
        showNotification('Error al procesar la solicitud', 'error');
    }
}

// Rechazar solicitud de amistad
async function rejectFriendRequest(requestId) {
    try {
        // Actualizar estado de la solicitud
        const { error: updateError } = await supabaseClient
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);
        
        if (updateError) {
            console.error('Error al actualizar solicitud:', updateError);
            showNotification('Error al rechazar solicitud', 'error');
            return;
        }
        
        // Actualizar UI
        showNotification('Solicitud rechazada', 'info');
        
        // Recargar solicitudes
        loadFriendRequests();
        
    } catch (error) {
        console.error('Error al rechazar solicitud de amistad:', error);
        showNotification('Error al procesar la solicitud', 'error');
    }
}

// Abrir chat con un amigo
async function openChat(friendId) {
    try {
        // Buscar amigo en la lista actual
        let friend = currentFriendsList.find(f => f.id === friendId);
        
        if (!friend) {
            // Si no está en la lista actual, buscarlo en la base de datos
            const { data: friendProfile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('id, username, full_name, avatar_url, status')
                .eq('id', friendId)
                .single();
            
            if (profileError || !friendProfile) {
                console.error('Error al cargar perfil de amigo:', profileError);
                showNotification('Error al abrir chat', 'error');
                return;
            }
            
            friend = friendProfile;
        }
        
        // Establecer chat activo
        activeChatId = friendId;
        
        // Crear modal de chat si no existe
        let chatModal = document.getElementById('chatModal');
        
        if (!chatModal) {
            chatModal = document.createElement('div');
            chatModal.id = 'chatModal';
            chatModal.className = 'modal';
            document.body.appendChild(chatModal);
        }
        
        // Contenido del modal
        chatModal.innerHTML = `
            <div class="modal-content">
                <button class="close-modal" onclick="closeChatModal()" title="Cerrar">&times;</button>
                
                <div class="chat-container">
                    <div class="chat-header">
                        <div class="friend-avatar">
                            <img src="${friend.avatar_url || 'img/default-avatar.png'}" alt="${friend.full_name || friend.username}">
                            <div class="friend-status ${friend.status || 'offline'}"></div>
                        </div>
                        <div class="friend-info">
                            <div class="friend-name">${friend.full_name || friend.username}</div>
                            <div class="friend-status-text">${getStatusText(friend.status || 'offline')}</div>
                        </div>
                    </div>
                    
                    <div class="chat-messages" id="chatMessages">
                        <p class="placeholder-text">Cargando mensajes...</p>
                    </div>
                    
                    <div class="chat-input-container">
                        <div class="chat-input-wrapper">
                            <textarea id="chatInput" class="chat-input" placeholder="Escribe un mensaje..."></textarea>
                            <button id="sendMessageBtn" class="send-message-btn">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Mostrar modal
        chatModal.style.display = 'flex';
        setTimeout(() => {
            chatModal.classList.add('show');
        }, 10);
        
        // Configurar listeners
        setupChatListeners(friendId);
        
        // Cargar mensajes
        loadChatMessages(friendId);
        
    } catch (error) {
        console.error('Error al abrir chat:', error);
        showNotification('Error al abrir chat', 'error');
    }
}

// Configurar listeners para el chat
function setupChatListeners(friendId) {
    const chatInput = document.getElementById('chatInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    
    if (chatInput && sendMessageBtn) {
        // Enviar mensaje al hacer clic en el botón
        sendMessageBtn.addEventListener('click', () => {
            sendMessage(friendId);
        });
        
        // Enviar mensaje al presionar Enter (sin Shift)
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(friendId);
            }
        });
        
        // Ajustar altura del textarea automáticamente
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
        });
    }
}

// Enviar mensaje al amigo
async function sendMessage(friendId) {
    const chatInput = document.getElementById('chatInput');
    const content = chatInput.value.trim();
    
    if (!content) return; // No enviar mensajes vacíos
    
    try {
        // Limpiar input antes de enviar para mejor UX
        chatInput.value = '';
        
        // Añadir mensaje a la interfaz inmediatamente (optimistic UI)
        const tempMessage = {
            id: 'temp-' + Date.now(),
            sender_id: currentUser.id,
            receiver_id: friendId,
            content: content,
            created_at: new Date().toISOString(),
            is_temp: true // Marcar como temporal hasta confirmación
        };
        
        appendMessageToChat(tempMessage);
        
        // Enviar mensaje a la base de datos
        const { data: message, error } = await supabaseClient
            .from('messages')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: friendId,
                    content: content,
                    read: false
                }
            ])
            .select()
            .single();
        
        if (error) {
            console.error('Error al enviar mensaje:', error);
            showNotification('Error al enviar mensaje', 'error');
            // Marcar el mensaje como fallido en la UI
            const tempElement = document.getElementById(`message-${tempMessage.id}`);
            if (tempElement) {
                tempElement.classList.add('message-failed');
                tempElement.querySelector('.message-content').innerHTML += ' <span class="message-error">(No enviado)</span>';
            }
            return;
        }
        
        console.log('Mensaje enviado:', message);
        
        // Actualizar el mensaje temporal con el real
        const tempElement = document.getElementById(`message-${tempMessage.id}`);
        if (tempElement && message) {
            tempElement.id = `message-${message.id}`;
            tempElement.classList.remove('message-temp');
        }
        
    } catch (error) {
        console.error('Error inesperado al enviar mensaje:', error);
        showNotification('Error al enviar mensaje', 'error');
    }
}

// Cargar mensajes del chat
async function loadChatMessages(friendId) {
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatMessages) return;
    
    try {
        // Obtener mensajes de la conversación (enviados y recibidos)
        const { data: messages, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Error al cargar mensajes:', error);
            chatMessages.innerHTML = '<p class="placeholder-text">Error al cargar mensajes</p>';
            return;
        }
        
        // Guardar en caché
        currentChats[friendId] = messages || [];
        
        // Si no hay mensajes
        if (!messages || messages.length === 0) {
            chatMessages.innerHTML = '<p class="placeholder-text">No hay mensajes aún. ¡Envía el primero!</p>';
            return;
        }
        
        // Renderizar mensajes
        let messagesHTML = '';
        messages.forEach(message => {
            messagesHTML += createMessageHTML(message);
        });
        
        chatMessages.innerHTML = messagesHTML;
        
        // Marcar mensajes como leídos
        markMessagesAsRead(friendId);
        
        // Scroll al final con animación suave
        setTimeout(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
        
    } catch (error) {
        console.error('Error inesperado al cargar mensajes:', error);
        chatMessages.innerHTML = '<p class="placeholder-text">Error al cargar mensajes</p>';
    }
}

// Añadir un mensaje nuevo al chat
function appendMessageToChat(message) {
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatMessages) return;
    
    // Eliminar placeholder si existe
    const placeholder = chatMessages.querySelector('.placeholder-text');
    if (placeholder) {
        placeholder.remove();
    }
    
    // Añadir mensaje al DOM
    const messageHTML = createMessageHTML(message);
    chatMessages.insertAdjacentHTML('beforeend', messageHTML);
    
    // Scroll al final con animación suave
    setTimeout(() => {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
    
    // Si el mensaje es recibido, marcarlo como leído
    if (message.sender_id !== currentUser.id) {
        markMessagesAsRead(message.sender_id);
    }
}

// Crear HTML para un mensaje
function createMessageHTML(message) {
    const isOwn = message.sender_id === currentUser.id;
    const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempClass = message.is_temp ? 'message-temp' : '';
    
    return `
        <div id="message-${message.id}" class="message ${isOwn ? 'message-own' : 'message-friend'} ${tempClass}">
            <div class="message-content">${message.content}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
}

// Marcar mensajes como leídos
async function markMessagesAsRead(senderId) {
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({ read: true })
            .eq('sender_id', senderId)
            .eq('receiver_id', currentUser.id)
            .eq('read', false);
        
        if (error) {
            console.error('Error al marcar mensajes como leídos:', error);
        }
    } catch (error) {
        console.error('Error inesperado al marcar mensajes:', error);
    }
}

// Cerrar modal de chat
function closeChatModal() {
    const chatModal = document.getElementById('chatModal');
    
    if (chatModal) {
        chatModal.classList.remove('show');
        setTimeout(() => {
            chatModal.style.display = 'none';
        }, 300);
    }
    
    // Limpiar chat activo
    activeChatId = null;
}

// Obtener texto de estado
function getStatusText(status) {
    switch (status) {
        case 'online': return 'En línea';
        case 'idle': return 'Ausente';
        case 'dnd': return 'No molestar';
        case 'offline': return 'Desconectado';
        default: return 'Desconectado';
    }
}

// Actualizar indicador en la navegación principal
function updateFriendsNavIndicator(count) {
    const friendsNavItem = document.querySelector('.nav-item[data-section="friends"]');
    
    if (!friendsNavItem) return;
    
    // Buscar o crear indicador
    let countIndicator = friendsNavItem.querySelector('.pending-count');
    
    if (count > 0) {
        if (!countIndicator) {
            countIndicator = document.createElement('span');
            countIndicator.className = 'pending-count';
            friendsNavItem.appendChild(countIndicator);
        }
        
        countIndicator.textContent = count;
        countIndicator.style.display = 'flex';
    } else if (countIndicator) {
        countIndicator.style.display = 'none';
    }
}