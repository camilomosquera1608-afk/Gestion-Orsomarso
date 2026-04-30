'use client';

import { useParams } from 'next/navigation';
import { parseWellnessCategory, WellnessPublicForm } from '@/components/wellness-public-form';

export default function CategoryWellnessPage() {
  const params = useParams<{ category: string }>();
  const category = parseWellnessCategory(params.category);
  return <WellnessPublicForm forcedCategory={category} />;
}
