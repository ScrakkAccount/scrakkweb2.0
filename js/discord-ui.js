// Variables globales
let currentServer = null;
let currentChannel = null;
let activeListeners = {}; // Para gestionar las suscripciones activas

// Estados de usuario y sus colores
const USER_STATES = {
    ONLINE: {
        id: 'online',
        color: '#43b581',
        icon: 'circle',
        label: 'En línea'
    },
    IDLE: {
        id: 'idle',
        color: '#faa61a',
        icon: 'moon',
        label: 'Ausente'
    },
    DND: {
        id: 'dnd',
        color: '#f04747',
        icon: 'times-circle',
        label: 'No molestar'
    },
    INVISIBLE: {
        id: 'invisible',
        color: '#747f8d',
        icon: 'circle',
        label: 'Invisible'
    }
};

// Función para ir al inicio
function goHome() {
    // Actualizar estado visual de los servidores
    document.querySelectorAll('.server-icon').forEach(s => s.classList.remove('active'));
    document.querySelector('.server-icon.home').classList.add('active');
    
    // Actualizar UI
    document.querySelector('.server-name').textContent = 'Inicio';
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('chatContent').style.display = 'none';
    document.getElementById('friendsSection').style.display = 'block';
    document.getElementById('channelsContainer').style.display = 'none';
    document.getElementById('serverSettingsBtn').style.display = 'none';
    document.getElementById('addChannelBtn').style.display = 'none';
    
    // Resetear servidor actual
    currentServer = null;
}

// Función para cargar servidores
async function loadServers() {
    try {
        const user = authService.getCurrentUser();
        if (!user) return;
        
        const serversSnapshot = await firebase.firestore()
            .collection('servers')
            .where('members', 'array-contains', user.uid)
            .get();
        
        const serverList = document.querySelector('.server-list');
        // Mantener solo el botón de inicio y el separador
        serverList.innerHTML = `
            <div class="server-icon home active" onclick="goHome()">
                <i class="fas fa-home"></i>
            </div>
            <div class="server-separator"></div>
        `;
        
        serversSnapshot.forEach(doc => {
            const server = doc.data();
            const serverElement = document.createElement('div');
            serverElement.className = 'server-icon';
            serverElement.dataset.serverId = doc.id;
            
            if (server.icon) {
                serverElement.innerHTML = `<img src="${server.icon}" alt="${server.name}">`;
            } else {
                serverElement.innerHTML = `<span>${server.name.charAt(0).toUpperCase()}</span>`;
            }
            
            serverElement.title = server.name;
            serverElement.onclick = function() {
                selectServer(this);
            };
            serverList.appendChild(serverElement);
        });
        
        console.log('Servidores cargados:', serversSnapshot.size);
    } catch (error) {
        console.error('Error al cargar servidores:', error);
        showNotification('Error al cargar los servidores', 'error');
    }
}

// Función para seleccionar servidor
async function selectServer(serverElement) {
    try {
        if (!serverElement) {
            throw new Error('Elemento de servidor no válido');
        }

        // Cancelar todas las suscripciones activas
        Object.values(activeListeners).forEach(unsubscribe => unsubscribe());
        activeListeners = {};

        // Actualizar UI de servidores
        document.querySelectorAll('.server-icon').forEach(s => s.classList.remove('active'));
        serverElement.classList.add('active');
        
        // Obtener datos del servidor
        const serverId = serverElement.dataset.serverId;
        if (!serverId) {
            throw new Error('ID de servidor no encontrado');
        }

        const serverDoc = await firebase.firestore().collection('servers').doc(serverId).get();
        
        if (!serverDoc.exists) {
            throw new Error('Servidor no encontrado');
        }
        
        const serverData = serverDoc.data();
        currentServer = {
            id: serverId,
            ...serverData
        };
        
        // Actualizar UI
        document.getElementById('homeContent').style.display = 'none';
        document.getElementById('chatContent').style.display = 'flex';
        
        // Actualizar nombre e icono del servidor
        const serverName = document.querySelector('.server-name');
        if (serverName) {
            serverName.textContent = serverData.name;
        }

        const serverIcon = serverElement.querySelector('img');
        if (serverIcon && serverData.icon) {
            serverIcon.src = serverData.icon;
            serverIcon.onerror = () => {
                serverIcon.src = 'img/default-server-icon.png';
            };
        }
        
        // Mostrar sección de canales y ocultar amigos
        document.getElementById('friendsSection').style.display = 'none';
        document.getElementById('channelsContainer').style.display = 'block';
        
        // Mostrar botones de servidor según permisos
        const isOwner = serverData.ownerId === authService.getCurrentUser()?.uid;
        document.getElementById('serverSettingsBtn').style.display = isOwner ? 'block' : 'none';
        document.getElementById('addChannelBtn').style.display = isOwner ? 'block' : 'none';
        
        // Limpiar mensajes actuales
        const messagesContainer = document.querySelector('.chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // Cargar canales
        await loadChannels(currentServer);
        
        showNotification(`Conectado a ${serverData.name}`, 'success');
    } catch (error) {
        console.error('Error al seleccionar servidor:', error);
        showNotification(error.message || 'Error al cargar el servidor', 'error');
        
        // Restaurar UI en caso de error
        document.getElementById('homeContent').style.display = 'block';
        document.getElementById('chatContent').style.display = 'none';
    }
}

// Función para cargar canales
async function loadChannels(server) {
    try {
        console.log('Cargando canales para:', server.name);
        
        const channelsContainer = document.getElementById('channelsContainer');
        channelsContainer.innerHTML = '';
        
        // Separar canales por tipo
        const textChannels = server.channels.filter(c => c.type === 'text');
        const voiceChannels = server.channels.filter(c => c.type === 'voice');
        
        // Agregar canales de texto
        if (textChannels.length > 0) {
            const textSection = document.createElement('div');
            textSection.className = 'channel-category';
            textSection.innerHTML = '<h3>CANALES DE TEXTO</h3>';
            channelsContainer.appendChild(textSection);
            
            textChannels.forEach(channel => {
                const channelElement = document.createElement('div');
                channelElement.className = 'channel-item';
                channelElement.dataset.channelId = channel.id;
                channelElement.innerHTML = `
                    <i class="fas fa-hashtag"></i>
                    <span class="channel-name">${channel.name}</span>
                `;
                channelElement.onclick = function() {
                    selectTextChannel(channel);
                };
                channelsContainer.appendChild(channelElement);
            });
        }
        
        // Agregar canales de voz
        if (voiceChannels.length > 0) {
            const voiceSection = document.createElement('div');
            voiceSection.className = 'channel-category';
            voiceSection.innerHTML = '<h3>CANALES DE VOZ</h3>';
            channelsContainer.appendChild(voiceSection);
            
            voiceChannels.forEach(channel => {
                const channelElement = document.createElement('div');
                channelElement.className = 'channel-item';
                channelElement.dataset.channelId = channel.id;
                channelElement.innerHTML = `
                    <i class="fas fa-microphone"></i>
                    <span class="channel-name">${channel.name}</span>
                `;
                channelElement.onclick = function() {
                    joinVoiceChannel(channel);
                };
                channelsContainer.appendChild(channelElement);
            });
        }
        
        // Seleccionar el primer canal de texto por defecto
        if (textChannels.length > 0) {
            selectTextChannel(textChannels[0]);
        }
        
        console.log('Canales cargados correctamente');
    } catch (error) {
        console.error('Error al cargar canales:', error);
        showNotification('Error al cargar los canales', 'error');
    }
}

// Función para seleccionar canal de texto
async function selectTextChannel(channel) {
    try {
        console.log('Seleccionando canal:', channel.name);
        
        currentChannel = channel;
        
        // Actualizar UI de canales
        document.querySelectorAll('.channel-item').forEach(c => c.classList.remove('active'));
        const channelElement = document.querySelector(`[data-channel-id="${channel.id}"]`);
        if (channelElement) {
            channelElement.classList.add('active');
        }
        
        // Actualizar título del chat
        const chatHeader = document.querySelector('.chat-header');
        chatHeader.innerHTML = `
            <i class="fas fa-hashtag"></i>
            <span>${channel.name}</span>
        `;
        
        // Habilitar input de chat
        const chatInput = document.querySelector('.chat-input');
        chatInput.disabled = false;
        chatInput.placeholder = `Enviar mensaje a #${channel.name}`;
        
        // Cargar mensajes
        await loadChannelMessages(currentServer.id, channel.id);
        
        console.log('Canal seleccionado correctamente');
    } catch (error) {
        console.error('Error al seleccionar canal:', error);
        showNotification('Error al cargar el canal', 'error');
    }
}

// Función para cargar mensajes de un canal
async function loadChannelMessages(serverId, channelId) {
    try {
        console.log('Cargando mensajes para el canal:', channelId);
        
        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = '';
        
        // Cargar mensajes desde Firestore
        const messagesQuery = await firebase.firestore()
            .collection('messages')
            .where('serverId', '==', serverId)
            .where('channelId', '==', channelId)
            .orderBy('timestamp', 'asc')
            .get();
        
        console.log('Mensajes encontrados:', messagesQuery.size);
        
        messagesQuery.forEach(doc => {
            const message = doc.data();
            appendMessage(message);
        });
        
        // Scroll al último mensaje
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Iniciar escucha de nuevos mensajes
        startRealtimeMessages(serverId, channelId);
        
        console.log('Mensajes cargados correctamente');
    } catch (error) {
        console.error('Error al cargar mensajes:', error);
        showNotification('Error al cargar los mensajes', 'error');
    }
}

// Función para iniciar escucha de mensajes en tiempo real
function startRealtimeMessages(serverId, channelId) {
    // Cancelar suscripción anterior si existe
    if (activeListeners[`${serverId}_${channelId}`]) {
        activeListeners[`${serverId}_${channelId}`]();
        delete activeListeners[`${serverId}_${channelId}`];
    }
    
    // Iniciar nueva suscripción
    activeListeners[`${serverId}_${channelId}`] = firebase.firestore()
        .collection('messages')
        .where('serverId', '==', serverId)
        .where('channelId', '==', channelId)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    // Verificar si es un mensaje nuevo (último minuto)
                    const messageTime = new Date(message.timestamp);
                    const now = new Date();
                    const timeDiff = (now - messageTime) / 1000; // diferencia en segundos
                    
                    appendMessage(message);
                    
                    // Mostrar notificación solo para mensajes nuevos si no es del usuario actual
                    if (timeDiff < 60 && message.userId !== authService.getCurrentUser().uid) {
                        const notification = new Audio('assets/sounds/notification.mp3');
                        notification.volume = 0.5;
                        notification.play().catch(e => console.log('Error reproduciendo sonido:', e));
                    }
                    
                    // Scroll al último mensaje
                    const messagesContainer = document.querySelector('.chat-messages');
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            });
        }, error => {
            console.error('Error en escucha de mensajes:', error);
            showNotification('Error al escuchar mensajes nuevos', 'error');
        });
}

// Función para unirse a canal de voz
function joinVoiceChannel(channel) {
    showNotification('Funcionalidad de voz en desarrollo', 'info');
}

// Función para enviar mensaje
async function sendMessage(content) {
    try {
        if (!content || !currentServer || !currentChannel) {
            showNotification('No se puede enviar el mensaje', 'error');
            return;
        }
        
        const user = authService.getCurrentUser();
        if (!user) {
            showNotification('No hay usuario autenticado', 'error');
            return;
        }
        
        // Obtener datos del usuario
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        // Crear mensaje
        const message = {
            id: Date.now().toString(),
            content: content,
            userId: user.uid,
            userName: userData.nombre + ' ' + userData.apellido,
            userAvatar: userData.avatar || user.photoURL,
            userStatus: userData.status || 'online',
            timestamp: new Date().toISOString(),
            serverId: currentServer.id,
            channelId: currentChannel.id
        };
        
        // Guardar mensaje en Firestore
        await firebase.firestore().collection('messages').add(message);
        
        console.log('Mensaje enviado correctamente');
        
        // Limpiar input
        document.querySelector('.chat-input').value = '';
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        showNotification('Error al enviar el mensaje', 'error');
    }
}

// Función para agregar mensaje a la UI
function appendMessage(message) {
    const messagesContainer = document.querySelector('.chat-messages');
    if (!messagesContainer) return;
    
    // Verificar si el mensaje ya existe
    if (document.querySelector(`[data-message-id="${message.id}"]`)) {
        return;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.dataset.messageId = message.id;
    
    // Obtener la hora del mensaje
    const messageDate = message.timestamp ? new Date(message.timestamp) : new Date();
    const timeString = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <div class="message-avatar">
            <img src="${message.userAvatar || 'default-avatar.png'}" alt="${message.userName}">
            <div class="status-dot" style="background-color: ${getStatusColor(message.userStatus)}"></div>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.userName}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-text">${message.content}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
}

// Función para obtener color de estado
function getStatusColor(status) {
    const statusColors = {
        'online': '#10b981', // Verde
        'idle': '#f59e0b',   // Amarillo
        'dnd': '#ef4444',    // Rojo
        'invisible': '#6b7280' // Gris
    };
    return statusColors[status] || '#6b7280';
}

// Función para actualizar el estado del usuario
async function updateUserStatus(status) {
    try {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No hay usuario autenticado');

        // Actualizar en Firestore
        await firebase.firestore().collection('users').doc(user.uid).update({
            status: status
        });

        // Actualizar UI
        updateStatusIndicator(status);
        
        // Actualizar menú de estado
        document.querySelectorAll('.status-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.status === status) {
                option.classList.add('active');
            }
        });

        showNotification(`Estado actualizado a ${USER_STATES[status].label}`, 'success');
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        showNotification('Error al actualizar el estado', 'error');
    }
}

// Función para actualizar el indicador de estado en la UI
function updateStatusIndicator(status) {
    const statusIndicator = document.querySelector('.user-status-indicator');
    if (!statusIndicator) return;

    const stateConfig = USER_STATES[status] || USER_STATES.INVISIBLE;
    
    statusIndicator.innerHTML = `<i class="fas fa-${stateConfig.icon}"></i>`;
    statusIndicator.style.color = stateConfig.color;
    statusIndicator.title = stateConfig.label;
}

// Función para cargar el estado actual del usuario
async function loadUserStatus() {
    try {
        const user = authService.getCurrentUser();
        if (!user) return;

        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.status) {
                updateStatusIndicator(userData.status);
            }
        }
    } catch (error) {
        console.error('Error al cargar estado del usuario:', error);
    }
}

// Función para previsualizar imagen del servidor
function previewServerIcon(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('serverIconPreview');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Función para crear servidor
async function createServer(event) {
    event.preventDefault();
    
    const createButton = document.querySelector('#createServerForm .btn-primary');
    const originalText = createButton.textContent;
    createButton.textContent = 'Creando servidor...';
    createButton.disabled = true;
    
    try {
        const serverName = document.getElementById('serverName').value.trim();
        const serverIconInput = document.getElementById('serverIcon');
        const serverIcon = serverIconInput.files[0];
        
        if (!serverName) {
            throw new Error('El nombre del servidor es obligatorio');
        }
        
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No hay usuario autenticado');
        
        let iconURL = null;
        
        // Solo intentar subir la imagen si se ha seleccionado un archivo
        if (serverIcon) {
            try {
                const storageRef = firebase.storage().ref();
                const iconRef = storageRef.child(`server-icons/${Date.now()}_${serverIcon.name}`);
                
                // Mostrar progreso de carga
                showNotification('Subiendo imagen...', 'info');
                
                // Subir imagen con control de progreso
                const uploadTask = iconRef.put(serverIcon);
                
                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            createButton.textContent = `Subiendo... ${Math.round(progress)}%`;
                        },
                        (error) => reject(error),
                        async () => {
                            try {
                                iconURL = await uploadTask.snapshot.ref.getDownloadURL();
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        }
                    );
                });
                
                showNotification('Imagen subida exitosamente', 'success');
            } catch (uploadError) {
                console.error('Error al subir imagen:', uploadError);
                showNotification('Error al subir la imagen. Creando servidor sin imagen.', 'warning');
            }
        }
        
        createButton.textContent = 'Creando servidor...';
        
        // Crear servidor en Firestore
        const serverData = {
            name: serverName,
            icon: iconURL,
            ownerId: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            members: [user.uid],
            channels: [
                {
                    id: 'general',
                    name: 'general',
                    type: 'text',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    id: 'general-voice',
                    name: 'General',
                    type: 'voice',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            ]
        };
        
        const serverRef = await firebase.firestore().collection('servers').add(serverData);
        
        // Limpiar formulario y previsualización
        document.getElementById('serverName').value = '';
        serverIconInput.value = '';
        const serverIconPreview = document.getElementById('serverIconPreview');
        if (serverIconPreview) {
            serverIconPreview.src = 'img/default-server-icon.png';
            serverIconPreview.style.display = 'none';
        }
        
        hideModal('createServerModal');
        showNotification('Servidor creado exitosamente', 'success');
        
        // Recargar y seleccionar el nuevo servidor
        await loadServers();
        const newServerElement = document.querySelector(`[data-server-id="${serverRef.id}"]`);
        if (newServerElement) {
            selectServer(newServerElement);
        }
    } catch (error) {
        console.error('Error al crear servidor:', error);
        showNotification(error.message || 'Error al crear el servidor', 'error');
    } finally {
        createButton.textContent = originalText;
        createButton.disabled = false;
    }
}

// Función para crear canal
async function createChannel(type = 'text') {
    try {
        if (!currentServer) {
            showNotification('No hay servidor seleccionado', 'error');
            return;
        }
        
        const channelName = prompt(`Nombre del canal de ${type === 'text' ? 'texto' : 'voz'}:`);
        if (!channelName) return;
        
        const channelId = Date.now().toString();
        const newChannel = {
            id: channelId,
            name: channelName.toLowerCase().replace(/\s+/g, '-'),
            type: type,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Actualizar servidor en Firestore
        await firebase.firestore()
            .collection('servers')
            .doc(currentServer.id)
            .update({
                channels: firebase.firestore.FieldValue.arrayUnion(newChannel)
            });
        
        // Actualizar servidor actual
        currentServer.channels = currentServer.channels || [];
        currentServer.channels.push(newChannel);
        
        // Recargar canales
        await loadChannels(currentServer);
        
        showNotification('Canal creado exitosamente', 'success');
    } catch (error) {
        console.error('Error al crear canal:', error);
        showNotification('Error al crear el canal', 'error');
    }
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', async function() {
    // Cargar servidores
    await loadServers();
    
    // Ir al inicio
    goHome();
    
    // Event listener para formulario de creación de servidor
    const createServerForm = document.getElementById('createServerForm');
    if (createServerForm) {
        createServerForm.addEventListener('submit', createServer);
    } else {
        console.error('Error: No se encontró el formulario de crear servidor');
    }
    
    // Event listener para formulario de edición de perfil
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', saveUserProfile);
    }
    
    // Event listeners para opciones de estado
    document.querySelectorAll('.status-option').forEach(option => {
        option.addEventListener('click', function() {
            const status = this.dataset.status;
            if (status) {
                updateUserStatus(status);
            }
        });
    });
    
    // Cargar estado inicial del usuario
    loadUserStatus();
    
    // Previsualización de avatar (archivo)
    const avatarFileInput = document.getElementById('editUserAvatarFile');
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('editUserAvatarPreview');
                    const selectedFileName = document.getElementById('selectedFileName');
                    if (preview) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                    if (selectedFileName) {
                        selectedFileName.textContent = file.name;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Event listener para previsualización de ícono de servidor
    const serverIconInput = document.getElementById('serverIcon');
    if (serverIconInput) {
        serverIconInput.addEventListener('change', function() {
            previewServerIcon(this);
        });
    }
});

// Event listeners
document.getElementById('addChannelBtn').addEventListener('click', function() {
    const type = prompt('Tipo de canal (text/voice):');
    if (type && ['text', 'voice'].includes(type.toLowerCase())) {
        createChannel(type.toLowerCase());
    } else if (type) {
        showNotification('Tipo de canal no válido', 'error');
    }
});

document.querySelector('.chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const content = this.value.trim();
        if (!content) return;
        
        if (currentChannel && currentChannel.type === 'private') {
            sendPrivateMessage(content);
        } else {
            sendMessage(content);
        }
    }
});

document.querySelector('.send-button').addEventListener('click', function() {
    const content = document.querySelector('.chat-input').value.trim();
    if (!content) return;
    
    if (currentChannel && currentChannel.type === 'private') {
        sendPrivateMessage(content);
    } else {
        sendMessage(content);
    }
});

// Previsualización de imagen de servidor
document.getElementById('serverIcon').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('serverIconPreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Función para iniciar chat privado con un usuario
async function startPrivateChat(userId) {
    try {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
            showNotification('No hay usuario autenticado', 'error');
            return;
        }
        
        // Obtener datos del usuario destinatario
        const userDoc = await firebase.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showNotification('Usuario no encontrado', 'error');
            return;
        }
        
        const userData = userDoc.data();
        
        // Crear ID único para el chat privado (ordenado alfabéticamente)
        const chatId = [currentUser.uid, userId].sort().join('_');
        
        // Resetear servidor actual
        currentServer = {
            id: 'private',
            name: 'Chat Privado'
        };
        
        currentChannel = {
            id: chatId,
            name: `${userData.nombre} ${userData.apellido}`,
            type: 'private',
            userId: userId
        };
        
        // Actualizar UI
        document.querySelectorAll('.server-icon').forEach(s => s.classList.remove('active'));
        document.querySelector('.server-icon.home').classList.add('active');
        
        document.getElementById('homeContent').style.display = 'none';
        document.getElementById('chatContent').style.display = 'flex';
        document.getElementById('friendsSection').style.display = 'none';
        document.getElementById('channelsContainer').style.display = 'none';
        
        // Actualizar título del chat
        const chatHeader = document.querySelector('.chat-header');
        chatHeader.innerHTML = `
            <div class="private-chat-header">
                <img src="${userData.avatar || 'assets/default-avatar.png'}" alt="${userData.nombre}">
                <div class="private-chat-info">
                    <span class="private-chat-name">${userData.nombre} ${userData.apellido}</span>
                    <span class="private-chat-status" style="color: ${getStatusColor(userData.status)}">${userData.status || 'offline'}</span>
                </div>
            </div>
        `;
        
        // Habilitar input de chat
        const chatInput = document.querySelector('.chat-input');
        chatInput.disabled = false;
        chatInput.placeholder = `Mensaje para ${userData.nombre}`;
        
        // Cargar mensajes
        await loadPrivateMessages(chatId);
        
        console.log('Chat privado iniciado:', userData.nombre);
    } catch (error) {
        console.error('Error al iniciar chat privado:', error);
        showNotification('Error al iniciar chat privado', 'error');
    }
}

// Cargar mensajes de chat privado
async function loadPrivateMessages(chatId) {
    try {
        console.log('Cargando mensajes privados para:', chatId);
        
        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = '';
        
        // Cargar mensajes desde Firestore
        const messagesQuery = await firebase.firestore()
            .collection('privateMessages')
            .where('chatId', '==', chatId)
            .orderBy('timestamp', 'asc')
            .get();
        
        console.log('Mensajes privados encontrados:', messagesQuery.size);
        
        messagesQuery.forEach(doc => {
            const message = doc.data();
            appendMessage(message);
        });
        
        // Scroll al último mensaje
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Iniciar escucha de nuevos mensajes
        startRealtimePrivateMessages(chatId);
        
        console.log('Mensajes privados cargados correctamente');
    } catch (error) {
        console.error('Error al cargar mensajes privados:', error);
        showNotification('Error al cargar los mensajes', 'error');
    }
}

// Escucha en tiempo real para mensajes privados
function startRealtimePrivateMessages(chatId) {
    // Cancelar suscripción anterior si existe
    if (activeListeners[`private_${chatId}`]) {
        activeListeners[`private_${chatId}`]();
        delete activeListeners[`private_${chatId}`];
    }
    
    // Iniciar nueva suscripción
    activeListeners[`private_${chatId}`] = firebase.firestore()
        .collection('privateMessages')
        .where('chatId', '==', chatId)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    appendMessage(message);
                    
                    // Verificar si es un mensaje nuevo (último minuto) y no es del usuario actual
                    const messageTime = new Date(message.timestamp);
                    const now = new Date();
                    const timeDiff = (now - messageTime) / 1000; // diferencia en segundos
                    
                    if (timeDiff < 60 && message.userId !== authService.getCurrentUser().uid) {
                        const notification = new Audio('assets/sounds/notification.mp3');
                        notification.volume = 0.5;
                        notification.play().catch(e => console.log('Error reproduciendo sonido:', e));
                    }
                    
                    // Scroll al último mensaje
                    const messagesContainer = document.querySelector('.chat-messages');
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            });
        }, error => {
            console.error('Error en escucha de mensajes privados:', error);
            showNotification('Error al escuchar mensajes nuevos', 'error');
        });
}

// Función para enviar mensaje privado
async function sendPrivateMessage(content) {
    try {
        if (!content || !currentChannel || currentChannel.type !== 'private') {
            showNotification('No se puede enviar el mensaje privado', 'error');
            return;
        }
        
        const user = authService.getCurrentUser();
        if (!user) {
            showNotification('No hay usuario autenticado', 'error');
            return;
        }
        
        // Obtener datos del usuario
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        // Crear mensaje
        const message = {
            id: Date.now().toString(),
            content: content,
            userId: user.uid,
            userName: userData.nombre + ' ' + userData.apellido,
            userAvatar: userData.avatar || user.photoURL,
            userStatus: userData.status || 'online',
            timestamp: new Date().toISOString(),
            chatId: currentChannel.id,
            isPrivate: true
        };
        
        // Guardar mensaje en Firestore
        await firebase.firestore().collection('privateMessages').add(message);
        
        console.log('Mensaje privado enviado correctamente');
        
        // Limpiar input
        document.querySelector('.chat-input').value = '';
    } catch (error) {
        console.error('Error al enviar mensaje privado:', error);
        showNotification('Error al enviar el mensaje', 'error');
    }
}

// Función para mostrar el modal de edición de perfil
async function showEditProfileModal() {
    try {
        // Mostrar el modal inmediatamente
        document.getElementById('editProfileModal').style.display = 'flex';
        
        const user = authService.getCurrentUser();
        if (!user) {
            showNotification('No hay usuario autenticado', 'error');
            return;
        }
        
        // Iniciar carga de datos en segundo plano
        setTimeout(async () => {
            try {
                // Intentar obtener datos de localStorage primero (para respuesta inmediata)
                const localUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
                
                // Mostrar datos disponibles inmediatamente
                if (localUserData.nombre) {
                    document.getElementById('editUserName').value = localUserData.nombre || '';
                }
                if (localUserData.apellido) {
                    document.getElementById('editUserSurname').value = localUserData.apellido || '';
                }
                
                // Mostrar avatar
                const avatarPreview = document.getElementById('editUserAvatarPreview');
                if (avatarPreview && localUserData.avatar) {
                    avatarPreview.src = localUserData.avatar;
                    avatarPreview.style.display = 'block';
                }
                
                // Intentar cargar datos frescos desde Firestore
                const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    // Actualizar campos solo si hay datos nuevos
                    if (userData.nombre) {
                        document.getElementById('editUserName').value = userData.nombre;
                    }
                    if (userData.apellido) {
                        document.getElementById('editUserSurname').value = userData.apellido;
                    }
                    
                    // Actualizar avatar
                    if (userData.avatar && avatarPreview) {
                        avatarPreview.src = userData.avatar;
                        avatarPreview.style.display = 'block';
                    }
                    
                    // Actualizar estado
                    const currentStatus = userData.status || 'online';
                    document.querySelectorAll('.status-option').forEach(option => {
                        option.classList.remove('active');
                        if (option.dataset.status === currentStatus) {
                            option.classList.add('active');
                        }
                    });
                    
                    // Actualizar localStorage
                    localStorage.setItem('currentUser', JSON.stringify({
                        id: user.uid,
                        email: user.email,
                        nombre: userData.nombre || '',
                        apellido: userData.apellido || '',
                        avatar: userData.avatar || user.photoURL || ''
                    }));
                }
            } catch (error) {
                console.error('Error al cargar datos de usuario para el modal:', error);
            }
        }, 10);
    } catch (error) {
        console.error('Error al preparar modal de perfil:', error);
        showNotification('Error al abrir el editor de perfil', 'error');
    }
}

// Función para guardar perfil de usuario
async function saveUserProfile(event) {
    event.preventDefault();
    
    try {
        const user = authService.getCurrentUser();
        if (!user) {
            throw new Error('No hay usuario autenticado');
        }
        
        const nombre = document.getElementById('editUserName').value.trim();
        const apellido = document.getElementById('editUserSurname').value.trim();
        const avatarFile = document.getElementById('editUserAvatarFile').files[0];
        const statusOption = document.querySelector('.status-option.active');
        
        if (!nombre) {
            showNotification('El nombre es obligatorio', 'error');
            return;
        }
        
        // Cerrar modal inmediatamente (sin mostrar "Guardando...")
        hideModal('editProfileModal');
        
        let avatarUrl = null;
        
        // Subir la imagen del usuario si seleccionó un archivo
        if (avatarFile) {
            const storageRef = firebase.storage().ref();
            const avatarRef = storageRef.child(`avatars/${user.uid}_${Date.now()}_${avatarFile.name}`);
            await avatarRef.put(avatarFile);
            avatarUrl = await avatarRef.getDownloadURL();
        } else {
            // Sin imagen nueva, mantener la actual
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            avatarUrl = userDoc.exists ? userDoc.data().avatar : (user.photoURL || null);
        }
        
        // Obtener estado seleccionado
        const status = statusOption ? statusOption.dataset.status : 'online';
        
        const userData = {
            nombre: nombre,
            apellido: apellido,
            avatar: avatarUrl,
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Actualizar en Firestore
        await firebase.firestore().collection('users').doc(user.uid).set(
            userData, 
            { merge: true }
        );
        
        // Actualizar en Firebase Auth
        await user.updateProfile({
            displayName: `${nombre} ${apellido}`.trim(),
            photoURL: avatarUrl
        });
        
        // Actualizar UI
        document.getElementById('userName').textContent = `${nombre} ${apellido}`.trim();
        
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            if (avatarUrl) {
                userAvatar.innerHTML = `<img src="${avatarUrl}" alt="${nombre}">
                <div class="status-indicator" style="background-color: ${getStatusColor(status)}"></div>`;
            } else {
                userAvatar.innerHTML = `<div class="avatar-placeholder">${nombre.charAt(0)}</div>
                <div class="status-indicator" style="background-color: ${getStatusColor(status)}"></div>`;
            }
        }
        
        // Actualizar estado si el elemento existe
        const userStatus = document.getElementById('userStatus');
        if (userStatus) {
            userStatus.textContent = getStatusLabel(status);
            userStatus.style.color = getStatusColor(status);
        }
        
        // Guardar en localStorage para persistencia local
        const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        localStorage.setItem('currentUser', JSON.stringify({
            ...currentUserData,
            id: user.uid,
            email: user.email,
            nombre: nombre,
            apellido: apellido,
            avatar: avatarUrl
        }));
        
        showNotification('Perfil actualizado', 'success');
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        showNotification('Error: ' + error.message, 'error');
    }
} 