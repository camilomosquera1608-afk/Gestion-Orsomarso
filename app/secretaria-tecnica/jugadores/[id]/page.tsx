import { TechnicalPlayerDetailPage } from '@/components/secretaria-tecnica/technical-pages';
export default function Page({ params }: { params: { id: string } }) { return <TechnicalPlayerDetailPage playerId={params.id} />; }
