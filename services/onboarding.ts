import { useAuth, useUser } from "@clerk/clerk-expo";
import {
  OnboardingData,
  OnboardingResult,
  OnboardingStatus,
} from "@/types/onboarding";
import { httpClient } from "./httpClient";
import { userService } from "./userService";
import { getApiBaseUrl, getApiToken } from "@/utils/env";
import { withApiRetries } from "@/utils/apiRetry";

class OnboardingService {
  /**
   * Completa o processo de onboarding usando a API /user/complete
   */
  async completeOnboarding(data: OnboardingData): Promise<OnboardingResult> {
    try {
      const apiUrl = getApiBaseUrl();
      const apiToken = getApiToken();

      console.log(
        "🔄 [OnboardingService] Iniciando processo de onboarding...",
        {
          userId: data.user.id,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          apiUrl: apiUrl || "❌ NÃO CONFIGURADO",
          hasApiToken: !!apiToken,
        }
      );

      // Verificar se as variáveis de ambiente estão configuradas
      if (!apiUrl || !apiToken) {
        console.error(
          "❌ [OnboardingService] Variáveis de ambiente não configuradas"
        );
        console.error("❌ [OnboardingService] Crie um arquivo .env com:");
        console.error(
          "❌ [OnboardingService] API_BASE_URL=https://your-api-url.com"
        );
        console.error(
          "❌ [OnboardingService] API_TOKEN=your-api-token"
        );
        console.error(
          "❌ [OnboardingService] Ou configure via EAS Secrets para builds na nuvem."
        );

        return {
          success: false,
          error:
            "Configuração da API não encontrada. Verifique as variáveis de ambiente no arquivo .env ou EAS Secrets",
        };
      }

      // Usar o endpoint /api/user/complete conforme documentação
      httpClient.setUserId(data.user.id); // ID do Clerk

      // O webhook do Clerk pode estar atrasado ou ter falhado. Garanta o
      // registro local antes de chamar o endpoint que atualiza o perfil.
      await userService.ensureUserExists(
        data.user.id,
        data.user.email,
        data.user.firstName,
        data.user.lastName,
        data.user.imgUrl
      );

      const responseData = await withApiRetries(
        () =>
          httpClient.put("/api/user/complete", {
            firstName: data.user.firstName,
            lastName: data.user.lastName,
          }),
        undefined,
        3,
        400
      );

      console.log("✅ [OnboardingService] Onboarding concluído com sucesso:", responseData);

      // A resposta pode vir diretamente ou dentro de um objeto data
      let resultData = responseData;
      if (responseData && responseData.data) {
        resultData = responseData.data;
      } else if (responseData && responseData.user) {
        resultData = responseData.user;
      }

      return {
        success: true,
        data: resultData,
        message: "Onboarding concluído com sucesso",
      };
    } catch (error: any) {
      console.error("❌ [OnboardingService] Erro inesperado:", error);

      return {
        success: false,
        error: error.message || "Erro inesperado durante o onboarding",
      };
    }
  }

  /**
   * Verifica o status do onboarding do usuário usando /api/user
   */
  async checkOnboardingStatus(userId: string): Promise<OnboardingStatus> {
    try {
      console.log(
        "🔍 [OnboardingService] Verificando status do onboarding para:",
        userId
      );

      httpClient.setUserId(userId);

      // Usar /api/user (retorna firstName e lastName)
      const responseData = await httpClient.get("/api/user");
      
      console.log("📊 [OnboardingService] Resposta completa da API:", JSON.stringify(responseData, null, 2));
      
      // A resposta pode vir em diferentes estruturas
      // Estrutura esperada: { success: true, message: "...", user: {...} }
      let user = null;
      
      if (responseData && responseData.user) {
        // Estrutura: { user: {...} }
        user = responseData.user;
      } else if (responseData && responseData.data && responseData.data.user) {
        // Estrutura aninhada: { data: { user: {...} } }
        user = responseData.data.user;
      } else if (responseData && responseData.data) {
        // Estrutura: { data: {...} }
        user = responseData.data;
      } else if (responseData && responseData.profile) {
        // Estrutura: { profile: {...} }
        user = responseData.profile;
      } else if (responseData && (responseData.firstName || responseData.lastName || responseData.id)) {
        // Estrutura: objeto user direto
        user = responseData;
      }

      if (!user) {
        console.error("❌ [OnboardingService] Não foi possível extrair dados do usuário da resposta");
        throw new Error("Estrutura de resposta inválida da API");
      }

      console.log("📊 [OnboardingService] Objeto user extraído:", {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
      });

      // Verificar se o usuário tem nome completo (indica que completou onboarding)
      // Primeiro tentar firstName e lastName separados
      const hasFirstName = user.firstName && typeof user.firstName === 'string' && user.firstName.trim().length > 0;
      const hasLastName = user.lastName && typeof user.lastName === 'string' && user.lastName.trim().length > 0;
      
      // Fallback: verificar se tem "name" completo (caso a API retorne name ao invés de firstName/lastName)
      const hasFullName = user.name && typeof user.name === 'string' && user.name.trim().length > 0 && user.name.trim().includes(" ");
      
      // Se tiver firstName E lastName, ou se tiver name completo, considera onboarding completo
      const hasCompleteName = (hasFirstName && hasLastName) || hasFullName;

      const status: OnboardingStatus = {
        needsOnboarding: !hasCompleteName,
        userExists: true,
        storeCustomerExists: true, // Assumir que existe se o usuário existe
        hasAddress: true, // Não precisamos mais de endereço
        user: user,
      };

      console.log("✅ [OnboardingService] Status verificado:", {
        needsOnboarding: status.needsOnboarding,
        hasFirstName: hasFirstName ? user.firstName : false,
        hasLastName: hasLastName ? user.lastName : false,
        hasFullName: hasFullName ? user.name : false,
        hasCompleteName,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
        },
      });
      return status;
    } catch (error: any) {
      console.error("❌ [OnboardingService] Erro ao verificar status:", error);

      // Verificar se é erro 404 (usuário não encontrado no banco)
      const is404Error = 
        error.response?.status === 404 ||
        error.message?.includes("404") ||
        error.message?.includes("não encontrado") ||
        error.message?.includes("not found");

      if (is404Error) {
        console.log("🔍 [OnboardingService] Usuário não encontrado no banco de dados (404)");
        // Se o usuário não existe no banco, precisa completar onboarding
        // Mas só se existir no Clerk (userId foi passado)
        return {
          needsOnboarding: true,
          userExists: false,
          storeCustomerExists: false,
          hasAddress: false,
        };
      }

      // Para outros erros (rede, servidor, etc), não assumir que precisa de onboarding
      // Isso evita redirecionar usuários quando há problemas de conexão
      console.warn("⚠️ [OnboardingService] Erro inesperado ao verificar status, não assumindo onboarding necessário");
      return {
        needsOnboarding: false, // Não redirecionar em caso de erro inesperado
        userExists: false,
        storeCustomerExists: false,
        hasAddress: false,
      };
    }
  }

  /**
   * Sincroniza o usuário do Clerk com a API externa
   */
  async syncClerkUser(): Promise<OnboardingResult> {
    try {
      console.log("🔄 [OnboardingService] Sincronizando usuário do Clerk...");

      // Esta função seria chamada quando o usuário já existe no Clerk
      // mas precisa ser criado na API externa
      // Por enquanto, retornamos que precisa de onboarding manual

      return {
        success: false,
        error: "Usuário precisa completar o onboarding manual",
        message: "Complete o processo de onboarding para continuar",
      };
    } catch (error: any) {
      console.error("❌ [OnboardingService] Erro na sincronização:", error);

      return {
        success: false,
        error: error.message || "Erro na sincronização do usuário",
      };
    }
  }
}

// Instância singleton do serviço
export const onboardingService = new OnboardingService();

// Hook para usar o serviço de onboarding
export const useOnboardingService = () => {
  const { userId } = useAuth();
  const { user } = useUser();

  return {
    onboardingService,
    userId,
    user,
  };
};
