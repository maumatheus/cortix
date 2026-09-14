"use client";

import { useRef, useState } from "react";
import { ChevronRight, Copy, FolderPlus, Globe, Library, Lock, MessageSquareText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { cn, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/components/shared/platform";
import { FileCard, type LibraryFileItem } from "@/components/library/file-card";
import { PromptDialog, type LibraryPromptItem } from "@/components/library/prompt-dialog";

export default function LibraryPage() {
  const [tab, setTab] = useState("files");
  const [folder, setFolder] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<LibraryPromptItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const files = useFetch<{ data: LibraryFileItem[]; usage: { bytes: number; count: number } }>(`/api/v1/library/files?scope=mine&folder=${encodeURIComponent(folder)}`);
  const pubFiles = useFetch<{ data: LibraryFileItem[] }>("/api/v1/library/files?scope=public");
  const prompts = useFetch<{ data: LibraryPromptItem[] }>("/api/v1/library/prompts?scope=mine");
  const pubPrompts = useFetch<{ data: LibraryPromptItem[] }>("/api/v1/library/prompts?scope=public");

  const crumbs = folder ? folder.split("/") : [];

  async function createFolder() {
    if (!folderName.trim()) return;
    try {
      await api("/api/v1/library/folders", { method: "POST", json: { name: folderName.trim(), folder } });
      toast.success("Pasta criada");
      setFolderOpen(false);
      setFolderName("");
      files.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        if (f.size > 500 * 1024 * 1024) {
          toast.error(`${f.name}: máximo 500MB`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", f);
        fd.append("folder", folder);
        await api("/api/v1/library/files", { method: "POST", body: fd });
      }
      toast.success(list.length > 1 ? `${list.length} arquivos enviados` : "Arquivo enviado");
      files.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeFile(f: LibraryFileItem) {
    if (!confirm(f.mime === "folder" ? `Excluir a pasta "${f.name}" e tudo dentro dela?` : `Excluir "${f.name}"?`)) return;
    try {
      await api(`/api/v1/library/files/${f.id}`, { method: "DELETE" });
      toast.success("Excluído");
      files.reload();
      pubFiles.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleFilePublic(f: LibraryFileItem) {
    try {
      await api(`/api/v1/library/files/${f.id}`, { method: "PATCH", json: { isPublic: !f.isPublic } });
      files.reload();
      pubFiles.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removePrompt(p: LibraryPromptItem) {
    if (!confirm(`Excluir o prompt "${p.title}"?`)) return;
    try {
      await api(`/api/v1/library/prompts/${p.id}`, { method: "DELETE" });
      prompts.reload();
      pubPrompts.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function togglePromptPublic(p: LibraryPromptItem) {
    try {
      await api(`/api/v1/library/prompts/${p.id}`, { method: "PATCH", json: { isPublic: !p.isPublic } });
      prompts.reload();
      pubPrompts.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Prompt copiado"));
  }

  const isPromptTab = tab === "prompts" || tab === "public-prompts";

  return (
    <Page wide>
      <PageHeader
        eyebrow="Capturar · Acervo"
        dot
        title="Biblioteca"
        description="Guarde arquivos e prompts pra reutilizar em qualquer projeto."
        actions={
          isPromptTab ? (
            <Button
              onClick={() => {
                setEditingPrompt(null);
                setPromptOpen(true);
              }}
            >
              <Plus /> Novo prompt
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setFolderOpen(true)}>
                <FolderPlus /> Nova pasta
              </Button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
              <Button onClick={() => fileRef.current?.click()} loading={uploading}>
                <Upload /> Enviar arquivo
              </Button>
            </>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="files">Meus arquivos</TabsTrigger>
          <TabsTrigger value="prompts">Meus prompts</TabsTrigger>
          <TabsTrigger value="public-files">Arquivos públicos</TabsTrigger>
          <TabsTrigger value="public-prompts">Prompts públicos</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <button className={cn("rounded-md px-2 py-1 hover:bg-secondary", !folder && "font-semibold")} onClick={() => setFolder("")}>
              Biblioteca
            </button>
            {crumbs.map((c, i) => {
              const path = crumbs.slice(0, i + 1).join("/");
              return (
                <span key={path} className="flex items-center gap-2">
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                  <button className={cn("rounded-md px-2 py-1 hover:bg-secondary", i === crumbs.length - 1 && "font-semibold")} onClick={() => setFolder(path)}>
                    {c}
                  </button>
                </span>
              );
            })}
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {files.data ? `${files.data.usage.count} itens · ${formatBytes(files.data.usage.bytes)}` : ""}
            </span>
          </div>
          {files.loading && !files.data ? (
            <Grid>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}</Grid>
          ) : (files.data?.data.length ?? 0) === 0 ? (
            folder ? (
              <EmptyState icon={<Library />} title="Pasta vazia" description="Envie um arquivo ou crie uma subpasta aqui." action={<Button onClick={() => fileRef.current?.click()}><Upload /> Enviar arquivo</Button>} />
            ) : (
              <EmptyState
                icon={<Library />}
                title="Sua biblioteca está vazia"
                description="Envie seu primeiro arquivo ou crie uma pasta pra organizar."
                action={
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setFolderOpen(true)}>
                      <FolderPlus /> Nova pasta
                    </Button>
                    <Button onClick={() => fileRef.current?.click()}>
                      <Upload /> Enviar arquivo
                    </Button>
                  </div>
                }
              />
            )
          ) : (
            <Grid>
              {files.data!.data.map((f) => (
                <FileCard key={f.id} f={f} onOpenFolder={() => setFolder(folder ? `${folder}/${f.name}` : f.name)} onTogglePublic={() => toggleFilePublic(f)} onDelete={() => removeFile(f)} />
              ))}
            </Grid>
          )}
        </TabsContent>

        <TabsContent value="public-files">
          {pubFiles.loading && !pubFiles.data ? (
            <Grid>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}</Grid>
          ) : (pubFiles.data?.data.length ?? 0) === 0 ? (
            <EmptyState icon={<Globe />} title="Nenhum arquivo público ainda" description="Marque um arquivo seu como público pra compartilhar com a comunidade." />
          ) : (
            <Grid>
              {pubFiles.data!.data.map((f) => (
                <FileCard key={f.id} f={f} onTogglePublic={f.isMine ? () => toggleFilePublic(f) : undefined} onDelete={f.isMine ? () => removeFile(f) : undefined} />
              ))}
            </Grid>
          )}
        </TabsContent>

        <TabsContent value="prompts">
          {prompts.loading && !prompts.data ? (
            <PromptGrid>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</PromptGrid>
          ) : (prompts.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              icon={<MessageSquareText />}
              title="Nenhum prompt salvo"
              description="Salve instruções pra IA e reaproveite em projetos e monitoramentos de lives."
              action={
                <Button
                  onClick={() => {
                    setEditingPrompt(null);
                    setPromptOpen(true);
                  }}
                >
                  <Plus /> Novo prompt
                </Button>
              }
            />
          ) : (
            <PromptGrid>
              {prompts.data!.data.map((p) => (
                <PromptCard
                  key={p.id}
                  p={p}
                  onCopy={() => copy(p.content)}
                  onEdit={() => {
                    setEditingPrompt(p);
                    setPromptOpen(true);
                  }}
                  onDelete={() => removePrompt(p)}
                  onTogglePublic={() => togglePromptPublic(p)}
                />
              ))}
            </PromptGrid>
          )}
        </TabsContent>

        <TabsContent value="public-prompts">
          {pubPrompts.loading && !pubPrompts.data ? (
            <PromptGrid>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</PromptGrid>
          ) : (pubPrompts.data?.data.length ?? 0) === 0 ? (
            <EmptyState icon={<Globe />} title="Nenhum prompt público ainda" description="Compartilhe um prompt seu pra ajudar outros criadores." />
          ) : (
            <PromptGrid>
              {pubPrompts.data!.data.map((p) => (
                <PromptCard key={p.id} p={p} onCopy={() => copy(p.content)} onEdit={p.isMine ? () => { setEditingPrompt(p); setPromptOpen(true); } : undefined} onDelete={p.isMine ? () => removePrompt(p) : undefined} onTogglePublic={p.isMine ? () => togglePromptPublic(p) : undefined} />
              ))}
            </PromptGrid>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>{folder ? `Dentro de "${folder}"` : "Na raiz da biblioteca"}</DialogDescription>
          </DialogHeader>
          <Label>Nome da pasta</Label>
          <Input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Ex: Hooks, B-rolls, Logos…" className="mt-1" onKeyDown={(e) => e.key === "Enter" && createFolder()} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFolderOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createFolder} disabled={!folderName.trim()}>
              Criar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromptDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        prompt={editingPrompt}
        onSaved={() => {
          prompts.reload();
          pubPrompts.reload();
        }}
      />
    </Page>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}
function PromptGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function PromptCard({ p, onCopy, onEdit, onDelete, onTogglePublic }: { p: LibraryPromptItem; onCopy: () => void; onEdit?: () => void; onDelete?: () => void; onTogglePublic?: () => void }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{p.title}</p>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase", p.isPublic ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")}>{p.isPublic ? "Público" : "Privado"}</span>
      </div>
      <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-xs text-muted-foreground">{p.content}</p>
      <div className="mt-auto flex items-center justify-between pt-3 text-[10px] text-muted-foreground">
        <span>{p.isMine ? `há ${timeAgo(p.createdAt)}` : `por ${p.author}`}</span>
        <span className="font-mono">{p.content.length} caracteres</span>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onCopy}>
          <Copy /> Copiar
        </Button>
        {onTogglePublic ? (
          <button className="rounded-md border p-1.5 hover:bg-secondary" title={p.isPublic ? "Tornar privado" : "Tornar público"} onClick={onTogglePublic}>
            {p.isPublic ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
          </button>
        ) : null}
        {onEdit ? (
          <button className="rounded-md border p-1.5 hover:bg-secondary" title="Editar" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </button>
        ) : null}
        {onDelete ? (
          <button className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10" title="Excluir" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
