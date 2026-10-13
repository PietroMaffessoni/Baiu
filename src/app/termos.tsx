import { LegalPage } from '@/components/legal-page';
import legal from '@/content/legal.json';

export default function Termos() {
  return <LegalPage doc={legal.terms} />;
}
