const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
});

// Rutas de autenticación
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, nombre, apellido } = req.body;

        // Crear usuario en Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${nombre} ${apellido || ''}`.trim()
        });

        // Guardar datos adicionales en Firestore
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            email,
            nombre,
            apellido,
            avatar: nombre.charAt(0).toUpperCase(),
            status: 'offline',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Generar token personalizado
        const token = await admin.auth().createCustomToken(userRecord.uid);

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            token,
            user: {
                id: userRecord.uid,
                email: userRecord.email,
                nombre,
                apellido,
                avatar: nombre.charAt(0).toUpperCase()
            }
        });
    } catch (error) {
        console.error('Error en registro:', error);
        if (error.code === 'auth/email-already-exists') {
            res.status(400).json({ error: 'El email ya está registrado' });
        } else {
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Verificar credenciales con Firebase Auth
        const userCredential = await admin.auth().getUserByEmail(email);
        
        // Obtener datos adicionales de Firestore
        const userDoc = await admin.firestore().collection('users').doc(userCredential.uid).get();
        const userData = userDoc.data();

        // Generar token personalizado
        const token = await admin.auth().createCustomToken(userCredential.uid);

        res.json({
            token,
            user: {
                id: userCredential.uid,
                email: userCredential.email,
                nombre: userData.nombre,
                apellido: userData.apellido,
                avatar: userData.avatar
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 