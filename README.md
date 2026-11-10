# Multi-Agent AI Interview Tool - Backend Service

![Node.js](https://img.shields.io/badge/Node.js-v24.x-brightgreen)
![Express](https://img.shields.io/badge/Express-v4.x-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-indigo)

The **Multi-Agent AI Interview Tool Backend** is a modular RESTful API built to power intelligent AI-driven technical and system design interviews. It orchestrates candidate management, resume ingestion pipelines, multi-category question queueing, system design canvas diagram state storage, audio answer processing, and automated evaluation report generation.

---

## 🛠️ Tech Stack & Dependencies

- **Runtime Environment:** Node.js (ES Modules)
- **Web Framework:** Express.js
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Security & Authentication:** JWT (JSON Web Tokens), `bcryptjs`, Helmet, CORS
- **Validation:** Zod Schema Validation Middleware
- **File Uploads:** Multer (Resume & Audio files)

---

## ⚙️ Setup & Installation Instructions

### 1. Environment Configuration
Copy `.env.example` to `.env` in the root directory and update your database credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/ai_interview_db?schema=public"
JWT_SECRET="your_secret_jwt_key"
JWT_EXPIRES_IN="24h"
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
STORAGE_PROVIDER="local"
UPLOAD_MAX_FILE_SIZE=5242880
PYTHON_MICROSERVICE_URL="http://localhost:8000/api/v1"
PYTHON_SERVICE_API_KEY="internal_service_key_for_auth"

2. Install Dependencies & Set Up Database

npm install
npx prisma migrate dev --name init
npx prisma generate

3. Run Development Server

npm run dev