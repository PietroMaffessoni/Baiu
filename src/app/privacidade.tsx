import { LegalPage } from '@/components/legal-page';
import legal from '@/content/legal.json';

export default function Privacidade() {
  return <LegalPage doc={legal.privacy} />;
}
