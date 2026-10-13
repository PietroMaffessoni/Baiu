import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Grava o CSV no cache do app e abre a folha de compartilhamento do sistema. */
export async function shareCsv(name: string, content: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível neste aparelho.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Exportar do Baiu',
  });
}
