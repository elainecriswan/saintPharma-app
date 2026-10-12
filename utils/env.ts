import Constants from 'expo-constants';

/**
 * Helper para acessar variáveis de ambiente injetadas no build
 * As variáveis são injetadas via app.config.ts -> extra
 * e ficam disponíveis via Constants.expoConfig.extra
 * 
 * Fallback para process.env caso Constants não esteja disponível (útil durante desenvolvimento)
 */
export const getEnvVar = (key: 'apiBaseUrl' | 'apiToken' | 'clerkPublishableKey'): string => {
  // Mapear chaves do extra para variáveis de ambiente
  const envKeyMap: Record<string, string> = {
    apiBaseUrl: 'API_BASE_URL',
    apiToken: 'API_TOKEN',
    clerkPublishableKey: 'CLERK_PUBLISHABLE_KEY',
  };

  // Tentar obter de Constants.expoConfig.extra primeiro (build)
  const extra = Constants.expoConfig?.extra;
  if (extra && extra[key]) {
    const value = extra[key] as string;
    if (value && value.trim()) {
      return value.trim();
    }
  }

  // Fallback para process.env (desenvolvimento local)
  const envKey = envKeyMap[key];
  if (envKey && process.env[envKey]) {
    const value = process.env[envKey];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  console.warn(`⚠️ [getEnvVar] Variável ${key} não encontrada em Constants.expoConfig.extra nem em process.env`);
  return '';
};

/**
 * Obtém a URL base da API
 */
export const getApiBaseUrl = (): string => {
  return getEnvVar('apiBaseUrl');
};

/**
 * Obtém o token da API
 */
export const getApiToken = (): string => {
  return getEnvVar('apiToken');
};

/**
 * Obtém a chave pública do Clerk
 */
export const getClerkPublishableKey = (): string => {
  return getEnvVar('clerkPublishableKey');
};

