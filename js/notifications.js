// Sistema de Notificaciones Mejorado
class NotificationSystem {
    constructor() {
        this.notificationQueue = [];
        this.isShowing = false;
        this.setupNotificationContainer();
        this.notificationSound = new Audio();
        this.notificationSound.volume = 0.5;
        this.sounds = {
            success: 'https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3',
            error: 'https://notificationsounds.com/storage/sounds/file-sounds-1149-unsure.mp3',
            warning: 'https://notificationsounds.com/storage/sounds/file-sounds-1074-piece-of-cake.mp3',
            info: 'https://notificationsounds.com/storage/sounds/file-sounds-1085-accomplished.mp3',
            friendRequest: 'https://notificationsounds.com/storage/sounds/file-sounds-1120-intuition.mp3'
        };
    }

    setupNotificationContainer() {
        // Crear contenedor de notificaciones si no existe
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
    }

    showNotification(type, message, duration = 5000) {
        const notification = this.createNotification(type, message);
        this.notificationQueue.push({ notification, duration });
        
        if (!this.isShowing) {
            this.processQueue();
        }
    }

    createNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getIconForType(type);
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        
        notification.appendChild(icon);
        notification.appendChild(messageSpan);
        
        return notification;
    }

    getIconForType(type) {
        const icon = document.createElement('i');
        icon.className = 'fas';
        
        switch(type) {
            case 'success':
                icon.classList.add('fa-check-circle');
                break;
            case 'error':
                icon.classList.add('fa-exclamation-circle');
                break;
            case 'warning':
                icon.classList.add('fa-exclamation-triangle');
                break;
            case 'info':
                icon.classList.add('fa-info-circle');
                break;
            case 'friend':
                icon.classList.add('fa-user-plus');
                break;
            default:
                icon.classList.add('fa-bell');
        }
        
        return icon;
    }

    processQueue() {
        if (this.notificationQueue.length === 0) {
            this.isShowing = false;
            return;
        }

        this.isShowing = true;
        const { notification, duration } = this.notificationQueue.shift();
        
        document.getElementById('notification-container').appendChild(notification);
        
        // Forzar reflow para que la animación funcione
        notification.offsetHeight;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
                this.processQueue();
            }, 300);
        }, duration);
    }

    showFloatingNotification(title, message, avatarUrl, actionText, actionCallback) {
        const notification = document.createElement('div');
        notification.className = 'floating-notification';
        
        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = avatarUrl;
        avatar.alt = 'Avatar';
        
        const content = document.createElement('div');
        content.className = 'content';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'title';
        titleElement.textContent = title;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.textContent = message;
        
        content.appendChild(titleElement);
        content.appendChild(messageElement);
        
        const action = document.createElement('div');
        action.className = 'action';
        action.textContent = actionText;
        action.addEventListener('click', () => {
            if (actionCallback) actionCallback();
            notification.remove();
        });
        
        notification.appendChild(avatar);
        notification.appendChild(content);
        notification.appendChild(action);
        
        document.body.appendChild(notification);
        
        // Forzar reflow para que la animación funcione
        notification.offsetHeight;
        notification.classList.add('show');
        
        // Cerrar automáticamente después de 10 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 10000);
    }

    // Reproducir sonido
    playSound(type) {
        if (!window.Audio) return;
        
        const soundURL = this.sounds[type] || this.sounds.info;
        this.notificationSound.src = soundURL;
        this.notificationSound.play().catch(e => {
            console.warn('No se pudo reproducir el sonido:', e);
        });
    }
}

// Exportar la clase para uso global
window.NotificationSystem = NotificationSystem;

// Inicializar el sistema de notificaciones
document.addEventListener('DOMContentLoaded', () => {
    window.notifications = new NotificationSystem();
});

// Función global para mostrar notificaciones estándar
window.showNotification = (type, message, duration) => {
    window.notifications.showNotification(type, message, duration);
};

// Función global para mostrar notificaciones flotantes
window.showFloatingNotification = (title, message, avatarUrl, actionText, actionCallback) => {
    window.notifications.showFloatingNotification(title, message, avatarUrl, actionText, actionCallback);
};

// Función global para reproducir sonidos de notificaciones
window.playNotificationSound = (type) => {
    if (window.notifications) {
        window.notifications.playSound(type);
    }
}; 