# Back_to_Back
Managing login from fastify app to another fastify app

Arquitectura del Sistema

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLIENTE       │    │   AUTH BACKEND  │    │   IAM BACKEND   │
│   React SPA     │───▶│   (Sesiones)    │───▶│   (Usuarios)    │
│   Puerto: 5357  │    │   Puerto: 3002  │    │   Puerto: 3001  │
└─────────────────┘    └─────────────────┘    └─────────────────┘

1. 🏪 IAM Backend - Gestión de Usuarios y Refresh Tokens

Proyecto: iam-backend
Descripción: Servicio core de gestión de identidades y autenticación primaria.

2. 🔐 Auth Backend - Gestión de Sesiones y JWT

Proyecto: auth-backend
Descripción: Servicio de autenticación que consume IAM y gestiona sesiones.

3. ⚛️ React Frontend - Cliente Web

Proyecto: client-test
Descripción: Aplicación React con gestión automática de tokens.

🚀 Instalación y Configuración
📋 Prerrequisitos

    Node.js 18+ y npm

    MySQL 8.0+

    Git

1. 🏪 IAM BACKEND - Instalación

cd iam-backend
npm install

Configurar Variables de Entorno

Crear archivo .env:

# Database
DATABASE_URL="mysql://root:tu_password@localhost:3306/iam_test"

# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# JWT
JWT_SECRET="a5f8c3e9b2d7f1a4c6e8b0d2f5a9c3e7b1d4f8a2c6e9b0d3f7a1c5e8b2d4f6a9"
JWT_REFRESH_EXPIRY="7d"
BCRYPT_SALT_ROUNDS=10

# Crear base de datos
mysql -u root -p -e "CREATE DATABASE iam_test;"

# Ejecutar migraciones
npx prisma generate
npx prisma db push

# Opcional: Poblar con datos de prueba
npx prisma db seed

# Desarrollo
npm run dev

# Producción
npm run build
npm start

Verificar: http://localhost:3001/health

2. 🔐 AUTH BACKEND - Instalación

cd auth-backend
npm install

Crear archivo .env:

# Database
DATABASE_URL="mysql://root:tu_password@localhost:3306/auth_test"

# Server
PORT=3002
HOST=0.0.0.0
NODE_ENV=development

# IAM Backend Connection
FIRST_APP_URL="http://localhost:3001/api/v1"

# JWT
JWT_SECRET="a5f8c3e9b2d7f1a4c6e8b0d2f5a9c3e7b1d4f8a2c6e9b0d3f7a1c5e8b2d4f6a9"
JWT_ACCESS_EXPIRY="5m"
JWT_ISSUER="auth-service"

# Cookie settings
COOKIE_SECRET="tu_cookie_secret_aqui"


# Crear base de datos
mysql -u root -p -e "CREATE DATABASE auth_test;"

# Ejecutar migraciones
npx prisma generate
npx prisma db push

# Desarrollo
npm run dev

# Producción
npm run build
npm start

Verificar: http://localhost:3002/health


3. ⚛️ REACT FRONTEND - Instalación

cd client-test
npm install

Crear archivo .env:

VITE_AUTH_API_URL="http://localhost:3002/api/v1"

# Desarrollo
npm run dev

# Producción
npm run build
npm run preview

Verificar: http://localhost:5357

