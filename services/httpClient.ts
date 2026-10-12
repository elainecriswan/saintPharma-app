import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { getApiBaseUrl, getApiToken } from "@/utils/env";

class HttpClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = getApiBaseUrl();
    const apiToken = getApiToken();

    // Log de configuração para debug
    console.log("🔧 [HttpClient] Inicializando com configuração:", {
      baseURL: baseURL || "❌ NÃO CONFIGURADO",
      hasToken: !!apiToken,
      tokenLength: apiToken?.length || 0,
    });

    // Validar se a variável de ambiente está configurada
    if (!baseURL) {
      const errorMessage =
        "❌ [HttpClient] API_BASE_URL não está configurada!\n" +
        "Crie um arquivo .env na raiz do projeto com:\n" +
        "API_BASE_URL=http://localhost:3000/api\n" +
        "API_TOKEN=seu-token-aqui\n\n" +
        "Ou configure via EAS Secrets para builds na nuvem.";

      console.error(errorMessage);
    }

    this.client = axios.create({
      baseURL: baseURL || "", // Permite criar instância mesmo sem baseURL para validação posterior
      timeout: 30000, // 30 segundos
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Interceptor para adicionar token de autenticação em todas as requisições
    this.client.interceptors.request.use(
      (config) => {
        // Validar se baseURL está configurada
        const baseURL = getApiBaseUrl();
        if (!baseURL) {
          throw new Error(
            "URL base da API não configurada. Verifique as variáveis de ambiente no arquivo .env ou EAS Secrets"
          );
        }

        const token = getApiToken();

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          console.warn("⚠️ [HttpClient] Token de API não configurado");
        }

        // Log da requisição (apenas em desenvolvimento)
        if (__DEV__) {
          const loggedHeaders = { ...config.headers };
          if (loggedHeaders.Authorization) {
            loggedHeaders.Authorization = "[REDACTED]";
          }
          console.log(
            `🚀 [HttpClient] ${config.method?.toUpperCase()} ${config.url}`,
            {
              headers: loggedHeaders,
              data: config.data,
            }
          );
        }

        return config;
      },
      (error) => {
        console.error("❌ [HttpClient] Erro no interceptor de request:", error);
        return Promise.reject(error);
      }
    );

    // Interceptor para tratar respostas
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log da resposta (apenas em desenvolvimento)
        if (__DEV__) {
          console.log(
            `✅ [HttpClient] ${response.status} ${response.config.url}`,
            {
              data: response.data,
            }
          );
        }

        return response;
      },
      (error) => {
        // Log do erro
        console.error("❌ [HttpClient] Erro na resposta:", {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });

        // Traduzir mensagens de erro
        const translatedError = this.translateErrorMessage(error);

        // Preserve HTTP metadata so callers can distinguish 404, 409, 5xx and
        // network failures when applying bounded retries or recovery logic.
        Object.assign(translatedError, {
          response: error.response,
          status: error.response?.status,
          code: error.code,
        });
        return Promise.reject(translatedError);
      }
    );
  }

  private translateErrorMessage(error: any): Error {
    const errorTranslations: Record<string, string> = {
      "Header X-User-Id é obrigatório":
        "Erro de autenticação. Faça login novamente.",
      "lectureCMSid é obrigatório":
        "Dados da aula não encontrados. Tente novamente.",
      "Usuário não encontrado": "Usuário não encontrado. Verifique sua conta.",
      "Lecture não encontrada":
        "Aula não encontrada. Verifique se ela ainda está disponível.",
      "Quiz não encontrado para esta lecture":
        "Esta aula não possui questionário disponível.",
      "Network Error":
        "Erro de conexão. Verifique sua internet e tente novamente.",
    };

    let errorMessage = error.message || "Erro inesperado";

    // Verificar se é erro de resposta da API
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    // Verificar se existe tradução específica
    if (errorTranslations[errorMessage]) {
      errorMessage = errorTranslations[errorMessage];
    } else {
      // Verificar se a mensagem contém alguma das chaves conhecidas
      for (const [key, translation] of Object.entries(errorTranslations)) {
        if (errorMessage.includes(key)) {
          errorMessage = translation;
          break;
        }
      }
    }

    // Traduzir erros HTTP genéricos
    if (error.response?.status) {
      const status = error.response.status;
      if (status === 400) {
        errorMessage =
          "Dados inválidos. Verifique as informações e tente novamente.";
      } else if (status === 401) {
        errorMessage = "Acesso negado. Faça login novamente.";
      } else if (status === 403) {
        errorMessage = "Você não tem permissão para realizar esta ação.";
      } else if (status === 404) {
        errorMessage = "Conteúdo não encontrado.";
      } else if (status === 500) {
        errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
      }
    }

    return new Error(errorMessage);
  }

  // Métodos HTTP
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    console.log(`🌐 [HttpClient.get] Iniciando requisição GET para: ${url}`);
    console.log(
      `🌐 [HttpClient.get] BaseURL configurada: ${
        this.client.defaults.baseURL || "NÃO CONFIGURADA"
      }`
    );

    try {
      const response = await this.client.get<T>(url, config);
      console.log(
        `✅ [HttpClient.get] Requisição concluída com sucesso para: ${url}`
      );
      return response.data;
    } catch (error: any) {
      console.error(`❌ [HttpClient.get] Erro na requisição GET para: ${url}`, {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        config: {
          baseURL: this.client.defaults.baseURL,
          url: error.config?.url,
          fullUrl: error.config?.baseURL + error.config?.url,
        },
      });
      throw error;
    }
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // Método para adicionar header X-User-Id
  setUserId(userId: string) {
    this.client.defaults.headers.common["X-User-Id"] = userId;
  }

  // Método para remover header X-User-Id
  clearUserId() {
    delete this.client.defaults.headers.common["X-User-Id"];
  }

  // Método para obter o cliente Axios (para casos específicos)
  getClient(): AxiosInstance {
    return this.client;
  }
}

// Instância singleton do cliente HTTP
export const httpClient = new HttpClient();
