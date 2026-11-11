import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'default_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  UPLOAD_MAX_FILE_SIZE: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '5242880', 10),
  /** @deprecated use AGENT_SERVICE_URL */
  PYTHON_MICROSERVICE_URL:
    process.env.PYTHON_MICROSERVICE_URL || 'http://localhost:8000/api/v1',
  AGENT_SERVICE_URL:
    process.env.AGENT_SERVICE_URL ||
    process.env.PYTHON_MICROSERVICE_URL ||
    'http://localhost:8000/api/v1',
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:8001/api/v1',
  PYTHON_SERVICE_API_KEY: process.env.PYTHON_SERVICE_API_KEY || 'internal_key',
};
