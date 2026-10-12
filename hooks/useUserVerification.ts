import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { userService } from "@/services/userService";

const VERIFICATION_DELAY = 10000; // 10 segundos
const POLL_INTERVAL = 1000; // Verificar a cada 1 segundo
const MAX_ATTEMPTS = 10; // Máximo de 10 tentativas (10 segundos)

export function useUserVerification() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);

  const verifyUserExists = async (clerkId: string): Promise<boolean> => {
    try {
      await userService.getUser(clerkId);
      return true;
    } catch (error) {
      return false;
    }
  };

  const cleanupAndRedirect = useCallback(
    async (clerkId: string) => {
      try {
        console.log(
          "❌ [useUserVerification] Usuário não encontrado após 10 segundos"
        );
        console.log(
          "🔄 [useUserVerification] Fazendo logout e redirecionando para página inicial"
        );

        // Fazer logout do Clerk
        await signOut();

        // Redirecionar para página inicial (sign-in)
        router.replace("/sign-in" as any);
      } catch (error) {
        console.error(
          "❌ [useUserVerification] Erro ao limpar sessão:",
          error
        );
        // Mesmo com erro, redirecionar
        router.replace("/sign-in" as any);
      } finally {
        setIsVerifying(false);
      }
    },
    [signOut, router]
  );

  const startVerification = useCallback(async () => {
    if (!user?.id) {
      console.warn("⚠️ [useUserVerification] Nenhum usuário encontrado");
      return;
    }

    setIsVerifying(true);
    attemptsRef.current = 0;

    console.log(
      `🔄 [useUserVerification] Iniciando verificação para usuário: ${user.id}`
    );
    console.log(
      `⏳ [useUserVerification] Aguardando ${VERIFICATION_DELAY / 1000} segundos antes de verificar...`
    );

    // Aguardar 10 segundos antes de começar a verificar
    timeoutRef.current = setTimeout(async () => {
      console.log(
        "🔍 [useUserVerification] Iniciando verificações periódicas..."
      );

      // Verificar periodicamente se o usuário existe
      intervalRef.current = setInterval(async () => {
        attemptsRef.current++;

        console.log(
          `🔍 [useUserVerification] Tentativa ${attemptsRef.current}/${MAX_ATTEMPTS}`
        );

        const exists = await verifyUserExists(user.id);

        if (exists) {
          console.log(
            "✅ [useUserVerification] Usuário encontrado no banco de dados!"
          );
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setIsVerifying(false);
          return;
        }

        // Se atingiu o máximo de tentativas e ainda não encontrou
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          await cleanupAndRedirect(user.id);
        }
      }, POLL_INTERVAL);
    }, VERIFICATION_DELAY);
  }, [user?.id, cleanupAndRedirect]);

  const stopVerification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsVerifying(false);
    attemptsRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      stopVerification();
    };
  }, [stopVerification]);

  return {
    startVerification,
    stopVerification,
    isVerifying,
  };
}

