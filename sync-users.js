// Script para sincronizar usuarios del localStorage con users.json
// Este script debe ejecutarse en la consola del navegador

function syncUsers() {
    // Obtener usuarios del localStorage
    const localStorageUsers = JSON.parse(localStorage.getItem('users')) || [];
    
    // Obtener usuarios del archivo users.json
    fetch('users.json')
        .then(response => response.json())
        .then(data => {
            const jsonUsers = data.users;
            
            // Combinar usuarios, evitando duplicados por email
            const combinedUsers = [...jsonUsers];
            
            localStorageUsers.forEach(localUser => {
                const existingUser = combinedUsers.find(u => u.email === localUser.email);
                if (!existingUser) {
                    combinedUsers.push(localUser);
                }
            });
            
            // Mostrar los usuarios combinados
            console.log('Usuarios combinados:', combinedUsers);
            
            // Actualizar localStorage con los usuarios combinados
            localStorage.setItem('users', JSON.stringify(combinedUsers));
            
            console.log('Sincronización completada. Usuarios actualizados en localStorage.');
        })
        .catch(error => {
            console.error('Error al sincronizar usuarios:', error);
        });
}

// Ejecutar la sincronización
syncUsers(); 