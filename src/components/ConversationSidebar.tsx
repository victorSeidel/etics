import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";

interface Conversa 
{
    id: string;
    titulo: string;
    mensagens: any[];
}

interface ConversationSidebarProps 
{
    conversas: Conversa[];
    conversaAtiva: string;
    onSelecionarConversa: (id: string) => void;
    onNovaConversa: () => void;
    onRenomearConversa: (id: string, novoTitulo: string) => void;
    onExcluirConversa: (id: string) => void;
}

export function ConversationSidebar({ conversas, conversaAtiva, onSelecionarConversa, onNovaConversa, onRenomearConversa, onExcluirConversa }: ConversationSidebarProps) 
{
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [novoTitulo, setNovoTitulo] = useState("");

    const handleIniciarEdicao = (conversa: Conversa) => 
    {
        setEditandoId(conversa.id);
        setNovoTitulo(conversa.titulo);
    };

    const handleSalvarEdicao = (id: string) => 
    {
        if (novoTitulo.trim()) onRenomearConversa(id, novoTitulo);
        setEditandoId(null);
    };

    const handleCancelarEdicao = () => 
    {
        setEditandoId(null);
        setNovoTitulo("");
    };

    return (
        <div className="h-full flex flex-col bg-card/50">
            <div className="p-4 border-b">
                <Button onClick={onNovaConversa} className="w-full" size="sm">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Nova Conversa
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {conversas.map((conversa) => (
                        <div
                        key={conversa.id}
                        className={`group relative rounded-md transition-colors ${
                            conversaAtiva === conversa.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                        >
                        {editandoId === conversa.id ? (
                            <div className="p-2 flex items-center gap-1">
                            <Input
                                value={novoTitulo}
                                onChange={(e) => setNovoTitulo(e.target.value)}
                                className="h-7 text-sm"
                                autoFocus
                                onKeyPress={(e) => {
                                if (e.key === "Enter") handleSalvarEdicao(conversa.id);
                                if (e.key === "Escape") handleCancelarEdicao();
                                }}
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleSalvarEdicao(conversa.id)}
                            >
                                <Check className="h-3 w-3" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={handleCancelarEdicao}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                            </div>
                        ) : (
                            <div
                            className="p-3 flex items-center justify-between cursor-pointer"
                            onClick={() => onSelecionarConversa(conversa.id)}
                            >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{conversa.titulo}</p>
                                <p className="text-xs opacity-70">
                                {conversa.mensagens.length} mensagens
                                </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleIniciarEdicao(conversa);
                                }}
                                >
                                <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onExcluirConversa(conversa.id);
                                }}
                                >
                                <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                            </div>
                        )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
