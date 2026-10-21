import { PluggyConnect } from 'react-native-pluggy-connect';

import { bankBackend } from '@/lib/bank/client';
import { FakeConnect } from './fake-connect';

export type BankWidgetProps = {
  token: string;
  sandbox: boolean;
  /** Reconectar uma conexão existente. */
  updateItem?: string;
  onSuccess: (itemId: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
};

/**
 * Widget oficial da Pluggy: a pessoa escolhe o banco e autoriza no app dele,
 * pelo Open Finance. O Baiu nunca vê a senha do banco.
 */
export function BankWidget({ token, sandbox, updateItem, onSuccess, onError, onClose }: BankWidgetProps) {
  if (bankBackend.fake) return <FakeConnect onSuccess={onSuccess} onClose={onClose} />;
  return (
    <PluggyConnect
      connectToken={token}
      includeSandbox={sandbox}
      updateItem={updateItem}
      language="pt"
      theme="dark"
      countries={['BR']}
      onSuccess={({ item }) => onSuccess(item.id)}
      onError={({ message }) => onError(message)}
      onClose={onClose}
    />
  );
}
