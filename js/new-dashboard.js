// js/new-dashboard.js

// --- Constantes y Selectores del DOM ---
// Usar window para variables globales y evitar redeclaraciones
if (typeof window.editFieldContainer === 'undefined') window.editFieldContainer = null;
if (typeof window.editFieldLabelInline === 'undefined') window.editFieldLabelInline = null;
if (typeof window.editFieldInputInline === 'undefined') window.editFieldInputInline = null;
if (typeof window.editFieldError === 'undefined') window.editFieldError = null;
if (typeof window.saveEditFieldBtn === 'undefined') window.saveEditFieldBtn = null;
if (typeof window.currentEditingField === 'undefined') window.currentEditingField = null;
if (typeof window.navItems === 'undefined') window.navItems = null;
if (typeof window.userProfileTrigger === 'undefined') window.userProfileTrigger = null;
if (typeof window.addServerBtn === 'undefined') window.addServerBtn = null;
if (typeof window.userSettingsBtn === 'undefined') window.userSettingsBtn = null;

document.addEventListener('DOMContentLoaded', async () => {
        // Selectores principales del sidebar y contenido
        const userNameSidebar = document.getElementById('userNameSidebar');
        const userAvatarSidebar = document.getElementById('userAvatarSidebar');
        const userStatusDotSidebar = document.getElementById('userStatusDotSidebar');
        const userStatusTextSidebar = document.getElementById('userStatusTextSidebar');
        addServerBtn = document.getElementById('addServerBtn');
        userSettingsBtn = document.getElementById('userSettingsBtn');
        userProfileTrigger = document.getElementById('userProfileTrigger');
        const settingsEmailDisplay = document.getElementById('settingsEmailDisplay');
        const settingsFullNameDisplay = document.getElementById('settingsFullNameDisplay');
        const settingsUsernameDisplay = document.getElementById('settingsUsernameDisplay');
        const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
        navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        const contentTitle = document.getElementById('contentTitle');
        const mainContentArea = document.getElementById('mainContentArea');

        // Inicializar selectores de edición inline
        editFieldContainer = document.getElementById('editFieldContainer');
        editFieldLabelInline = document.getElementById('editFieldLabelInline');
        editFieldInputInline = document.getElementById('editFieldInputInline');
        editFieldError = document.getElementById('editFieldError');
        saveEditFieldBtn = document.getElementById('saveEditFieldBtn');
        currentEditingField = null;

        // Cargar datos del usuario al iniciar
        await loadUserData();

        // Configurar listeners de navegación
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // Remover la clase 'active' de todos los items
                navItems.forEach(navItem => navItem.classList.remove('active'));
                // Agregar la clase 'active' al item clickeado
                item.classList.add('active');
                
                const section = item.dataset.section;
                if (section) {
                    loadSectionContent(section);
                }
            });
        });

        // Inicializar eventos de edición
        initializeEditFields();

        // Configurar eventos de los botones del sidebar
        if (addServerBtn) {
            addServerBtn.addEventListener('click', () => {
                showModal('createServerModal');
            });
        }

        if (userSettingsBtn) {
            userSettingsBtn.addEventListener('click', () => {
                showModal('settingsModal');
            });
        }

        if (userProfileTrigger) {
            userProfileTrigger.addEventListener('click', async () => {
                await loadUserProfileModal();
                showModal('userProfileModal');
            });
        }

        // Iniciar carga de datos y configurar listeners
        await loadUserData();
        initializeEditFields();
        setupStatusChangeListeners();
    });


    // --- Funciones Auxiliares ---

    // Función para actualizar el estado visual (similar a la anterior)
    function updateStatusDisplay(status) {
        const statusText = getStatusText(status); // Reutiliza o define getStatusText
        
        // Actualizar el texto del estado en la barra lateral
        const userStatusDisplay = document.getElementById('userStatusDisplay');
        if (userStatusDisplay) {
            userStatusDisplay.textContent = statusText;
        }
        
        // Actualizar el indicador visual del estado si existe
        const userStatusDotSidebar = document.getElementById('userStatusDotSidebar');
        if (userStatusDotSidebar) {
            userStatusDotSidebar.className = `status-dot-sidebar ${status || 'offline'}`;
        }
        
        // Actualizar el circulito de estado en la barra lateral
        const sidebarStatusIndicator = document.getElementById('sidebarStatusIndicator');
        if (sidebarStatusIndicator) {
            // Convertir entre diferentes nombres de estado
            let cssClass = status || 'offline';
            
            // Si el estado es 'idle', usar la clase 'ausente' para compatibilidad 
            if (status === 'idle') {
                cssClass = 'ausente';
            }
            // Si el estado es 'dnd', usar la clase 'no-molestar' para compatibilidad
            else if (status === 'dnd') {
                cssClass = 'no-molestar';
            }
            
            sidebarStatusIndicator.classList.remove('online', 'ausente', 'idle', 'dnd', 'no-molestar', 'invisible', 'offline');
            sidebarStatusIndicator.classList.add(cssClass);
        }
        
        // También actualizamos el indicador en el perfil si está abierto
        updateProfileStatusIndicator(status);
        
        console.log("Estado UI actualizado a:", status);
    }
    
    // Función para actualizar el indicador de estado en el avatar del perfil
    async function updateProfileStatusIndicator(status) {
        const statusIndicator = document.getElementById('profileStatusIndicator');
        if (!statusIndicator) return;
        
        try {
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError) throw userError;

            // Actualizar estado en la base de datos
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({ status: status })
                .eq('id', user.id);

            if (updateError) throw updateError;
            
            // Eliminar todas las clases de estado anteriores
            statusIndicator.classList.remove('online', 'ausente', 'idle', 'dnd', 'no-molestar', 'invisible', 'offline');
            
            // Convertir nombres de estado para asegurar compatibilidad
            let cssClass = status || 'offline';
            
            // Mapeo de estados
            const statusMapping = {
                'idle': 'ausente',
                'dnd': 'no-molestar'
            };
            
            cssClass = statusMapping[status] || cssClass;
            
            // Añadir la clase correspondiente al nuevo estado
            statusIndicator.classList.add(cssClass);
            
            // Actualizar también el estado en la barra lateral
            updateStatusDisplay(status);
            
            console.log("Estado actualizado correctamente:", status);
        } catch (error) {
            console.error("Error al actualizar el estado:", error);
            showNotification("Error al actualizar el estado", "error");
        }
    }

    // Función para obtener texto del estado (asegúrate que esté definida globalmente o aquí)
    function getStatusText(status) {
        switch (status) {
            case 'online': return 'En línea';
            case 'idle': return 'Ausente';
            case 'dnd': return 'No molestar';
            case 'invisible': return 'Invisible';
            default: return 'Desconectado'; // O 'En línea' por defecto
        }
    }

    // Función mejorada para mostrar notificaciones
    function showNotification(message, type = 'info', duration = 4000) {
        // Usar el sistema de notificaciones global si está disponible
        if (typeof window.showNotification === 'function') {
            try {
                window.showNotification(type, message, duration);
                return;
            } catch (e) {
                console.warn('Error al usar sistema de notificaciones global:', e);
                // Continuar con el fallback
            }
        }
        
        // Fallback básico (mostrar en consola)
        console.log(`Notificación [${type}]: ${message}`);
        
        // Intentar mostrar una notificación visual básica
        try {
            const notification = document.getElementById('notification');
            const notificationMessage = document.getElementById('notificationMessage');
            const notificationIcon = document.getElementById('notificationIcon');
            
            if (notification && notificationMessage) {
                notificationMessage.textContent = message;
                
                // Asignar clase según el tipo
                notification.className = 'notification';
                notification.classList.add(type);
                
                // Establecer ícono adecuado
                if (notificationIcon) {
                    notificationIcon.className = 'fas';
                    switch(type) {
                        case 'success': notificationIcon.classList.add('fa-check-circle'); break;
                        case 'error': notificationIcon.classList.add('fa-exclamation-circle'); break;
                        case 'warning': notificationIcon.classList.add('fa-exclamation-triangle'); break;
                        case 'friend': notificationIcon.classList.add('fa-user-plus'); break;
                        default: notificationIcon.classList.add('fa-info-circle');
                    }
                }
                
                // Mostrar
                notification.classList.add('show');
                
                // Ocultar después del tiempo indicado
                setTimeout(() => {
                    notification.classList.remove('show');
                }, duration);
            }
        } catch (e) {
            console.warn('Error al mostrar notificación fallback:', e);
        }
    }

    // Procesar la cola de notificaciones
    function processNotificationQueue() {
        if (window.notificationQueue.length === 0) {
            window.notificationProcessing = false;
            return;
        }
        
        window.notificationProcessing = true;
        const { message, type, duration } = window.notificationQueue.shift();
        
        // Mostrar la notificación actual
        showNotificationImmediate(message, type, duration);
    }

    // Mostrar una notificación inmediatamente
    function showNotificationImmediate(message, type = 'info', duration = 4000) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(type, message, duration);
        } else {
            console.warn('Sistema de notificaciones no disponible');
            alert(message); // Fallback
        }
    }

    // Reproducir sonidos de notificación
    function playNotificationSound(type) {
        // URLs del servidor para los sonidos de notificación
        const sounds = {
            success: 'https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3',
            error: 'https://notificationsounds.com/storage/sounds/file-sounds-1149-unsure.mp3',
            warning: 'https://notificationsounds.com/storage/sounds/file-sounds-1074-piece-of-cake.mp3',
            info: 'https://notificationsounds.com/storage/sounds/file-sounds-1085-accomplished.mp3',
            friendRequest: 'https://notificationsounds.com/storage/sounds/file-sounds-1120-intuition.mp3'
        };
        
        // Si el navegador no soporta Audio API, no reproducir nada
        if (!window.Audio) return;
        
        // Usar un sonido por defecto si no se encuentra el tipo
        const soundURL = sounds[type] || sounds.info;
        
        try {
            // Crear un nuevo objeto de Audio y reproducirlo
            const audio = new Audio(soundURL);
            audio.volume = 0.5; // Volumen al 50%
            audio.play().catch(e => {
                // Ignorar errores de reproducción (común en algunos navegadores)
                console.warn('No se pudo reproducir el sonido de notificación:', e);
            });
        } catch (e) {
            console.warn('Error al reproducir sonido:', e);
        }
    }
    
    // Función para mostrar modales (reutiliza o define globalmente)
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Asegurarse de que el modal esté visible
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevenir scroll del body
            
            // Mostrar el contenido con una pequeña animación
            requestAnimationFrame(() => {
                modal.classList.add('show');
                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.opacity = '1';
                    modalContent.style.transform = 'scale(1)';
                    modalContent.style.visibility = 'visible'; // Asegurar visibilidad
                }
                
                // Mostrar las secciones del modal
                const modalSections = modal.querySelectorAll('.settings-section');
                modalSections.forEach(section => {
                    section.style.display = 'block';
                    section.style.opacity = '1';
                });
            });
            
            // Añadir listener para cerrar con Escape
            document.addEventListener('keydown', function closeOnEscape(e) {
                if (e.key === 'Escape') {
                    closeModal(modalId);
                    document.removeEventListener('keydown', closeOnEscape);
                }
            });

            // Cerrar al hacer clic fuera del contenido
            modal.addEventListener('click', function closeOnOutsideClick(e) {
                if (e.target === modal) {
                    closeModal(modalId);
                    modal.removeEventListener('click', closeOnOutsideClick);
                }
            });

            console.log(`Modal ${modalId} mostrado correctamente`);
        } else {
            console.error(`Modal con ID '${modalId}' no encontrado`);
            showNotification(`Error al mostrar ${modalId}`, 'error');
        }
    }

    // Función para cerrar modales
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            document.body.style.overflow = ''; // Restaurar scroll del body
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.opacity = '0';
                modalContent.style.transform = 'scale(0.95)';
            }
            modal.classList.remove('show');
            // Esperar a que termine la animación antes de ocultar
            setTimeout(() => {
                modal.style.display = 'none';
                // Resetear visibilidad de las secciones
                const modalSections = modal.querySelectorAll('.settings-section');
                modalSections.forEach(section => {
                    section.style.display = 'none';
                });
            }, 300);
        }
    }

    // --- Funciones Principales ---
    function initializeEditFields() {
        const editableFields = document.querySelectorAll('[data-editable]');
        editableFields.forEach(field => {
            field.addEventListener('click', function() {
                if (!editFieldContainer || !editFieldLabelInline || !editFieldInputInline) return;
                
                const fieldType = this.dataset.editable;
                const currentValue = this.textContent.trim();
                
                editFieldLabelInline.textContent = `Editar ${fieldType}`;
                editFieldInputInline.value = currentValue;
                editFieldContainer.style.display = 'flex';
                editFieldInputInline.focus();
                
                currentEditingField = {
                    element: this,
                    type: fieldType,
                    originalValue: currentValue
                };
            });
        });
        
        if (saveEditFieldBtn) {
            saveEditFieldBtn.addEventListener('click', async function() {
                if (!currentEditingField || !editFieldInputInline) return;
                
                const newValue = editFieldInputInline.value.trim();
                if (newValue === currentEditingField.originalValue) {
                    editFieldContainer.style.display = 'none';
                    return;
                }
                
                try {
                    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                    if (userError) throw userError;
                    
                    const updateData = {};
                    switch(currentEditingField.type) {
                        case 'fullName':
                            updateData.full_name = newValue;
                            break;
                        // Agregar más casos según sea necesario
                    }
                    
                    const { error: updateError } = await supabaseClient
                        .from('profiles')
                        .update(updateData)
                        .eq('id', user.id);
                    
                    if (updateError) throw updateError;
                    
                    currentEditingField.element.textContent = newValue;
                    showNotification('Campo actualizado correctamente', 'success');
                } catch (error) {
                    console.error('Error al actualizar el campo:', error);
                    showNotification('Error al actualizar el campo', 'error');
                    currentEditingField.element.textContent = currentEditingField.originalValue;
                }
                
                editFieldContainer.style.display = 'none';
                currentEditingField = null;
            });
        }
    }

    async function loadUserData() {
        // Mostrar todos los placeholders de carga
        document.querySelectorAll('.loading-placeholder').forEach(placeholder => {
            placeholder.style.display = 'block';
        });

        try {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            
            if (sessionError) {
                console.error('Error al obtener la sesión:', sessionError);
                setDefaultUIValues();
                return;
            }

            if (!session) {
                console.log('No hay sesión activa');
                setDefaultUIValues();
                return;
            }

            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                console.error('Error al obtener el usuario:', userError);
                setDefaultUIValues();
                return;
            }

            // Obtener el perfil del usuario
            let { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error('Error al obtener el perfil:', profileError);
                
                // Si no existe el perfil, crear uno nuevo
                if (profileError.code === 'PGRST116') {
                    const { data: newProfile, error: createError } = await supabaseClient
                        .from('profiles')
                        .insert([
                            {
                                id: user.id,
                                full_name: user.email.split('@')[0],
                                avatar_url: 'img/default-avatar.png',
                                status: 'online'
                            }
                        ])
                        .select()
                        .single();

                    if (createError) {
                        console.error('Error al crear el perfil:', createError);
                        setDefaultUIValues();
                        return;
                    }

                    profile = newProfile;
                } else {
                    setDefaultUIValues();
                    return;
                }
            }

            // Actualizar la UI con los datos del usuario
            updateUI(user, profile);
        } catch (error) {
            console.error('Error inesperado:', error);
            setDefaultUIValues();
        } finally {
            // Ocultar todos los placeholders de carga
            document.querySelectorAll('.loading-placeholder').forEach(placeholder => {
                placeholder.style.display = 'none';
            });
        }
    }

    function updateUI(user, profile) {
        // Actualizar elementos del sidebar
        const userNameSidebar = document.getElementById('userNameSidebar');
        const userAvatarSidebar = document.getElementById('userAvatarSidebar');
        const userStatusDisplay = document.getElementById('userStatusDisplay');

        if (userNameSidebar) userNameSidebar.textContent = profile.full_name || user.email.split('@')[0];
        if (userAvatarSidebar) userAvatarSidebar.src = profile.avatar_url || 'img/default-avatar.png';
        if (userStatusDisplay) userStatusDisplay.textContent = getStatusText(profile.status || 'online');

        // Actualizar elementos del modal de configuración
        const settingsEmailDisplay = document.getElementById('settingsEmailDisplay');
        const settingsUsernameDisplay = document.getElementById('settingsUsernameDisplay');
        const settingsFullNameDisplay = document.getElementById('settingsFullNameDisplay');

        if (settingsEmailDisplay) settingsEmailDisplay.textContent = user.email;
        if (settingsUsernameDisplay) settingsUsernameDisplay.textContent = user.email.split('@')[0];
        if (settingsFullNameDisplay) settingsFullNameDisplay.textContent = profile.full_name || user.email.split('@')[0];
    }

    function setDefaultUIValues() {
        // Establecer valores por defecto en el sidebar
        const userNameSidebar = document.getElementById('userNameSidebar');
        const userAvatarSidebar = document.getElementById('userAvatarSidebar');
        const userStatusDisplay = document.getElementById('userStatusDisplay');

        if (userNameSidebar) userNameSidebar.textContent = 'Usuario';
        if (userAvatarSidebar) userAvatarSidebar.src = 'img/default-avatar.png';
        if (userStatusDisplay) userStatusDisplay.textContent = getStatusText('offline');

        // Establecer valores por defecto en el modal de configuración
        const settingsEmailDisplay = document.getElementById('settingsEmailDisplay');
        const settingsUsernameDisplay = document.getElementById('settingsUsernameDisplay');
        const settingsFullNameDisplay = document.getElementById('settingsFullNameDisplay');

        if (settingsEmailDisplay) settingsEmailDisplay.textContent = 'No disponible';
        if (settingsUsernameDisplay) settingsUsernameDisplay.textContent = 'No disponible';
        if (settingsFullNameDisplay) settingsFullNameDisplay.textContent = 'No disponible';
    }

    // Función para cargar datos en el modal de perfil
    async function loadUserProfileModal() {
        try {
            // Mostrar indicador de carga
            showNotification('Cargando datos de perfil...', 'info');
            
            // Obtener datos del usuario de Supabase
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                console.error('Error al obtener usuario para el modal:', userError);
                showNotification('Error al cargar los datos de usuario', 'error');
                return;
            }
            
            // Obtener perfil del usuario
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
                
            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error al obtener perfil para el modal:', profileError);
                showNotification('Error al cargar el perfil', 'error');
                return;
            }
            
            // Actualizar elementos del modal
            const profileUsername = document.getElementById('profileUsername');
            const profileEmail = document.getElementById('profileEmail');
            const profileFullName = document.getElementById('profileFullName');
            const profileAvatar = document.getElementById('profileAvatar');
            const profileStatusIndicator = document.getElementById('profileStatusIndicator');

            if (profileUsername) profileUsername.textContent = user.email.split('@')[0];
            if (profileEmail) profileEmail.textContent = user.email;
            if (profileFullName) profileFullName.textContent = profile?.full_name || user.email.split('@')[0];
            if (profileAvatar) profileAvatar.src = profile?.avatar_url || 'img/default-avatar.png';
            if (profileStatusIndicator) {
                profileStatusIndicator.className = `status-indicator ${profile?.status || 'offline'}`;
            }

            // Actualizar campos editables si existen
            const editableFields = document.querySelectorAll('[data-editable]');
            editableFields.forEach(field => {
                const fieldType = field.dataset.editable;
                switch(fieldType) {
                    case 'username':
                        field.textContent = user.email.split('@')[0];
                        break;
                    case 'fullName':
                        field.textContent = profile?.full_name || user.email.split('@')[0];
                        break;
                    case 'email':
                        field.textContent = user.email;
                        break;
                }
            });

            showNotification('Perfil cargado correctamente', 'success');
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
            showNotification('Error al cargar el perfil', 'error');
        }
    }
    
    // Función para cargar el modal del perfil de usuario
    async function loadUserProfileModal() {
        try {
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError) throw userError;

            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;
            
            // Obtener referencias a elementos del DOM
            const profileUsername = document.getElementById('profileUsername');
            const profileFullName = document.getElementById('profileFullName');
            const profileBio = document.getElementById('profileBio');
            const profileModalEmail = document.getElementById('profileModalEmail');
            const profileModalAvatar = document.getElementById('profileModalAvatar');
            
            // Establecer valores en los campos de entrada
            if (profileUsername) {
                profileUsername.value = profile?.username || user.email.split('@')[0];
            }
            
            if (profileFullName) {
                profileFullName.value = profile?.full_name || '';
            }
            
            if (profileBio) {
                profileBio.value = profile?.bio || '';
            }
            
            if (profileModalEmail) {
                profileModalEmail.textContent = user.email;
            }
            
            if (profileModalAvatar && profile?.avatar_url) {
                profileModalAvatar.src = profile.avatar_url;
            }
            
            // Marcar el botón de estado activo
            const statusOptionButtons = document.querySelectorAll('.status-option');
            if (statusOptionButtons) {
                statusOptionButtons.forEach(button => {
                    button.classList.remove('active');
                    if (button.getAttribute('data-status') === (profile?.status || 'online')) {
                        button.classList.add('active');
                    }
                });
            }
            
            // Configurar listeners
            setupStatusChangeListeners();
            setupAvatarChangeListener();
            setupSaveProfileButton();
            
            showNotification('Perfil cargado correctamente', 'success');
            
        } catch (error) {
            console.error('Error al cargar el modal de perfil:', error);
            showNotification('Error al cargar el perfil', 'error');
        }
    }
    
    // Función para configurar el listener de cambio de avatar
    function setupAvatarChangeListener() {
        const avatarContainer = document.getElementById('avatarContainer');
        const avatarInput = document.getElementById('avatarInput');
        
        if (avatarContainer && avatarInput) {
            avatarContainer.addEventListener('click', () => {
                avatarInput.click();
            });
            
            avatarInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        showNotification('Subiendo avatar...', 'info');
                        
                        // Obtener usuario actual
                        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                        if (userError) throw userError;
                        
                        // Subir archivo a Supabase Storage
                        const { data, error } = await supabaseClient.storage
                            .from('avatars')
                            .upload(`${user.id}/${file.name}`, file);
                            
                        if (error) throw error;
                        
                        // Obtener URL pública
                        const { data: { publicUrl } } = supabaseClient.storage
                            .from('avatars')
                            .getPublicUrl(`${user.id}/${file.name}`);
                            
                        // Actualizar avatar en el perfil
                        const { error: updateError } = await supabaseClient
                            .from('profiles')
                            .update({ avatar_url: publicUrl })
                            .eq('id', user.id);
                            
                        if (updateError) throw updateError;
                        
                        // Actualizar UI
                        document.getElementById('profileModalAvatar').src = publicUrl;
                        document.getElementById('userAvatarSidebar').src = publicUrl;
                        
                        showNotification('Avatar actualizado correctamente', 'success');
                    } catch (error) {
                        console.error('Error al actualizar avatar:', error);
                        showNotification('Error al actualizar avatar', 'error');
                    }
                }
            });
        }
    }
    
    // Función para configurar los listeners de cambio de estado
    function setupStatusChangeListeners() {
        const statusButtons = document.querySelectorAll('.status-option');
        
        statusButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const newStatus = button.getAttribute('data-status');
                
                try {
                        // Obtener usuario actual
                    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                    if (userError) throw userError;
                    
                    // Actualizar estado en la base de datos
                    const { error } = await supabaseClient
                        .from('profiles')
                        .update({ status: newStatus })
                        .eq('id', user.id);
                        
                    if (error) throw error;
                    
                    // Actualizar UI
                    statusButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    updateStatusDisplay(newStatus);
                    
                    showNotification('Estado actualizado', 'success');
                } catch (error) {
                    console.error('Error al actualizar estado:', error);
                    showNotification('Error al actualizar estado', 'error');
                }
            });
        });
    }
    
    // Función para configurar el botón de guardar perfil
    function setupSaveProfileButton() {
        const saveButton = document.getElementById('saveProfileBtn');
        
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                try {
                    showNotification('Guardando cambios...', 'info');
                    
                    const username = document.getElementById('profileUsername').value;
                    const fullName = document.getElementById('profileFullName').value;
                    const bio = document.getElementById('profileBio').value;
                    
                    // Actualizar perfil en la base de datos
                    const { error } = await supabaseClient
                        .from('profiles')
                        .update({
                            username: username,
                            full_name: fullName,
                            bio: bio
                        })
                        .eq('id', currentUser.id);
                        
                    if (error) throw error;
                    
                    // Actualizar UI
                    document.getElementById('userNameSidebar').textContent = fullName;
                    
                    showNotification('Perfil actualizado correctamente', 'success');
                    closeModal('userProfileModal');
                } catch (error) {
                    console.error('Error al guardar perfil:', error);
                    showNotification('Error al guardar los cambios', 'error');
                }
            });
        }
    }
    
    // Almacenar la sección actual
    window.currentSection = window.currentSection || 'home';
    
    // Función para cargar el contenido de una sección
    async function loadSectionContent(section) {
        console.log(`Cargando sección: ${section}`);
        
        // Guardar la sección actual
        window.currentSection = section;
        
        // Actualizar navegación visual
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.dataset.section === section) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        try {
            switch(section) {
                case 'home': // Inicio
                    contentTitle.textContent = 'Inicio';
                    mainContentArea.innerHTML = `
                        <div class="welcome-section">
                            <h1>¡Bienvenido a tu Dashboard!</h1>
                            <p>Aquí podrás gestionar tus servidores y conectar con amigos.</p>
                        </div>
                    `;
                    break;
                    
                case 'explore': // Explorar
                    contentTitle.textContent = 'Explorar';
                    mainContentArea.innerHTML = `
                        <div class="explore-search">
                            <div class="input-with-icon">
                                <i class="fas fa-search search-icon"></i>
                                <input type="text" placeholder="Buscar servidores..." class="cyber-input">
                            </div>
                            <button class="cyber-btn primary small">Buscar</button>
                        </div>
                        <p class="placeholder-text">Listado de servidores públicos aparecerá aquí (próximamente).</p>
                    `;
                    break;
                    
                case 'dms': // Mensajes Directos
                    contentTitle.textContent = 'Mensajes';
                    mainContentArea.innerHTML = `
                        <div class="messages-section">
                            <h2>Mensajes Directos</h2>
                            <p class="placeholder-text">Tus conversaciones privadas aparecerán aquí (próximamente).</p>
                        </div>
                    `;
                    break;
                    
                case 'friends': // Amigos
                    contentTitle.textContent = 'Amigos';
                    
                    // Cargar contenido HTML primero
                    mainContentArea.innerHTML = `
                        <div class="friends-container">
                            <div class="friends-header">
                                <h2>Amigos</h2>
                                <div class="friends-actions">
                                    <button id="addFriendBtn" class="cyber-btn primary small">
                                        <i class="fas fa-user-plus"></i> Añadir amigo
                                    </button>
                                </div>
                            </div>
                            <div class="friends-tabs">
                                <div class="friend-tab active" data-filter="all">Todos</div>
                                <div class="friend-tab" data-filter="online">En línea</div>
                                <div class="friend-tab" data-filter="pending">Pendientes</div>
                                <div class="friend-tab" data-filter="blocked">Bloqueados</div>
                            </div>
                            <div class="friend-list-container">
                                <div class="friend-list-header">
                                    <span id="friendListTitle">Todos — </span>
                                    <span id="friendCount">0</span>
                                </div>
                                <div id="friendList" class="friend-list">
                                    <p class="placeholder-text">Cargando amigos...</p>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Luego intentamos inicializar el sistema de amigos
                    if (typeof loadFriendsSection === 'function') {
                        try {
                            loadFriendsSection();
                            if (typeof initFriendsSystem === 'function') {
                                await initFriendsSystem();
                            }
                        } catch (e) {
                            console.warn('Error al inicializar sistema de amigos:', e);
                            document.getElementById('friendList').innerHTML = 
                                '<p class="placeholder-text">Error al cargar el sistema de amigos. Por favor, recarga la página.</p>';
                        }
                    }
                    break;
                    
                default:
                    contentTitle.textContent = 'Sección Desconocida';
                    mainContentArea.innerHTML = '<p>Sección no implementada aún</p>';
            }
        } catch (error) {
            console.error('Error al cargar sección:', error);
            mainContentArea.innerHTML = '<p>Error al cargar el contenido</p>';
        }
    }
    
    // Función para cargar datos del perfil de usuario
    async function loadUserProfile() {
        try {
            // Mostrar indicador de carga
            showNotification('Cargando datos de perfil...', 'info');
            
            // Obtener datos del usuario de Supabase
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                console.error('Error al obtener usuario para el modal:', userError);
                showNotification('Error al cargar los datos de usuario', 'error');
                return;
            }
            
            // Obtener perfil del usuario
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
                
            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error al obtener perfil para el modal:', profileError);
                showNotification('Error al cargar el perfil', 'error');
                return;
            }
            
            // Actualizar elementos del modal
            const profileUsername = document.getElementById('profileUsername');
            const profileEmail = document.getElementById('profileEmail');
            const profileFullName = document.getElementById('profileFullName');
            const profileAvatar = document.getElementById('profileAvatar');
            const profileStatusIndicator = document.getElementById('profileStatusIndicator');
            
            // Actualizar los elementos con los datos del usuario
            if (profileUsername) profileUsername.textContent = user.email.split('@')[0];
            if (profileEmail) profileEmail.textContent = user.email;
            if (profileFullName) profileFullName.textContent = profile?.full_name || user.email.split('@')[0];
            if (profileAvatar) profileAvatar.src = profile?.avatar_url || 'img/default-avatar.png';
            if (profileStatusIndicator) {
                profileStatusIndicator.className = `status-indicator ${profile?.status || 'offline'}`;
            }

            // Inicializar eventos de edición si existen
            initializeEditFields();

            showNotification('Perfil cargado correctamente', 'success');
        } catch (error) {
            console.error('Error al cargar el perfil:', error);
            showNotification('Error al cargar el perfil', 'error');
        }
    }
    
    // Función para cargar el modal del perfil de usuario
    async function loadUserProfileModal() {
        try {
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError) throw userError;

            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;
            
            // Obtener referencias a elementos del DOM
            const profileUsername = document.getElementById('profileUsername');
            const profileFullName = document.getElementById('profileFullName');
            const profileBio = document.getElementById('profileBio');
            const profileModalEmail = document.getElementById('profileModalEmail');
            const profileModalAvatar = document.getElementById('profileModalAvatar');
            
            // Establecer valores en los campos de entrada
            if (profileUsername) {
                profileUsername.value = profile?.username || user.email.split('@')[0];
            }
            
            if (profileFullName) {
                profileFullName.value = profile?.full_name || '';
            }
            
            if (profileBio) {
                profileBio.value = profile?.bio || '';
            }
            
            if (profileModalEmail) {
                profileModalEmail.textContent = user.email;
            }
            
            if (profileModalAvatar && profile?.avatar_url) {
                profileModalAvatar.src = profile.avatar_url;
            }
            
            // Marcar el botón de estado activo
            const statusOptionButtons = document.querySelectorAll('.status-option');
            if (statusOptionButtons) {
                statusOptionButtons.forEach(button => {
                    button.classList.remove('active');
                    if (button.getAttribute('data-status') === (profile?.status || 'online')) {
                        button.classList.add('active');
                    }
                });
            }
            
            // Añadir listener para cambio de estado
            setupStatusChangeListeners();
            
            // Añadir listener para cambio de avatar
            setupAvatarChangeListener();
            
            // Configurar el botón de guardar
            setupSaveProfileButton();
            
            // Ocultar notificación de carga
            setTimeout(() => {
                showNotification('Perfil cargado correctamente', 'success');
            }, 500);
            
        } catch (error) {
            console.error('Error al cargar el modal de perfil:', error);
            showNotification('Error al cargar el perfil', 'error');
        }
    
    
    // Función para configurar el listener de cambio de avatar
    function setupAvatarChangeListener() {
        const avatarContainer = document.getElementById('avatarContainer');
        const avatarInput = document.getElementById('avatarInput');
        const profileModalAvatar = document.getElementById('profileModalAvatar');

        if (avatarContainer && avatarInput) {
            avatarContainer.addEventListener('click', () => {
                avatarInput.click();
            });

            avatarInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        showNotification('Subiendo avatar...', 'info');
                        
                        // Crear un nombre único para el archivo
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}.${fileExt}`;
                        
                        // Subir el archivo a Supabase Storage
                        const { data, error } = await supabaseClient.storage
                            .from('avatars')
                            .upload(`public/${fileName}`, file);
                            
                        if (error) throw error;
                        
                        // Obtener la URL pública del avatar
                        const { data: { publicUrl } } = supabaseClient.storage
                            .from('avatars')
                            .getPublicUrl(`public/${fileName}`);
                            
                        // Actualizar la UI
                        if (profileModalAvatar) profileModalAvatar.src = publicUrl;
                        if (userAvatarSidebar) userAvatarSidebar.src = publicUrl;
                        
                        showNotification('Avatar actualizado correctamente', 'success');
                    } catch (error) {
                        console.error('Error al subir el avatar:', error);
                        showNotification('Error al subir el avatar', 'error');
                    }
                }
            });
        }
    }

    // Función para configurar los listeners de cambio de estado
    function setupStatusChangeListeners() {
        const statusButtons = document.querySelectorAll('.status-option');
        
        statusButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const newStatus = button.getAttribute('data-status');
                
                try {
                    const { data: { user } } = await supabaseClient.auth.getUser();
                    
                    if (!user) throw new Error('No hay usuario autenticado');
                    
                    // Actualizar el estado en la base de datos
                    const { error } = await supabaseClient
                        .from('profiles')
                        .update({ status: newStatus })
                        .eq('id', user.id);
                        
                    if (error) throw error;
                    
                    // Actualizar UI
                    updateStatusDisplay(newStatus);
                    
                    // Actualizar botones
                    statusButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    showNotification('Estado actualizado correctamente', 'success');
                } catch (error) {
                    console.error('Error al actualizar el estado:', error);
                    showNotification('Error al actualizar el estado', 'error');
                }
            });
        });
    }

    // Función para configurar el botón de guardar perfil
    function setupSaveProfileButton() {
        const saveProfileBtn = document.getElementById('saveProfileBtn');
        
        if (saveProfileBtn) {
            // Eliminar listeners previos si existen
            saveProfileBtn.removeEventListener('click', handleSaveProfile);
            
            // Añadir nuevo listener
            saveProfileBtn.addEventListener('click', handleSaveProfile);
        }
    }

    // Función para guardar los cambios del perfil
    async function handleSaveProfile() {
        try {
            showNotification('Guardando cambios...', 'info');
            
            // Obtener los valores de los campos
            const displayName = document.getElementById('profileUsername').value.trim();
            const fullName = document.getElementById('profileFullName').value.trim();
            const bio = document.getElementById('profileBio').value.trim();
            
            // Obtener estado seleccionado
            const activeStatusBtn = document.querySelector('.status-option.active');
            const status = activeStatusBtn ? activeStatusBtn.getAttribute('data-status') : 'online';
            
            // Validaciones básicas
            if (!displayName) {
                showNotification('El nombre no puede estar vacío', 'error');
                return;
            }
            
            // Obtener el usuario actual
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                showNotification('Error al obtener la sesión', 'error');
                console.error('Error al obtener usuario:', userError);
                return;
            }
            
            // Preparar los datos a actualizar
            const profileData = {
                full_name: fullName || displayName,
                status,
                bio,
                username: displayName,
                updated_at: new Date()
            };
            
            // Actualizar el perfil en Supabase
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update(profileData)
                .eq('id', user.id);
                
            if (updateError) {
                showNotification('¡Error! No se pudo guardar tu perfil', 'error');
                console.error('Error al actualizar perfil:', updateError);
                return;
            }
            
            // Actualizar UI
            updateStatusDisplay(status);
            if (userNameSidebar) {
                userNameSidebar.textContent = fullName || displayName;
            }
            
            // Mostrar notificación de éxito y cerrar modal
            showNotification('¡Perfil actualizado correctamente! 😄', 'success');
            setTimeout(() => closeModal('userProfileModal'), 1000);
            
        } catch (error) {
            showNotification('¡Ups! Ocurrió un error al guardar los cambios', 'error');
            console.error('Error al guardar perfil:', error);
        }
    }

    // Configurar eventos iniciales cuando el DOM esté listo
    if (userProfileTrigger) {
        userProfileTrigger.addEventListener('click', () => {
            loadUserProfileModal();
            showModal('userProfileModal');
        });
    }

    if (userSettingsBtn) {
        userSettingsBtn.addEventListener('click', () => {
            loadSettingsData();
            showModal('settingsModal');
        });
    }

    // Cargar la sección inicial
    loadSectionContent('home');
    const avatarInput = document.getElementById('avatarFileInput');
    const avatarContainer = document.getElementById('avatarContainer');
        
        if (avatarContainer && avatarInput) {
            // Quitar listeners anteriores si existen
            avatarContainer.removeEventListener('click', handleAvatarContainerClick);
            avatarInput.removeEventListener('change', handleAvatarFileSelect);
            
            // Añadir nuevos listeners
            avatarContainer.addEventListener('click', handleAvatarContainerClick);
            avatarInput.addEventListener('change', handleAvatarFileSelect);
        }
    
    
    // Manejador para abrir el selector de archivos
    function handleAvatarContainerClick() {
        document.getElementById('avatarFileInput').click();
    }
    
    // Manejador para procesar el archivo seleccionado
    async function handleAvatarFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validar que sea una imagen
        if (!file.type.startsWith('image/')) {
            showNotification('Por favor selecciona un archivo de imagen', 'error');
            return;
        }
        
        try {
            // Mostrar un indicador de carga
            showNotification('Subiendo imagen...', 'info');
            
            // Obtener el usuario actual
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                showNotification('Error al obtener la sesión', 'error');
                console.error('Error al obtener usuario:', userError);
                return;
            }
            
            // Crear un nombre de archivo único
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `avatars/${fileName}`;
            
            // Subir el archivo a Supabase Storage
            const { error: uploadError } = await supabaseClient.storage
                .from('avatars')
                .upload(filePath, file);
                
            if (uploadError) {
                showNotification('Error al subir la imagen', 'error');
                console.error('Error al subir imagen:', uploadError);
                return;
            }
            
            // Obtener la URL pública del archivo
            const { data: urlData } = await supabaseClient.storage
                .from('avatars')
                .getPublicUrl(filePath);
                
            const avatarUrl = urlData.publicUrl;
            
            // Actualizar el perfil del usuario
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({
                    avatar_url: avatarUrl,
                    updated_at: new Date()
                })
                .eq('id', user.id);
                
            if (updateError) {
                showNotification('Error al actualizar el perfil', 'error');
                console.error('Error al actualizar perfil:', updateError);
                return;
            }
            
            // Actualizar la imagen en la UI
            document.getElementById('profileModalAvatar').src = avatarUrl;
            document.getElementById('userAvatarSidebar').src = avatarUrl;
            
            showNotification('Foto de perfil actualizada', 'success');
            
        } catch (error) {
            showNotification('Error al cambiar la foto de perfil', 'error');
            console.error('Error al cambiar avatar:', error);
        }
    }
    
    // Función para configurar el botón de guardar perfil
    function setupSaveProfileButton() {
        const saveProfileBtn = document.getElementById('saveProfileBtn');
        
        if (saveProfileBtn) {
            // Eliminar listeners previos si existen
            saveProfileBtn.removeEventListener('click', handleSaveProfile);
            
            // Añadir nuevo listener
            saveProfileBtn.addEventListener('click', handleSaveProfile);
        }
    }
    
    // Función para guardar los cambios del perfil
    async function handleSaveProfile() {
        try {
            // Mostrar indicador de carga
            showNotification('Guardando cambios...', 'info');
            
            // Obtener los valores de los campos
            const displayName = document.getElementById('profileUsername').value.trim();
            const fullName = document.getElementById('profileFullName').value.trim();
            const bio = document.getElementById('profileBio').value.trim();
            
            // Obtener estado seleccionado
            const activeStatusBtn = document.querySelector('.status-option.active');
            const status = activeStatusBtn ? activeStatusBtn.getAttribute('data-status') : 'online';
            
            // Validaciones básicas
            if (!displayName) {
                showNotification('El nombre no puede estar vacío', 'error');
                return;
            }
            
            // Obtener el usuario actual
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                showNotification('Error al obtener la sesión', 'error');
                console.error('Error al obtener usuario:', userError);
                return;
            }
            
            // Preparar los datos a actualizar (solo con campos que existen en la tabla)
            const profileData = {
                full_name: fullName || displayName, // Si no hay nombre completo, usamos el nombre de usuario como nombre
                status
                // No incluimos bio ni username porque no existen en la tabla
            };
            
            // Actualizar el perfil en Supabase
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update(profileData)
                .eq('id', user.id);
                
            if (updateError) {
                showNotification('\u00A1Error! No se pudo guardar tu perfil', 'error');
                console.error('Error al actualizar perfil:', updateError);
                return;
            }
            
            console.log('Estado actualizado a:', status);
            
            // Actualizar manualmente el estado en la barra lateral
            const userStatusDisplay = document.getElementById('userStatusDisplay');
            if (userStatusDisplay) {
                userStatusDisplay.textContent = getStatusText(status);
                console.log('Texto del estado actualizado a:', getStatusText(status));
            }
            
            // Añadir clase CSS al elemento para destacar el cambio
            if (userStatusDisplay) {
                userStatusDisplay.classList.add('status-updated');
                setTimeout(() => {
                    userStatusDisplay.classList.remove('status-updated');
                }, 1500);
            }
            
            // Actualizar otros elementos de la UI si es necesario
            if (userNameSidebar) {
                userNameSidebar.textContent = fullName || displayName;
            }
            
            // Mostrar notificación de éxito con un ligero retraso para que se vea después de cerrar el modal
            setTimeout(() => {
                showNotification('¡Perfil actualizado correctamente! \uD83D\uDE04', 'success');
            }, 300);
            
            // Cerramos el modal automáticamente
            closeModal('userProfileModal');
            
        } catch (error) {
            showNotification('¡Ups! Ocurrió un error al guardar los cambios', 'error');
            console.error('Error al guardar perfil:', error);
        }
    }
    
    // Función para manejar el cambio de estado
    function setupStatusChangeListeners() {
        const statusButtons = document.querySelectorAll('.status-option');
        
        statusButtons.forEach(button => {
            button.addEventListener('click', async function() {
                // Quitar clase activa de todos los botones
                statusButtons.forEach(btn => btn.classList.remove('active'));
                
                // Añadir clase activa al botón clickeado
                this.classList.add('active');
                
                // Obtener el estado seleccionado
                const newStatus = this.getAttribute('data-status');
                
                // Actualizar el indicador visual de estado
                updateProfileStatusIndicator(newStatus);
                
                try {
                    // Obtener usuario actual
                    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                    
                    if (userError) {
                        console.error('Error al obtener usuario:', userError);
                        return;
                    }
                    
                    // Actualizar estado en la base de datos
                    const { error: updateError } = await supabaseClient
                        .from('profiles')
                        .update({ status: newStatus })
                        .eq('id', user.id);
                        
                    if (updateError) {
                        console.error('Error al actualizar estado:', updateError);
                        showNotification('Error al actualizar estado', 'error');
                        return;
                    }
                    
                    // Mostrar notificación de éxito
                    showNotification(`Estado cambiado a ${getStatusText(newStatus)}`, 'success');
                    
                    // Actualizar UI
                    updateStatusDisplay(newStatus);
                    
                } catch (error) {
                    console.error('Error al cambiar estado:', error);
                    showNotification('Error al cambiar estado', 'error');
                }
            });
        });
    }
    
    // --- Event Listeners ---
    document.addEventListener('DOMContentLoaded', async () => {
        console.log("DOM Cargado. Iniciando dashboard...");
        
        // Verificar autenticación primero
        // Cargar datos del usuario
        await loadUserData();
        
        // Configurar listeners de botones
        if (addServerBtn) {
            addServerBtn.addEventListener('click', () => {
                console.log("Abriendo modal de crear servidor");
                showModal('createServerModal');
            });
        }
        
        if (userSettingsBtn) {
            userSettingsBtn.addEventListener('click', () => {
                console.log("Abriendo modal de ajustes");
                showModal('settingsModal');
            });
        }

        if (userProfileTrigger) {
             userProfileTrigger.addEventListener('click', () => {
                 console.log("Área de Perfil clickeada");
                 // Cargar los datos del usuario en el modal
                 loadUserProfileModal();
                 // Mostrar el modal de perfil
                 showModal('userProfileModal');
             });
         }
    });

    // Función para cargar contenido de la sección
    function loadSectionContent(sectionId) {
        console.log(`Cargando sección: ${sectionId}`);
        const mainContentArea = document.getElementById('mainContentArea');
        if (!mainContentArea) return;

        // Cambiar título
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) {
            contentTitle.textContent = capitalizeFirstLetter(sectionId);
        }

        // Limpiar contenido anterior
        mainContentArea.innerHTML = '';

        // Cargar el contenido adecuado
        switch (sectionId) {
            case 'home':
                // Contenido de inicio
                mainContentArea.innerHTML = getHomeHTML();
                break;
            case 'explore':
                // Contenido de explorar
                mainContentArea.innerHTML = getExploreHTML();
                break;
            case 'dms':
                // Contenido de mensajes directos
                mainContentArea.innerHTML = getDMsHTML();
                break;
            case 'friends':
                // Cargar sección de amigos si existe la función
                if (typeof loadFriendsSection === 'function') {
                    loadFriendsSection();
                } else {
                    mainContentArea.innerHTML = getFriendsSectionHTML();
                    setupFriendsSectionListeners();
                }
                break;
            case 'notifications':
                // Usar el centro de notificaciones del archivo notifications-center.js
                console.log('Intentando cargar sección de notificaciones...');
                
                // Primera opción: usar el método del objeto NotificationsCenter
                if (window.notificationsCenter && typeof window.notificationsCenter.loadNotificationsSection === 'function') {
                    window.notificationsCenter.loadNotificationsSection();
                    return;
                }
                
                // Segunda opción: usar la función global
                if (typeof window.loadNotificationsSection === 'function') {
                    window.loadNotificationsSection();
                    return;
                }
                
                // Tercera opción: usar la implementación interna
                if (typeof loadNotificationsSection === 'function') {
                    loadNotificationsSection();
                    return;
                }
                
                // Si no existe ninguna de las opciones, mostrar error
                console.error('La función loadNotificationsSection no está disponible.');
                mainContentArea.innerHTML = `
                    <div class="notifications-panel">
                        <div class="placeholder-text" style="text-align: center; padding: 40px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--db-warning); margin-bottom: 20px;"></i>
                            <h3>Centro de notificaciones no disponible</h3>
                            <p>No se pudo cargar el sistema de notificaciones. Verifica en consola si hay errores.</p>
                            <button class="cyber-btn primary" onclick="location.reload()">
                                <i class="fas fa-sync"></i> Recargar página
                            </button>
                        </div>
                    </div>
                `;
                break;
            default:
                // Sección desconocida
                mainContentArea.innerHTML = `
                    <div class="placeholder-section">
                        <h3>Sección en desarrollo</h3>
                        <p>Esta funcionalidad estará disponible próximamente.</p>
                    </div>
                `;
        }
    }

    // Añadir listeners a los items de navegación (si existen)
    if (navItems) {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // Quitar clase activa de todos
            navItems.forEach(i => i.classList.remove('active'));
            // Añadir clase activa al clickeado
            item.classList.add('active');
            // Cargar contenido
            const section = item.dataset.section;
            loadSectionContent(section);
        });
    });

    // Cargar la sección 'home' por defecto al inicio
    // Asegúrate que esto se ejecute después de que el DOM esté listo y el usuario cargado
    // Se puede mover dentro del try/catch del DOMContentLoaded después de cargar el perfil.
    // loadSectionContent('home'); // Lo moveremos dentro del DOMContentLoaded

    // --- HTML y Listeners para la Sección de Amigos ---

    function getFriendsSectionHTML() {
        return `
            <div class="friends-header">
                <div class="friends-tabs">
                    <button class="friend-tab active" data-filter="online">En línea</button>
                    <button class="friend-tab" data-filter="all">Todos</button>
                    <button class="friend-tab" data-filter="pending">Pendiente</button>
                    <button class="friend-tab" data-filter="blocked">Bloqueado</button>
                </div>
                <button class="cyber-btn primary small" id="addFriendBtnMain">Añadir amigo</button>
            </div>
            <div class="add-friend-section" style="display: none; margin-bottom: 20px;">
                 <label for="addFriendInput">Añade un amigo con su nombre de usuario o correo</label>
                 <div style="display: flex; gap: 10px;">
                    <input type="text" id="addFriendInput" placeholder="usuario#1234 o usuario@ejemplo.com" class="cyber-input flex-grow">
                    <button class="cyber-btn success small" id="sendFriendRequestBtn">Enviar solicitud</button>
                 </div>
                 <span id="addFriendError" class="error-message" style="margin-top: 5px;"></span>
                 <span id="addFriendSuccess" class="success-message" style="margin-top: 5px; color: var(--db-success);"></span>
            </div>
            <div class="friend-list-container">
                <h3 id="friendListTitle">En línea — 0</h3>
                <div id="friendList" class="friend-list">
                    <!-- La lista de amigos se cargará aquí -->
                    <p class="placeholder-text">Nadie por aquí...</p>
                </div>
            </div>
        `;
    }

    function setupFriendsSectionListeners() {
        const addFriendBtnMain = document.getElementById('addFriendBtnMain');
        const addFriendSection = document.querySelector('.add-friend-section');
        const sendFriendRequestBtn = document.getElementById('sendFriendRequestBtn');
        const addFriendInput = document.getElementById('addFriendInput');
        const addFriendError = document.getElementById('addFriendError');
        const addFriendSuccess = document.getElementById('addFriendSuccess');
        const friendTabs = document.querySelectorAll('.friend-tab');
        const friendListTitle = document.getElementById('friendListTitle');

        // Mostrar/ocultar input para añadir amigo
        if (addFriendBtnMain && addFriendSection) {
            addFriendBtnMain.addEventListener('click', () => {
                addFriendSection.style.display = addFriendSection.style.display === 'none' ? 'block' : 'none';
                 if(addFriendSection.style.display === 'block') {
                     addFriendInput.focus();
                 }
            });
        }

        // Enviar solicitud de amistad
        if (sendFriendRequestBtn && addFriendInput) {
            sendFriendRequestBtn.addEventListener('click', async () => {
                const friendIdentifier = addFriendInput.value.trim();
                addFriendError.textContent = ''; // Limpiar errores
                addFriendSuccess.textContent = ''; // Limpiar éxito

                if (!friendIdentifier) {
                    addFriendError.textContent = 'Ingresa un nombre de usuario o correo.';
                    return;
                }

                console.log(`Intentando añadir amigo: ${friendIdentifier}`);
                showNotification(`Enviando solicitud a ${friendIdentifier}...`, 'info');

                try {
                    // Obtener el usuario actual
                    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                    if (userError) throw new Error("Error al obtener usuario actual");
                    if (!user) throw new Error("No hay usuario autenticado");
                    
                    // Buscar al usuario por nombre de usuario
                    const { data: targetUser, error: findError } = await supabaseClient
                        .from('profiles')
                        .select('id, username, full_name')
                        .eq('username', friendIdentifier)
                        .single();
                    
                    if (findError || !targetUser) {
                        // Intentar buscar por email si no se encontró por username
                        const { data: targetUserByEmail, error: findEmailError } = await supabaseClient
                            .from('profiles')
                            .select('id, username, full_name')
                            .eq('email', friendIdentifier)
                            .single();
                            
                        if (findEmailError || !targetUserByEmail) {
                            throw new Error("Usuario no encontrado");
                        }
                        
                        // Si se encontró por email, usar ese usuario
                        targetUser = targetUserByEmail;
                    }
                    
                    // Verificar que no sea uno mismo
                    if (targetUser.id === user.id) {
                        throw new Error("No puedes enviarte una solicitud a ti mismo");
                    }
                    
                    // Verificar si ya son amigos
                    const { data: existingFriendship, error: friendshipError } = await supabaseClient
                        .from('friendships')
                        .select('id')
                        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
                        .or(`user1_id.eq.${targetUser.id},user2_id.eq.${targetUser.id}`);

                    if (existingFriendship?.length > 0) {
                        throw new Error("Ya existe una amistad o solicitud pendiente con este usuario");
                    }

                    // Crear la solicitud de amistad
                    const { error: createError } = await supabaseClient
                        .from('friendships')
                        .insert([
                            {
                                user1_id: user.id,
                                user2_id: targetUser.id,
                                status: 'pending'
                            }
                        ]);

                    if (createError) throw new Error("Error al enviar la solicitud");

                    addFriendSuccess.textContent = `Solicitud enviada a ${targetUser.username || targetUser.full_name}`;
                    addFriendInput.value = '';
                    showNotification('Solicitud de amistad enviada correctamente', 'success');

                } catch (error) {
                    console.error('Error al enviar solicitud:', error);
                    addFriendError.textContent = error.message;
                    showNotification('Error al enviar la solicitud', 'error');
                }
            });
        }

        // Cambiar entre pestañas de amigos
        if (friendTabs) {
            friendTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    friendTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const filter = tab.dataset.filter;
                    const friendListTitle = document.getElementById('friendListTitle');
                    if (friendListTitle) {
                        friendListTitle.textContent = `${tab.textContent} — 0`;
                    }
                    // Aquí se implementará la lógica de filtrado
                });
            });
        }
    }

    // Función para manejar el cambio de avatar
    function handleAvatarChange() {
        const avatarInput = document.getElementById('avatarInput');
        if (!avatarInput) return;
        
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                if (userError || !user) {
                    console.error('Error al obtener usuario o no hay sesión:', userError);
                    showNotification('Error al obtener el usuario', 'error');
                    return;
                }
                
                const { data: { avatar }, error: avatarError } = await supabaseClient
                    .from('profiles')
                    .select('avatar')
                    .eq('id', user.id)
                    .single();
                
                if (avatarError) throw avatarError;
                
                const formData = new FormData();
                formData.append('avatar', file);
                
                const { data: { data: { avatar: newAvatar } }, error: uploadError } = await supabaseClient
                    .storage
                    .from('avatars')
                    .upload(`avatar-${user.id}`, formData);
                
                if (uploadError) throw uploadError;
                
                // Actualizar avatar en la base de datos
                const { error: updateError } = await supabaseClient
                    .from('profiles')
                    .update({ avatar: newAvatar })
                    .eq('id', user.id);
                
                if (updateError) throw updateError;
                
                // Actualizar avatar en el perfil
                const avatarElement = document.getElementById('profileAvatar');
                if (avatarElement) {
                    avatarElement.src = supabaseClient.storage.from('avatars').getPublicUrl(newAvatar);
                }
                
                showNotification('Avatar actualizado correctamente', 'success');
            } catch (error) {
                console.error('Error al actualizar avatar:', error);
                showNotification('Error al actualizar el avatar', 'error');
            }
        });
    }

    // Inicializar eventos
    initializeEditFields();
    handleAvatarChange();

    // Añadir manejador para el botón de notificaciones
    function handleNavigation(section) {
        console.log(`Navegando a la sección: ${section}`);
        
        // Actualizar pestañas activas
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.section === section) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Actualizar título de la sección
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) {
            contentTitle.textContent = capitalizeFirstLetter(section);
        }
        
        // Cargar contenido según la sección
        loadSectionContent(section);
    }

    // Cargar contenido específico de cada sección
    function loadSectionContent(sectionId) {
        console.log(`Cargando sección: ${sectionId}`);
        const mainContentArea = document.getElementById('mainContentArea');
        if (!mainContentArea) return;

        // Cambiar título
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) {
            contentTitle.textContent = capitalizeFirstLetter(sectionId);
        }

        // Limpiar contenido anterior
        mainContentArea.innerHTML = '';

        // Cargar el contenido adecuado
        switch (sectionId) {
            case 'home':
                // Contenido de inicio
                mainContentArea.innerHTML = getHomeHTML();
                break;
            case 'explore':
                // Contenido de explorar
                mainContentArea.innerHTML = getExploreHTML();
                break;
            case 'dms':
                // Contenido de mensajes directos
                mainContentArea.innerHTML = getDMsHTML();
                break;
            case 'friends':
                // Cargar sección de amigos si existe la función
                if (typeof loadFriendsSection === 'function') {
                    loadFriendsSection();
                } else {
                    mainContentArea.innerHTML = getFriendsSectionHTML();
                    setupFriendsSectionListeners();
                }
                break;
            case 'notifications':
                // Usar el centro de notificaciones del archivo notifications-center.js
                console.log('Intentando cargar sección de notificaciones...');
                
                // Primera opción: usar el método del objeto NotificationsCenter
                if (window.notificationsCenter && typeof window.notificationsCenter.loadNotificationsSection === 'function') {
                    window.notificationsCenter.loadNotificationsSection();
                    return;
                }
                
                // Segunda opción: usar la función global
                if (typeof window.loadNotificationsSection === 'function') {
                    window.loadNotificationsSection();
                    return;
                }
                
                // Tercera opción: usar la implementación interna
                if (typeof loadNotificationsSection === 'function') {
                    loadNotificationsSection();
                    return;
                }
                
                // Si no existe ninguna de las opciones, mostrar error
                console.error('La función loadNotificationsSection no está disponible.');
                mainContentArea.innerHTML = `
                    <div class="notifications-panel">
                        <div class="placeholder-text" style="text-align: center; padding: 40px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--db-warning); margin-bottom: 20px;"></i>
                            <h3>Centro de notificaciones no disponible</h3>
                            <p>No se pudo cargar el sistema de notificaciones. Verifica en consola si hay errores.</p>
                            <button class="cyber-btn primary" onclick="location.reload()">
                                <i class="fas fa-sync"></i> Recargar página
                            </button>
                        </div>
                    </div>
                `;
                break;
            default:
                // Sección desconocida
                mainContentArea.innerHTML = `
                    <div class="placeholder-section">
                        <h3>Sección en desarrollo</h3>
                        <p>Esta funcionalidad estará disponible próximamente.</p>
                    </div>
                `;
        }
    }

    // ... existing code ...

    // Cargar sección de notificaciones
    async function loadNotificationsSection() {
        const mainContentArea = document.getElementById('mainContentArea');
        
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
                loadNotifications(tab.dataset.type);
            });
        });
        
        // Botón para marcar todas como leídas
        const markAllReadBtn = document.querySelector('.mark-all-read-btn');
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
        
        // Cargar notificaciones iniciales (todas)
        loadNotifications('all');
    }

    // Cargar notificaciones según el tipo
    async function loadNotifications(type = 'all') {
        const notificationsList = document.getElementById('notificationsList');
        
        if (!notificationsList) return;
        
        // Mostrar estado de carga
        notificationsList.innerHTML = `
            <div class="loading-placeholder" style="text-align: center; padding: 20px;">
                <i class="fas fa-spinner fa-spin"></i> Cargando notificaciones...
            </div>
        `;
        
        try {
            // Verificar si hay usuario autenticado
            const { data: { user } } = await supabaseClient.auth.getUser();
            
            if (!user) {
                notificationsList.innerHTML = `
                    <div class="placeholder-text" style="text-align: center; padding: 20px;">
                        Inicia sesión para ver tus notificaciones
                    </div>
                `;
                return;
            }
            
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
                    .eq('receiver_id', user.id)
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
                notificationsList.innerHTML = `
                    <div class="placeholder-text" style="text-align: center; padding: 20px;">
                        No tienes notificaciones ${type !== 'all' ? 'de este tipo' : ''}
                    </div>
                `;
                
                // Actualizar contador del botón (ocultar si no hay notificaciones)
                updateNotificationCount(0);
                return;
            }
            
            // Ordenar por fecha más reciente
            notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Actualizar contador del botón
            updateNotificationCount(notifications.length);
            
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
            setupNotificationActionListeners();
            
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
    function setupNotificationActionListeners() {
        // Botones para aceptar solicitudes de amistad
        document.querySelectorAll('.notification-btn.accept').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const requestId = btn.dataset.requestId;
                const senderId = btn.dataset.senderId;
                const senderUserID = btn.dataset.senderUserId;
                
                // Mostrar notificación de carga
                showNotification('info', 'Aceptando solicitud...', 2000);
                
                try {
                    // Aceptar solicitud usando la función en friends.js
                    if (typeof acceptFriendRequest === 'function') {
                        await acceptFriendRequest(requestId, senderId, senderUserID);
                        
                        // Eliminar la notificación de la UI
                        const notificationItem = btn.closest('.notification-item');
                        if (notificationItem) {
                            notificationItem.remove();
                        }
                        
                        // Actualizar contador
                        const remainingNotifications = document.querySelectorAll('.notification-item').length;
                        updateNotificationCount(remainingNotifications);
                        
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
                    } else {
                        throw new Error('Función acceptFriendRequest no disponible');
                    }
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
                    // Rechazar solicitud usando la función en friends.js
                    if (typeof rejectFriendRequest === 'function') {
                        await rejectFriendRequest(requestId);
                        
                        // Eliminar la notificación de la UI
                        const notificationItem = btn.closest('.notification-item');
                        if (notificationItem) {
                            notificationItem.remove();
                        }
                        
                        // Actualizar contador
                        const remainingNotifications = document.querySelectorAll('.notification-item').length;
                        updateNotificationCount(remainingNotifications);
                        
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
                    } else {
                        throw new Error('Función rejectFriendRequest no disponible');
                    }
                } catch (error) {
                    console.error('Error al rechazar solicitud:', error);
                    showNotification('error', 'Error al rechazar solicitud', 3000);
                }
            });
        });
    }

    // Marcar todas las notificaciones como leídas
    function markAllNotificationsAsRead() {
        // Marcar todas las notificaciones visibles como leídas
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
        });
        
        // Actualizar contador
        updateNotificationCount(0);
        
        // Mostrar notificación
        showNotification('success', 'Todas las notificaciones marcadas como leídas', 3000);
    }

    // Actualizar contador de notificaciones en el botón de la barra lateral
    function updateNotificationCount(count) {
        const badge = document.getElementById('notificationCountBadge');
        
        if (!badge) return;
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // Función auxiliar para capitalizar primera letra
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // ... existing code ...
    // Inicializar al cargar el documento
    document.addEventListener('DOMContentLoaded', () => {
        initializeDashboard();
    });

    // Función para obtener el HTML de la sección Home
    function getHomeHTML() {
        return `
            <div class="home-content">
                <h2>Actividad Reciente</h2>
                <p class="placeholder-text">Aquí aparecerá la actividad de tus amigos y servidores (próximamente).</p>
            </div>
        `;
    }

    // Función para obtener el HTML de la sección Explorar
    function getExploreHTML() {
        return `
            <div class="explore-content">
                <div class="explore-search">
                    <div class="input-with-icon">
                        <input type="text" placeholder="Buscar servidores..." class="cyber-input">
                        <i class="fas fa-search search-icon"></i>
                    </div>
                    <button class="cyber-btn primary small">Buscar</button>
                </div>
                <p class="placeholder-text">Listado de servidores públicos aparecerá aquí (próximamente).</p>
            </div>
        `;
    }

    // Función para obtener el HTML de la sección Mensajes Directos
    function getDMsHTML() {
        return `
            <div class="dms-content">
                <h2>Mensajes Directos</h2>
                <p class="placeholder-text">Aquí aparecerán tus conversaciones (próximamente).</p>
            </div>
        `;
    }
}
}

