import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquarePlus, Send, Menu, X } from "lucide-react";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { toast } from "sonner";
import * as chatAPI from "@/services/apiChatService";

interface Message
{
    id: string;
    tipo: "usuario" | "assistente";
    conteudo: string;
    timestamp: string;
}

interface Conversa
{
    id: string;
    titulo: string;
    mensagens: Message[];
}

interface ProcessChatProps
{
    processId: string;
}

export function ProcessChat({ processId }: ProcessChatProps)
{
    const [conversas, setConversas] = useState<Conversa[]>([]);
    const [conversaAtiva, setConversaAtiva] = useState<string>("");
    const [mensagemInput, setMensagemInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const conversaAtual = conversas.find((c) => c.id === conversaAtiva);

    // Carrega as conversas do processo ao montar o componente
    useEffect(() => {
        loadConversations();
    }, [processId]);

    // Auto-scroll quando novas mensagens são adicionadas
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversaAtual?.mensagens]);

    const loadConversations = async () => {
        try {
            setLoading(true);
            const conversationsData = await chatAPI.listConversations(processId);

            const conversasFormatadas: Conversa[] = conversationsData.map(conv => ({
                id: conv.id,
                titulo: conv.title,
                mensagens: []
            }));

            setConversas(conversasFormatadas);

            // Se há conversas, seleciona a primeira e carrega suas mensagens
            if (conversasFormatadas.length > 0) {
                setConversaAtiva(conversasFormatadas[0].id);
                await loadMessages(conversasFormatadas[0].id);
            }
        } catch (error) {
            console.error("Erro ao carregar conversas:", error);
            toast.error("Erro ao carregar conversas");
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (conversationId: string) => {
        try {
            const conversationData = await chatAPI.getConversation(conversationId);

            const mensagensFormatadas: Message[] = conversationData.messages.map(msg => ({
                id: msg.id,
                tipo: msg.role === 'user' ? 'usuario' : 'assistente',
                conteudo: msg.content,
                timestamp: msg.created_at
            }));

            setConversas(prev => prev.map(conv =>
                conv.id === conversationId
                    ? { ...conv, mensagens: mensagensFormatadas }
                    : conv
            ));
        } catch (error) {
            console.error("Erro ao carregar mensagens:", error);
            toast.error("Erro ao carregar mensagens");
        }
    };

    const handleNovaConversa = async () =>
    {
        try {
            // Verifica limite de 10 conversas
            if (conversas.length >= 10) {
                toast.error("Limite de 10 conversas por processo atingido");
                return;
            }

            const novaConversa = await chatAPI.createConversation({
                processId,
                title: `Conversa ${conversas.length + 1}`
            });

            const conversaFormatada: Conversa = {
                id: novaConversa.id,
                titulo: novaConversa.title,
                mensagens: []
            };

            setConversas([...conversas, conversaFormatada]);
            setConversaAtiva(conversaFormatada.id);
            toast.success("Nova conversa criada!");
        } catch (error: any) {
            console.error("Erro ao criar conversa:", error);
            toast.error(error.message || "Erro ao criar conversa");
        }
    };

    const handleEnviarMensagem = async () =>
    {
        if (!mensagemInput.trim() || !conversaAtual || isTyping) return;

        const mensagem = mensagemInput.trim();
        setMensagemInput("");
        setIsTyping(true);

        try {
            // Adiciona mensagem do usuário imediatamente na UI
            const novaMensagemUsuario: Message = {
                id: `temp-${Date.now()}`,
                tipo: "usuario",
                conteudo: mensagem,
                timestamp: new Date().toISOString()
            };

            setConversas(prev => prev.map(conv =>
                conv.id === conversaAtiva
                    ? { ...conv, mensagens: [...conv.mensagens, novaMensagemUsuario] }
                    : conv
            ));

            // Envia para API
            const response = await chatAPI.sendMessage({
                conversationId: conversaAtiva,
                message: mensagem
            });

            // Atualiza com mensagens reais da API (usuário + assistente)
            const mensagemUsuarioReal: Message = {
                id: response.userMessage.id,
                tipo: "usuario",
                conteudo: response.userMessage.content,
                timestamp: response.userMessage.created_at
            };

            const mensagemAssistente: Message = {
                id: response.assistantMessage.id,
                tipo: "assistente",
                conteudo: response.assistantMessage.content,
                timestamp: response.assistantMessage.created_at
            };

            setConversas(prev => prev.map(conv => {
                if (conv.id === conversaAtiva) {
                    // Remove a mensagem temporária e adiciona as mensagens reais
                    const mensagensSemTemp = conv.mensagens.filter(m => !m.id.startsWith('temp-'));
                    return {
                        ...conv,
                        mensagens: [...mensagensSemTemp, mensagemUsuarioReal, mensagemAssistente]
                    };
                }
                return conv;
            }));

        } catch (error: any) {
            console.error("Erro ao enviar mensagem:", error);

            // Remove mensagem temporária em caso de erro
            setConversas(prev => prev.map(conv => {
                if (conv.id === conversaAtiva) {
                    return {
                        ...conv,
                        mensagens: conv.mensagens.filter(m => !m.id.startsWith('temp-'))
                    };
                }
                return conv;
            }));

            toast.error(error.message || "Erro ao enviar mensagem");
        } finally {
            setIsTyping(false);
        }
    };

    const handleRenomearConversa = async (id: string, novoTitulo: string) =>
    {
        try {
            await chatAPI.renameConversation(id, novoTitulo);
            setConversas(prev => prev.map(conv =>
                conv.id === id ? { ...conv, titulo: novoTitulo } : conv
            ));
            toast.success("Conversa renomeada!");
        } catch (error: any) {
            console.error("Erro ao renomear conversa:", error);
            toast.error(error.message || "Erro ao renomear conversa");
        }
    };

    const handleExcluirConversa = async (id: string) =>
    {
        try {
            await chatAPI.deleteConversation(id);
            setConversas(prev => prev.filter(conv => conv.id !== id));

            // Se a conversa excluída era a ativa, seleciona outra
            if (conversaAtiva === id) {
                const remainingConversas = conversas.filter(conv => conv.id !== id);
                if (remainingConversas.length > 0) {
                    setConversaAtiva(remainingConversas[0].id);
                    await loadMessages(remainingConversas[0].id);
                } else {
                    setConversaAtiva("");
                }
            }

            toast.success("Conversa excluída!");
        } catch (error: any) {
            console.error("Erro ao excluir conversa:", error);
            toast.error(error.message || "Erro ao excluir conversa");
        }
    };

    const handleSelecionarConversa = async (id: string) => {
        setConversaAtiva(id);

        // Carrega mensagens se ainda não foram carregadas
        const conversa = conversas.find(c => c.id === id);
        if (conversa && conversa.mensagens.length === 0) {
            await loadMessages(id);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) =>
    {
        if (e.key === "Enter" && !e.shiftKey)
        {
            e.preventDefault();
            handleEnviarMensagem();
        }
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-300px)] items-center justify-center border rounded-lg bg-card">
                <div className="text-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Carregando conversas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-300px)] border rounded-lg overflow-hidden bg-card">
            {/* Sidebar */}
            <div
                className={`${
                sidebarOpen ? "w-64" : "w-0"
                } transition-all duration-300 overflow-hidden border-r bg-primary/5`}
            >
                <ConversationSidebar
                conversas={conversas}
                conversaAtiva={conversaAtiva}
                onSelecionarConversa={handleSelecionarConversa}
                onNovaConversa={handleNovaConversa}
                onRenomearConversa={handleRenomearConversa}
                onExcluirConversa={handleExcluirConversa}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b bg-primary text-primary-foreground flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="text-primary-foreground hover:bg-primary/90"
                    >
                    {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </Button>
                    <h3 className="font-semibold">{conversaAtual?.titulo || "Chat com IA"}</h3>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNovaConversa}
                    className="text-primary-foreground hover:bg-primary/90"
                    disabled={conversas.length >= 10}
                >
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Nova Conversa {conversas.length >= 10 && "(Limite atingido)"}
                </Button>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                    {!conversaAtual || conversaAtual.mensagens.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center space-y-2">
                        <MessageSquarePlus className="h-12 w-12 mx-auto opacity-50" />
                        <p>Inicie uma conversa sobre este processo</p>
                        <p className="text-xs">Faça perguntas sobre o conteúdo analisado</p>
                        </div>
                    </div>
                    ) : (
                    conversaAtual.mensagens.map((msg) => (
                        <div
                        key={msg.id}
                        className={`flex ${msg.tipo === "usuario" ? "justify-end" : "justify-start"}`}
                        >
                        <div
                            className={`max-w-[80%] rounded-lg p-4 ${
                            msg.tipo === "usuario"
                                ? "bg-accent text-accent-foreground"
                                : "bg-primary text-primary-foreground"
                            }`}
                        >
                            <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                            <p className="text-xs opacity-70 mt-2">
                            {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                            </p>
                        </div>
                        </div>
                    ))
                    )}
                    {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-primary text-primary-foreground rounded-lg p-4 max-w-[80%]">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                        </div>
                    </div>
                    )}
                </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t bg-card">
                {!conversaAtual ? (
                    <div className="text-center text-muted-foreground text-sm">
                    Crie uma nova conversa para começar
                    </div>
                ) : (
                    <div className="flex gap-2">
                    <Textarea
                        ref={textareaRef}
                        value={mensagemInput}
                        onChange={(e) => setMensagemInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Digite sua pergunta sobre o processo..."
                        className="resize-none"
                        rows={2}
                        disabled={isTyping}
                        maxLength={5000}
                    />
                    <Button
                        onClick={handleEnviarMensagem}
                        disabled={!mensagemInput.trim() || isTyping}
                        size="icon"
                        className="h-auto"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
