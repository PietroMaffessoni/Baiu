import { router } from 'expo-router';

import { Welcome } from '@/components/welcome';
import { useAuth } from '@/store/auth';

/**
 * Primeiro contato. "Começar" leva ao caminho do primeiro uso, que termina no
 * cadastro; dá também para entrar na conta que já existe ou explorar os dados
 * de exemplo, a única parte do app sem conta.
 */
export default function BoasVindas() {
  const { enterDemo } = useAuth();
  return (
    <Welcome
      onStart={() => router.push('/comecar')}
      onSignIn={() => router.push('/entrar')}
      onExplore={enterDemo}
    />
  );
}
