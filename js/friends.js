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
    // Suscribirse a solicitudes de amistad
    // Verificar que tengamos un usuario antes de suscribirnos
    if (!window.currentUser || !window.currentUser.id) {
        console.warn("No hay usuario autenticado para suscripciones en tiempo real");
        return;
    }
    
    const friendRequestsSubscription = supabaseClient
        .channel('friend_requests_channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${window.currentUser.id}` },
            (payload) => {
                console.log("Cambio en solicitudes de amistad:", payload);
                // Actualizar la lista de solicitudes
                loadFriendRequests();
                // Mostrar notificación
                if (payload.eventType === 'INSERT') {
                    showNotification("¡Nueva solicitud de amistad recibida!", "info");
                }
            }
        )
        .subscribe((status) => {
            console.log(`Suscripción a solicitudes de amistad: ${status}`);
        });
    
    // Suscribirse a mensajes nuevos
    const messagesSubscription = supabaseClient
        .channel('messages_channel')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${window.currentUser.id}` },
            (payload) => {
                console.log("Nuevo mensaje recibido:", payload);
                // Actualizar el chat si está abierto
                if (activeChatId === payload.new.sender_id) {
                    appendMessageToChat(payload.new);
                } else {
                    // Mostrar notificación
                    showNotification("Nuevo mensaje recibido", "info");
                }
            }
        )
        .subscribe((status) => {
            console.log(`Suscripción a mensajes: ${status}`);
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
    const addFriendInput = document.getElementById('addFriendInput');
    const addFriendError = document.getElementById('addFriendError');
    const addFriendSuccess = document.getElementById('addFriendSuccess');
    
    // Limpiar mensajes anteriores
    if (addFriendError) addFriendError.textContent = '';
    if (addFriendSuccess) addFriendSuccess.textContent = '';
    
    const username = addFriendInput.value.trim();
    
    if (!username) {
        if (addFriendError) addFriendError.textContent = 'Por favor, ingresa un nombre de usuario';
        return;
    }
    
    try {
        // Buscar al usuario por nombre de usuario
        const { data: targetUser, error: findError } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name')
            .eq('username', username)
            .single();
        
        if (findError || !targetUser) {
            if (addFriendError) addFriendError.textContent = 'Usuario no encontrado';
            return;
        }
        
        // Verificar que no sea uno mismo
        if (targetUser.id === currentUser.id) {
            if (addFriendError) addFriendError.textContent = 'No puedes enviarte una solicitud a ti mismo';
            return;
        }
        
        // Verificar si ya son amigos
        const { data: existingFriendship, error: friendshipError } = await supabaseClient
            .from('friendships')
            .select('id')
            .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
            .or(`user1_id.eq.${targetUser.id},user2_id.eq.${targetUser.id}`)
            .single();
        
        if (existingFriendship) {
            if (addFriendError) addFriendError.textContent = 'Ya son amigos';
            return;
        }
        
        // Verificar si ya existe una solicitud pendiente
        const { data: existingRequest, error: requestError } = await supabaseClient
            .from('friend_requests')
            .select('id, status')
            .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${targetUser.id}`)
            .or(`sender_id.eq.${targetUser.id},receiver_id.eq.${currentUser.id}`)
            .eq('status', 'pending')
            .single();
        
        if (existingRequest) {
            if (addFriendError) addFriendError.textContent = 'Ya existe una solicitud pendiente';
            return;
        }
        
        // Enviar solicitud
        const { error: insertError } = await supabaseClient
            .from('friend_requests')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: targetUser.id,
                    status: 'pending'
                }
            ]);
        
        if (insertError) {
            console.error('Error al enviar solicitud:', insertError);
            if (addFriendError) addFriendError.textContent = 'Error al enviar solicitud';
            return;
        }
        
        // Éxito
        if (addFriendSuccess) addFriendSuccess.textContent = `Solicitud enviada a ${targetUser.full_name || username}`;
        if (addFriendInput) addFriendInput.value = '';
        showNotification('Solicitud de amistad enviada', 'success');
        
    } catch (error) {
        console.error('Error al enviar solicitud de amistad:', error);
        if (addFriendError) addFriendError.textContent = 'Error al procesar la solicitud';
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
        
        // Obtener solicitudes pendientes
        const { data: requests, error: requestsError } = await supabaseClient
            .from('friend_requests')
            .select('id, sender_id, sender_user_id, created_at')
            .eq('receiver_id', window.currentUser.id)
            .eq('status', 'pending');
            
        if (requestsError) {
            console.error('Error al cargar solicitudes:', requestsError);
            return;
        }
        
        console.log("Solicitudes pendientes recibidas:", requests);
        
        // Guardar localmente las solicitudes para compararlas después
        const previousRequests = window.currentFriendRequests || [];
        const newRequestsCount = requests ? requests.filter(req => 
            !previousRequests.some(prevReq => prevReq.id === req.id)
        ).length : 0;
        
        // Actualizar contador si tab de pendientes está activo
        const pendingTab = document.querySelector('.friend-tab[data-filter="pending"]');
        if (pendingTab) {
            const requestCount = requests ? requests.length : 0;
            const pendingBadge = pendingTab.querySelector('.pending-badge') || document.createElement('span');
            
            if (!pendingTab.querySelector('.pending-badge')) {
                pendingBadge.className = 'pending-badge';
                pendingTab.appendChild(pendingBadge);
            }
            
            pendingBadge.textContent = requestCount;
            pendingBadge.style.display = requestCount > 0 ? 'inline-flex' : 'none';
            
            // Solo mostrar notificación si hay solicitudes nuevas
            if (newRequestsCount > 0) {
                showNotification(`Tienes ${newRequestsCount} nueva(s) solicitud(es) de amistad`, 'info');
            }
        }
        
        // Actualizar solicitudes almacenadas
        window.currentFriendRequests = requests || [];
        
        // Si tab de pendientes está activo, mostrar solicitudes
        const activeTabFilter = document.querySelector('.friend-tab.active')?.dataset.filter;
        if (activeTabFilter === 'pending') {
            displayPendingRequests(requests || []);
        }
        
    } catch (error) {
        console.error("Error al cargar solicitudes de amistad:", error);
    }
}

// Mostrar solicitudes pendientes
async function displayPendingRequests(requests) {
    const friendList = document.getElementById('friendList');
    const friendCount = document.getElementById('friendCount');
    
    if (!friendList) return;
    
    if (!requests || requests.length === 0) {
        friendList.innerHTML = '<p class="placeholder-text">No tienes solicitudes pendientes</p>';
        if (friendCount) friendCount.textContent = '0';
        return;
    }
    
    // Actualizar contador
    if (friendCount) friendCount.textContent = requests.length.toString();
    
    // Obtener perfiles de los remitentes
    const senderIds = requests.map(req => req.sender_id);
    const { data: senderProfiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, status')
        .in('id', senderIds);
    
    if (profilesError) {
        console.error('Error al cargar perfiles de remitentes:', profilesError);
        friendList.innerHTML = '<p class="placeholder-text">Error al cargar solicitudes</p>';
        return;
    }
    
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
                    <img src="${sender.avatar_url || 'img/default-avatar.png'}" alt="${sender.full_name || sender.username}">
                </div>
                <div class="friend-request-info">
                    <div class="friend-name">${sender.full_name || sender.username}</div>
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