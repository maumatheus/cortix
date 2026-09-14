"use client";

import { use } from "react";
import { Editor } from "@/components/editor/editor";

export default function EditorPage({ params }: { params: Promise<{ id: string; shortId: string }> }) {
  const { id, shortId } = use(params);
  return <Editor projectId={id} shortId={shortId} />;
}
