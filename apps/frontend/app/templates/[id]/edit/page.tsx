'use client';

import { use } from 'react';
import TemplateEditorScreen from '@/components/templates/template-editor-screen';

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TemplateEditorScreen templateId={id} />;
}
