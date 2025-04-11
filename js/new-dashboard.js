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
    function showNotification(message, type = 'info') {
        const notificationElement = document.getElementById('notification');
        const notificationMessage = document.getElementById('notificationMessage');
        const notificationIcon = document.getElementById('notificationIcon');

        if (!notificationElement || !notificationMessage || !notificationIcon) {
            console.error("Elementos de notificación no encontrados en el DOM.");
            // Fallback si no existe el elemento
            alert(`${type.toUpperCase()}: ${message}`);
            return;
        }

        // Cancelar cualquier temporizador anterior
        if (window.notificationTimeout) {
            clearTimeout(window.notificationTimeout);
        }

        // Eliminar cualquier animación anterior
        notificationElement.classList.remove('show', 'hide');
        
        // Resetear para forzar reflow y reiniciar la animación
        void notificationElement.offsetWidth;
        
        // Configurar contenido
        notificationMessage.textContent = message;
        
        // Tipo de notificación
        notificationElement.className = `notification ${type}`;
        
        // Configurar el icono
        notificationIcon.className = 'fas';
        switch (type) {
            case 'success': 
                notificationIcon.classList.add('fa-check-circle');
                // Reproducir sonido de éxito si se desea
                // new Audio('path/to/success-sound.mp3').play().catch(e => {});
                break;
            case 'error': 
                notificationIcon.classList.add('fa-exclamation-circle');
                // Reproducir sonido de error si se desea
                // new Audio('path/to/error-sound.mp3').play().catch(e => {});
                break;
            case 'warning': 
                notificationIcon.classList.add('fa-exclamation-triangle'); 
                break;
            default: 
                notificationIcon.classList.add('fa-info-circle'); 
                break;
        }

        // Mostrar la notificación
        requestAnimationFrame(() => {
            notificationElement.classList.add('show');
        });
        
        // Duración extendida para mensajes importantes
        const duration = type === 'success' || type === 'error' ? 5000 : 3500;
        
        // Ocultar después del tiempo establecido
        window.notificationTimeout = setTimeout(() => {
            notificationElement.classList.remove('show');
            notificationElement.classList.add('hide');
            
            setTimeout(() => {
                notificationElement.classList.remove('hide');
                notificationElement.style.visibility = 'hidden';
            }, 500); // Tiempo de la animación de salida
        }, duration);
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
        if (!mainContentArea || !contentTitle) {
            console.error("Área de contenido o título no encontrados.");
            return;
        }

        // Limpiar contenido anterior
        mainContentArea.innerHTML = ''; // Limpiar área principal

        // Cambiar título y cargar contenido según la sección
        switch (sectionId) {
            case 'home':
                contentTitle.textContent = 'Inicio';
                mainContentArea.innerHTML = `
                    <h2>Actividad Reciente</h2>
                    <p class="placeholder-text">Aquí aparecerá la actividad de tus amigos y servidores (próximamente).</p>
                    <!-- Más contenido de inicio aquí -->
                `;
                // Aquí podrías llamar a una función para cargar la actividad real
                // loadHomeActivity();
                break;
            case 'explore':
                contentTitle.textContent = 'Explorar Servidores Públicos';
                mainContentArea.innerHTML = `
                    <div class="explore-search">
                        <!-- Añadir wrapper para icono -->
                        <div class="input-with-icon">
                             <i class="fas fa-search search-icon"></i>
                             <input type="text" placeholder="Buscar servidores..." class="cyber-input">
                        </div>
                        <button class="cyber-btn primary small">Buscar</button> <!-- Añadida clase 'primary' -->
                    </div>
                    <p class="placeholder-text">Listado de servidores públicos aparecerá aquí (próximamente).</p>
                    <!-- loadPublicServers(); -->
                `;
                break;
            case 'dms': // Sección de Mensajes Directos / Amigos
                contentTitle.textContent = 'Amigos';
                // Usar la función loadFriendsSection de friends.js si está disponible
                if (typeof loadFriendsSection === 'function') {
                    loadFriendsSection();
                    // Inicializar el sistema de amigos
                    if (typeof initFriendsSystem === 'function') {
                        initFriendsSystem();
                    }
                } else {
                    // Fallback si friends.js no está cargado
                    mainContentArea.innerHTML = getFriendsSectionHTML();
                    setupFriendsSectionListeners();
                    console.warn("Sistema de amigos no disponible. Usando interfaz básica.");
                }
                break;
            default:
                contentTitle.textContent = 'Sección Desconocida';
                mainContentArea.innerHTML = `<p>Contenido para '${sectionId}' no implementado.</p>`;
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

        // Cambiar filtro de lista de amigos (Tabs)
        const friendTabs = document.querySelectorAll('.friend-tab');
        if (friendTabs) {
            friendTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    friendTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const filter = tab.dataset.filter;
                    console.log(`Cambiando filtro de amigos a: ${filter}`);
                    
                    // Cargar la lista filtrada usando la función de friends.js
                    if (filter === 'pending') {
                        // Si es la pestaña de pendientes, mostrar solicitudes
                        loadFriendRequests();
                    } else {
                        // Para otras pestañas, cargar lista de amigos con filtro
                        loadFriendsList(filter);
                    }
                });
            });
        }
        

    // --- Selectores Adicionales para Modal de Ajustes ---
    const settingsModal = document.getElementById('settingsModal');
    const settingsAvatarInput = document.getElementById('settingsAvatarInput');
    const settingsNavItems = document.querySelectorAll('.settings-nav-item');
    const settingsTabContents = document.querySelectorAll('.settings-tab-content');
    const logoutButtonSettings = document.getElementById('logoutButtonSettings');
    const editFieldContainer = document.getElementById('editFieldContainer');
    const editFieldLabelInline = document.getElementById('editFieldLabelInline');
    const editFieldInputInline = document.getElementById('editFieldInputInline');
    const saveEditFieldBtn = document.getElementById('saveEditFieldBtn');
    const cancelEditFieldBtn = document.getElementById('cancelEditFieldBtn');
    const editFieldError = document.getElementById('editFieldError');
    const themeOptionBtns = document.querySelectorAll('.theme-option-btn');

    let currentEditingField = null; // Para saber qué campo se está editando

    // --- Funciones para Modal de Ajustes ---

    // Cargar datos en el modal de ajustes
    async function loadSettingsData() {
        console.log("Iniciando carga de datos de ajustes...");
        
        try {
            // 1. Obtener usuario actual
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                throw new Error("Error al obtener usuario: " + userError.message);
            }
            
            if (!user) {
                throw new Error("No se encontró sesión de usuario");
            }

            console.log("Usuario autenticado encontrado:", user.id);

            // 2. Actualizar datos básicos de autenticación
            if (settingsEmailDisplay) {
                settingsEmailDisplay.textContent = user.email || 'No disponible';
            }

            // 3. Obtener datos del perfil
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error("Error al obtener el perfil:", profileError.message);
                // Si hay error al obtener el perfil, mostrar datos básicos del usuario
                updateUIWithBasicUserData(user);
                return;
            }

            if (profile) {
                console.log("Perfil encontrado:", profile);
                updateUIWithProfile(profile);
            } else {
                console.log("No se encontró perfil, creando uno nuevo...");
                // Crear perfil por defecto
                const { data: newProfile, error: createError } = await supabaseClient
                    .from('profiles')
                    .insert([
                        {
                            id: user.id,
                            full_name: user.email.split('@')[0],
                            username: user.email.split('@')[0],
                            avatar_url: 'img/default-avatar.png',
                            status: 'online'
                        }
                    ])
                    .single();

                if (createError) {
                    console.error("Error al crear perfil:", createError);
                    updateUIWithBasicUserData(user);
                } else {
                    updateUIWithProfile(newProfile);
                }
            }

        } catch (error) {
            console.error("Error en loadSettingsData:", error);
            showNotification("Error al cargar datos: " + error.message, "error");
        }
    }

    // Función auxiliar para actualizar la UI con datos básicos del usuario
    function updateUIWithBasicUserData(user) {
        const defaultUsername = user.email ? user.email.split('@')[0] : 'Usuario';
        
        if (userNameSidebar) userNameSidebar.textContent = defaultUsername;
        if (settingsUsernameDisplay) settingsUsernameDisplay.textContent = defaultUsername;
        if (settingsFullNameDisplay) settingsFullNameDisplay.textContent = defaultUsername;
        if (settingsEmailDisplay) settingsEmailDisplay.textContent = user.email || 'No disponible';
        if (userAvatarSidebar) userAvatarSidebar.src = 'img/default-avatar.png';
        if (settingsAvatarPreview) settingsAvatarPreview.src = 'img/default-avatar.png';
    }

    // Función auxiliar para actualizar la UI con los datos del perfil
    function updateUIWithProfile(profile) {
        if (userNameSidebar) {
            userNameSidebar.textContent = profile.full_name || profile.username || 'Usuario';
        }
        
        if (settingsFullNameDisplay) {
            settingsFullNameDisplay.textContent = profile.full_name || 'No establecido';
        }
        
        if (settingsUsernameDisplay) {
            settingsUsernameDisplay.textContent = profile.username || 'No establecido';
        }
        
        if (settingsEmailDisplay && profile.email) {
            settingsEmailDisplay.textContent = profile.email;
        }
        
        if (settingsAvatarPreview) {
            settingsAvatarPreview.src = profile.avatar_url || 'img/default-avatar.png';
            settingsAvatarPreview.onerror = () => {
                settingsAvatarPreview.src = 'img/default-avatar.png';
            };
        }
        
        if (userAvatarSidebar) {
            userAvatarSidebar.src = profile.avatar_url || 'img/default-avatar.png';
            userAvatarSidebar.onerror = () => {
                userAvatarSidebar.src = 'img/default-avatar.png';
            };
        }
        
        // Asegurarse de que haya un estado predeterminado si no hay ninguno guardado
        // Si no tiene estado guardado, usamos 'online' como predeterminado
        const userStatus = profile.status || 'online';
        console.log('Cargando estado guardado del usuario:', userStatus);
        
        // 1. Primero forzar una actualización directa de los indicadores de estado
        const statusDotClasses = {
            'online': 'online',
            'idle': 'ausente',
            'dnd': 'no-molestar',
            'invisible': 'invisible',
            'offline': 'offline'
        };
        
        // Aplicar la clase CSS correspondiente al estado del usuario
        const cssClass = statusDotClasses[userStatus] || 'online';
        
        // 2. Actualizar el texto de estado y los indicadores en la barra lateral
        updateStatusDisplay(userStatus);
        
        // 2. Actualizar manualmente los indicadores de estado para asegurar que se actualicen
        const sidebarStatusIndicator = document.getElementById('sidebarStatusIndicator');
        if (sidebarStatusIndicator) {
            // Convertir entre diferentes nombres de estado
            let cssClass = userStatus || 'offline';
            
            // Si el estado es 'idle', usar la clase 'ausente' para compatibilidad 
            if (userStatus === 'idle') {
                cssClass = 'ausente';
            }
            // Si el estado es 'dnd', usar la clase 'no-molestar' para compatibilidad
            else if (userStatus === 'dnd') {
                cssClass = 'no-molestar';
            }
            
            console.log('Actualizando indicador de la barra lateral a:', userStatus, '(CSS class:', cssClass, ')');
            console.log('Clases actuales del indicador:', sidebarStatusIndicator.className);
            
            // Forzar primero un estilo directo para asegurar que el color se aplique
            switch(cssClass) {
                case 'online':
                    sidebarStatusIndicator.style.backgroundColor = 'var(--db-online)';
                    break;
                case 'ausente':
                case 'idle':
                    sidebarStatusIndicator.style.backgroundColor = 'var(--db-idle)';
                    break;
                case 'no-molestar':
                case 'dnd':
                    sidebarStatusIndicator.style.backgroundColor = 'var(--db-dnd)';
                    break;
                case 'invisible':
                case 'offline':
                    sidebarStatusIndicator.style.backgroundColor = 'var(--db-invisible)';
                    break;
                default:
                    sidebarStatusIndicator.style.backgroundColor = 'var(--db-online)';
            }
            
            // Luego también aplicar las clases CSS
            sidebarStatusIndicator.classList.remove('online', 'ausente', 'idle', 'dnd', 'no-molestar', 'invisible', 'offline');
            sidebarStatusIndicator.classList.add(cssClass);
            console.log('Clases después de actualizar:', sidebarStatusIndicator.className);
        }
        
        // 3. Actualizar también el indicador en el perfil (si existe)
        const profileStatusIndicator = document.getElementById('profileStatusIndicator');
        if (profileStatusIndicator) {
            // Convertir entre diferentes nombres de estado
            let cssClass = userStatus || 'offline';
            
            // Si el estado es 'idle', usar la clase 'ausente' para compatibilidad 
            if (userStatus === 'idle') {
                cssClass = 'ausente';
            }
            // Si el estado es 'dnd', usar la clase 'no-molestar' para compatibilidad
            else if (userStatus === 'dnd') {
                cssClass = 'no-molestar';
            }
            
            console.log('Actualizando indicador del perfil a:', userStatus, '(CSS class:', cssClass, ')');
            profileStatusIndicator.classList.remove('online', 'ausente', 'idle', 'dnd', 'no-molestar', 'invisible', 'offline');
            profileStatusIndicator.classList.add(cssClass);
        }
    }

    // Lógica para cambio de pestañas en ajustes
    const settingsNavElements = document.querySelectorAll('.settings-nav-item');
    if (settingsNavElements) {
        settingsNavElements.forEach(item => {
            item.addEventListener('click', () => {
                // Ignorar si es el botón de logout
            if (item.id === 'logoutButtonSettings') return;

            // Ocultar campo de edición si estaba visible
            hideEditField();

            const tabId = item.dataset.tab;
            if (!tabId) return; // Si no tiene data-tab, ignorar

            // Marcar como activa la pestaña
            settingsNavItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Mostrar el contenido de la pestaña
            settingsTabContents.forEach(content => {
                if (content.id === tabId) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    // Lógica para cambiar tema (guardado simple en localStorage)
    themeOptionBtns.forEach(btn => {
         btn.addEventListener('click', () => {
             themeOptionBtns.forEach(b => b.classList.remove('active'));
             btn.classList.add('active');
             const theme = btn.dataset.theme;
             document.body.className = `theme-${theme}`; // Asume que tienes clases CSS como theme-dark, theme-light
             localStorage.setItem('scrakk-theme', theme);
             console.log(`Tema cambiado a ${theme}`);
             // Aquí podrías aplicar estilos más complejos si es necesario
         });
    });
    // Aplicar tema guardado al cargar
    const savedTheme = localStorage.getItem('scrakk-theme') || 'dark';
    document.body.className = `theme-${savedTheme}`;
    document.querySelector(`.theme-option-btn[data-theme="${savedTheme}"]`)?.classList.add('active');
    themeOptionBtns.forEach(b => { // Asegurar que solo uno esté activo
         if(b.dataset.theme !== savedTheme) b.classList.remove('active');
    });


    // Mostrar campo de edición inline
    async function editAccountField(field) {
        currentEditingField = field;
        editFieldError.textContent = ''; // Limpiar error
        editFieldContainer.style.display = 'block';

        try {
            const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.getUser();
            if ((!currentUser || userError) && field !== 'password') {
                console.error("Usuario no disponible para editar campo:", userError?.message);
                showNotification("Error al obtener datos de usuario", "error");
                return;
            }


            switch (field) {
                case 'full_name':
                    editFieldLabelInline.textContent = 'Nuevo nombre completo';
                    editFieldInputInline.type = 'text';
                    editFieldInputInline.value = settingsFullNameDisplay.textContent === '(No establecido)' ? '' : settingsFullNameDisplay.textContent;
                    editFieldInputInline.placeholder = 'Tu nombre y apellido';
                    break;
                case 'email':
                    editFieldLabelInline.textContent = 'Nuevo correo electrónico';
                    editFieldInputInline.type = 'email';
                    editFieldInputInline.value = settingsEmailDisplay.textContent;
                    editFieldInputInline.placeholder = 'nuevo@ejemplo.com';
                    break;
                case 'password':
                    editFieldLabelInline.textContent = 'Nueva contraseña';
                    editFieldInputInline.type = 'password';
                    editFieldInputInline.value = '';
                    editFieldInputInline.placeholder = 'Introduce tu nueva contraseña segura';
                    // Podrías añadir un campo de confirmación aquí
                    break;
                default:
                    console.warn("Campo de edición no reconocido:", field);
                    hideEditField();
                    return;
            }
            editFieldInputInline.focus();
        } catch (error) {
            console.error("Error al preparar campo de edición:", error);
            showNotification("Error al preparar el campo de edición", "error");
            hideEditField();
        }
    }

// Hide inline edit field
function hideEditField() {
    // Check if all required elements exist
    if (!editFieldContainer || !editFieldInputInline || !editFieldError) {
        console.error('Elementos de edición no encontrados');
        return;
    }
    
    // Ocultar el contenedor y limpiar los campos
    editFieldContainer.style.display = 'none';
    editFieldInputInline.value = '';
    editFieldError.textContent = '';
    currentEditingField = null;
}

// Show inline edit field
function showEditField(field, currentValue, label) {
    if (!editFieldContainer || !editFieldInputInline || !editFieldLabelInline) {
        console.error('Elementos de edición no encontrados');
        return;
    }
    
    currentEditingField = field;
    editFieldLabelInline.textContent = label;
    editFieldInputInline.value = currentValue;
    editFieldContainer.style.display = 'block';
    editFieldInputInline.focus();
}

// Initialize edit field events
function initializeEditFields() {
    if (!saveEditFieldBtn || !editFieldInputInline || !editFieldContainer || !editFieldError) {
        console.warn('Some edit field elements are missing');
        return;
    }

    // Add click event to save button
    saveEditFieldBtn.addEventListener('click', saveEditedField);
    
    // Cerrar al presionar Escape
    editFieldInputInline.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideEditField();
        if (e.key === 'Enter') saveEditFieldBtn.click();
    });

    // Add click event for cancel button if it exists
    if (cancelEditFieldBtn) {
        cancelEditFieldBtn.addEventListener('click', hideEditField);
    }
}

// Guardar campo editado inline
async function saveEditedField() {
        if (!currentEditingField) {
            console.error("No hay campo seleccionado para editar");
            return;
        }

        const newValue = editFieldInputInline.value.trim();
        if (!newValue) {
            editFieldError.textContent = "Este campo no puede estar vacío";
            return;
        }

        saveEditFieldBtn.disabled = true;
        saveEditFieldBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        editFieldError.textContent = '';

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("No se encontró sesión de usuario");

        switch (currentEditingField) {
            case 'full_name':
                const { error: nameError } = await supabaseClient
                    .from('profiles')
                    .update({ full_name: newValue })
                    .eq('id', user.id);
                
                if (nameError) throw nameError;
                
                if (settingsFullNameDisplay) {
                    settingsFullNameDisplay.textContent = newValue;
                }
                if (userNameSidebar) {
                    userNameSidebar.textContent = newValue;
                }
                showNotification("Nombre actualizado correctamente", "success");
                break;

            case 'email':
                if (!/\S+@\S+\.\S+/.test(newValue)) {
                    throw new Error("Por favor, introduce un email válido");
                }
                const { error: emailError } = await supabaseClient.auth.updateUser({
                    email: newValue
                });
                if (emailError) throw emailError;
                
                if (settingsEmailDisplay) {
                    settingsEmailDisplay.textContent = newValue;
                }
                showNotification("Email actualizado. Por favor, verifica tu nuevo correo", "success");
                break;

            case 'password':
                if (newValue.length < 6) {
                    throw new Error("La contraseña debe tener al menos 6 caracteres");
                }
                const { error: passwordError } = await supabaseClient.auth.updateUser({
                    password: newValue
                });
                if (passwordError) throw passwordError;
                
                showNotification("Contraseña actualizada correctamente", "success");
                break;

            default:
                throw new Error("Tipo de campo no reconocido");
        }

        hideEditField();

    } catch (error) {
        console.error("Error al guardar cambios:", error);
        editFieldError.textContent = error.message || "Error al guardar los cambios";
        showNotification(error.message || "Error al guardar los cambios", "error");
    } finally {
        saveEditFieldBtn.disabled = false;
        saveEditFieldBtn.innerHTML = 'Guardar';
    }
    }

    // Función para manejar el cambio de avatar
    async function handleAvatarChange(file) {
        if (!file || !file.type.startsWith('image/')) {
            showNotification("Por favor, selecciona una imagen válida", "error");
            return;
        }

        try {
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error("No se encontró sesión de usuario");

            const fileName = `avatar-${user.id}-${Date.now()}${file.name.substring(file.name.lastIndexOf('.'))}`;
            
            // Mostrar preview
            const reader = new FileReader();
            reader.onload = (e) => {
                if (settingsAvatarPreview) {
                    settingsAvatarPreview.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);

            showNotification("Subiendo imagen...", "info");

            // Subir a Supabase Storage
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('avatars')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Obtener URL pública
            const { data: { publicUrl } } = supabaseClient
                .storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Actualizar perfil con nueva URL
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Actualizar UI
            if (settingsAvatarPreview) {
                settingsAvatarPreview.src = publicUrl;
            }
            if (userAvatarSidebar) {
                userAvatarSidebar.src = publicUrl;
            }

            showNotification("Avatar actualizado correctamente", "success");

        } catch (error) {
            console.error("Error al actualizar avatar:", error);
            showNotification(error.message || "Error al actualizar avatar", "error");
            // Revertir preview
            if (settingsAvatarPreview) {
                settingsAvatarPreview.src = userAvatarSidebar?.src || 'img/default-avatar.png';
            }
        }
    }

    // Listener para cambio de avatar
    const settingsAvatarInput = document.getElementById('settingsAvatarInput');
    if (settingsAvatarInput) {
        settingsAvatarInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                handleAvatarChange(file);
            }
        });
    }

    // Listener para el botón Guardar del campo inline
    if(saveEditFieldBtn) {
         saveEditFieldBtn.addEventListener('click', saveEditedField);
    }
    // Listener para el botón Cancelar del campo inline
    if(cancelEditFieldBtn) {
         cancelEditFieldBtn.addEventListener('click', hideEditField);
    }


    // Logout desde el modal de ajustes
    document.addEventListener('DOMContentLoaded', () => {
        const logoutButtonSettings = document.getElementById('logoutButtonSettings');
        
        if (logoutButtonSettings) {
            logoutButtonSettings.addEventListener('click', async () => {
                try {
                    console.log('Iniciando proceso de logout...');
                    logoutButtonSettings.disabled = true;
                    logoutButtonSettings.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cerrando sesión...';
                    
                    const { error } = await supabaseClient.auth.signOut();
                    if (error) throw error;

                    console.log('Logout exitoso, redirigiendo...');
                    showNotification('Sesión cerrada correctamente', 'success');
                    
                    // Redirigir después de un breve delay
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);

                } catch (error) {
                    console.error('Error al cerrar sesión:', error);
                    showNotification('Error al cerrar sesión: ' + error.message, 'error');
                    logoutButtonSettings.disabled = false;
                    logoutButtonSettings.innerHTML = '<i class="fas fa-sign-out-alt"></i> Cerrar sesión';
                }
            });
            console.log('Evento de logout registrado correctamente');
        } else {
            console.error('Botón de logout no encontrado en el DOM');
        }
    });

    // Mover la carga inicial de 'home' aquí, después de cargar el perfil
    // Dentro del listener DOMContentLoaded, al final del bloque try/catch para cargar perfil:

    // Función para manejar la navegación del dashboard
    function handleNavigation(section) {
        const contentTitle = document.getElementById('contentTitle');
        const mainContentArea = document.getElementById('mainContentArea');
        
        // Actualizar botones de navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === section) {
                item.classList.add('active');
            }
        });
        
        // Cargar el contenido correspondiente
        switch (section) {
            case 'friends':
                loadFriendsSection();
                break;
            case 'home':
                contentTitle.textContent = 'Inicio';
                mainContentArea.innerHTML = '<p>Bienvenido a tu Dashboard Scrakk!</p>';
                break;
            case 'explore':
                contentTitle.textContent = 'Explorar';
                mainContentArea.innerHTML = '<p>Explora nuevos servidores y comunidades</p>';
                break;
            case 'dms':
                contentTitle.textContent = 'Mensajes Directos';
                mainContentArea.innerHTML = '<p>Tus mensajes directos aparecerán aquí</p>';
                break;
            default:
                contentTitle.textContent = 'Inicio';
                mainContentArea.innerHTML = '<p>Bienvenido a tu Dashboard Scrakk!</p>';
        }
    }

    // Configurar listeners de navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            if (section) {
                handleNavigation(section);
            }
        });
    });

    // Función para cargar contenido de la sección
    function loadSectionContent(sectionId) {
        console.log(`Cargando sección: ${sectionId}`);
        if (!mainContentArea || !contentTitle) {
            console.error("Área de contenido o título no encontrados.");
            return;
        }

        // Limpiar contenido anterior
        mainContentArea.innerHTML = ''; // Limpiar área principal

        // Cambiar título y cargar contenido según la sección
        switch (sectionId) {
            case 'home':
                contentTitle.textContent = 'Inicio';
                mainContentArea.innerHTML = `
                    <h2>Actividad Reciente</h2>
                    <p class="placeholder-text">Aquí aparecerá la actividad de tus amigos y servidores (próximamente).</p>
                    <!-- Más contenido de inicio aquí -->
                `;
                // Aquí podrías llamar a una función para cargar la actividad real
                // loadHomeActivity();
                break;
            case 'explore':
                contentTitle.textContent = 'Explorar Servidores Públicos';
                mainContentArea.innerHTML = `
                    <div class="explore-search">
                        <!-- Añadir wrapper para icono -->
                        <div class="input-with-icon">
                             <i class="fas fa-search search-icon"></i>
                             <input type="text" placeholder="Buscar servidores..." class="cyber-input">
                        </div>
                        <button class="cyber-btn primary small">Buscar</button> <!-- Añadida clase 'primary' -->
                    </div>
                    <p class="placeholder-text">Listado de servidores públicos aparecerá aquí (próximamente).</p>
                    <!-- loadPublicServers(); -->
                `;
                break;
            case 'dms': // Sección de Mensajes Directos / Amigos
                contentTitle.textContent = 'Amigos';
                // Usar la función loadFriendsSection de friends.js si está disponible
                if (typeof loadFriendsSection === 'function') {
                    loadFriendsSection();
                    // Inicializar el sistema de amigos
                    if (typeof initFriendsSystem === 'function') {
                        initFriendsSystem();
                    }
                } else {
                    // Fallback si friends.js no está cargado
                    mainContentArea.innerHTML = getFriendsSectionHTML();
                    setupFriendsSectionListeners();
                    console.warn("Sistema de amigos no disponible. Usando interfaz básica.");
                }
                break;
            default:
                contentTitle.textContent = 'Sección Desconocida';
                mainContentArea.innerHTML = `<p>Contenido para '${sectionId}' no implementado.</p>`;
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
}

// Inicializar al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});
}
}
}
