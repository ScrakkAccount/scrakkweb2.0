// Verificar si Firebase está inicializado correctamente
if (typeof firebase === 'undefined') {
    console.error('Firebase no está definido. Verificar que los scripts se han cargado correctamente.');
    // Redirigir a una página de error o intentar cargar Firebase de nuevo
    window.location.href = 'error.html?error=firebase_not_loaded';
}

// Configuración de respaldo de Firebase (en caso de que no se haya inicializado)
const firebaseBackupConfig = {
    apiKey: "AIzaSyDU_8m_-1RIecI6_EnlzNKWdDH7oXpK2Eg",
    authDomain: "scrakk-944d6.firebaseapp.com",
    projectId: "scrakk-944d6",
    storageBucket: "scrakk-944d6.firebasestorage.app",
    messagingSenderId: "38697916454",
    appId: "1:38697916454:web:c328dd327a7b69a6d66ee7",
    measurementId: "G-DL0C7DFEJ4"
};

// Inicializar Firebase si aún no está inicializado
try {
    if (!firebase.apps || !firebase.apps.length) {
        console.log('Inicializando Firebase desde auth-guard...');
        firebase.initializeApp(firebaseBackupConfig);
    }
} catch (error) {
    console.error('Error al inicializar Firebase:', error);
}

// Verificar autenticación
firebase.auth().onAuthStateChanged((user) => {
    console.log('Estado de autenticación cambiado:', user ? `Usuario: ${user.uid}` : 'No hay usuario');
    
    if (!user) {
        // Si no hay usuario autenticado, redirigir al login
        window.location.href = 'login.html';
        return;
    }

    // Si hay usuario autenticado, actualizar la UI
    updateUserInterface(user);
});

// Función para actualizar la interfaz de usuario
function updateUserInterface(user) {
    console.log('Actualizando interfaz para el usuario:', user.uid);
    
    // Obtener datos adicionales del usuario desde Firestore
    firebase.firestore().collection('users').doc(user.uid)
        .get()
        .then(doc => {
            let userData = doc.exists ? doc.data() : null;
            
            const userAvatar = document.querySelector('.user-avatar img');
            const userName = document.getElementById('userName');
            const userStatus = document.getElementById('userStatus');

            if (userAvatar) {
                if (userData && userData.photoURL) {
                    userAvatar.src = userData.photoURL;
                } else if (user.photoURL) {
                    userAvatar.src = user.photoURL;
                } else {
                    userAvatar.src = 'img/default-avatar.png';
                }
                
                userAvatar.onerror = function() {
                    this.src = 'img/default-avatar.png';
                };
            }

            if (userName) {
                userName.textContent = userData ? userData.nombre : (user.displayName || user.email.split('@')[0]);
            }

            if (userStatus) {
                const status = userData ? (userData.status || 'online') : 'online';
                userStatus.innerHTML = `<span class="status-circle ${status}"></span>${getStatusText(status)}`;
            }
        })
        .catch(error => {
            console.error('Error al obtener datos del usuario:', error);
            
            // Mostrar datos básicos en caso de error
            const userAvatar = document.querySelector('.user-avatar img');
            const userName = document.getElementById('userName');
            
            if (userAvatar) {
                userAvatar.src = user.photoURL || 'img/default-avatar.png';
            }
            
            if (userName) {
                userName.textContent = user.displayName || user.email.split('@')[0];
            }
        });
}

// Función para obtener el texto del estado
function getStatusText(status) {
    switch(status) {
        case 'online': return 'En línea';
        case 'idle': return 'Ausente';
        case 'dnd': return 'No molestar';
        case 'invisible': return 'Invisible';
        default: return 'En línea';
    }
}

// Función para cerrar sesión
async function logout() {
    try {
        // Actualizar estado a offline en Firestore
        const user = firebase.auth().currentUser;
        if (user) {
            await firebase.firestore().collection('users').doc(user.uid).update({
                status: 'offline',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Cerrar sesión en Firebase
        await firebase.auth().signOut();
        
        console.log('Sesión cerrada correctamente');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

// Agregar evento al botón de cerrar sesión
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando eventos para auth-guard');
    
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
}); 