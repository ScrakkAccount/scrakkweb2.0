-- SQL para actualizar la estructura de la base de datos para el sistema de IDs de usuario

-- 1. Añadir campo user_id a la tabla profiles si no existe
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- 2. Crear índice para búsquedas rápidas por user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON profiles(user_id);

-- 3. Añadir campos para IDs de usuario en solicitudes de amistad
ALTER TABLE friend_requests
ADD COLUMN IF NOT EXISTS sender_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS receiver_user_id VARCHAR(255);

-- 4. Crear índices para búsquedas rápidas en friend_requests
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_user_id 
ON friend_requests(sender_user_id);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_user_id 
ON friend_requests(receiver_user_id);

-- 5. Configurar RLS (Row Level Security) para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura de perfiles a todos los usuarios autenticados
CREATE POLICY IF NOT EXISTS "Cualquiera puede ver perfiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Política para permitir que un usuario solo pueda actualizar su propio perfil
CREATE POLICY IF NOT EXISTS "Los usuarios solo pueden actualizar su propio perfil"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 6. Configurar RLS para friend_requests
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Política para permitir que un usuario solo pueda ver solicitudes donde es emisor o receptor
CREATE POLICY IF NOT EXISTS "Ver solicitudes propias"
ON friend_requests FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Política para permitir que un usuario solo pueda insertar solicitudes donde es el emisor
CREATE POLICY IF NOT EXISTS "Insertar solicitudes como emisor"
ON friend_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Política para permitir que solo el receptor pueda actualizar el estado de la solicitud
CREATE POLICY IF NOT EXISTS "Solo el receptor puede actualizar la solicitud"
ON friend_requests FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id);

-- 7. Configurar RLS para friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Política para permitir que un usuario solo pueda ver amistades donde es participante
CREATE POLICY IF NOT EXISTS "Ver amistades propias"
ON friendships FOR SELECT
TO authenticated
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Política para permitir que un usuario solo pueda insertar amistades donde es participante
CREATE POLICY IF NOT EXISTS "Insertar amistades propias"
ON friendships FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- NOTA: Este script debe ejecutarse en la consola SQL de Supabase
-- No ejecutar varias veces sin verificar primero que sea necesario
