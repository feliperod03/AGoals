-- Usuario por defecto: la v1 no tiene login, todo pertenece a este usuario (id=1 en una base vacía).
INSERT INTO usuario (nombre_usuario, email, contrasena_hash)
VALUES ('yo', 'yo@agoals.local', 'sin-login-v1')
ON CONFLICT (nombre_usuario) DO NOTHING;
