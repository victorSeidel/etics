import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { ArrowLeft, MessagesSquare, Loader2, AlertCircle, CheckCircleIcon, TrendingUp, RefreshCw, Sparkles, User } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { ProcessChat } from "@/components/ProcessChat";

import { getProcess, getProcessStatus, retryProcess, Process } from "@/services/apiProcessService";
import { generateAnalysis, getProcessAnalyses, getAnalysisAvailability, Analysis, AnalysisAvailability } from "@/services/apiAnalysisService";

export default function ProcessView()
{
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useUser();

    const [process, setProcess] = useState<Process | null>(null);

    const [isEditingName, setIsEditingName] = useState(false);

    const [loading, setLoading] = useState(true);

    const [retrying, setRetrying] = useState(false);

    // Estados para análises
    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [analysisAvailability, setAnalysisAvailability] = useState<AnalysisAvailability | null>(null);
    const [generatingAnalysis, setGeneratingAnalysis] = useState(false);

    // Estados para análise focada
    const [focusType, setFocusType] = useState<'advogado' | 'reu'>('advogado');
    const [focusTarget, setFocusTarget] = useState<string>('');

    const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({});

    // Carrega os dados do processo
    useEffect(() =>
    {
        const loadProcess = async () =>
        {
            if (!id) return;

            try {
                const processData = await getProcess(id);
                setProcess(processData);
            } catch (error: any) {
                console.error("Erro ao carregar processo:", error);
                toast.error(error.message || "Processo não encontrado");
                navigate("/apps/etics/processes");
            } finally {
                setLoading(false);
            }
        };

        loadProcess();
    }, [navigate, id]);

    // Carrega análises e disponibilidade
    useEffect(() => {
        const loadAnalyses = async () => {
            if (!id || !user) return;

            try {
                const [analysesData, availabilityData] = await Promise.all([
                    getProcessAnalyses(id, user.id.toString()),
                    getAnalysisAvailability(id)
                ]);

                setAnalyses(analysesData);
                setAnalysisAvailability(availabilityData);
            } catch (error: any) {
                console.error("Erro ao carregar análises:", error);
            }
        };

        if (process && process.status === 'concluido') {
            loadAnalyses();
        }
    }, [id, user, process?.status]);

    useEffect(() =>
    {
        if (!id || !process) return;

        if (process.status === 'processando') {
            const intervalId = setInterval(async () => {
                try {
                    const statusData = await getProcessStatus(id);

                    setProcess(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            status: statusData.status as any,
                            progress: statusData.progress,
                            processedPdfs: statusData.processedPdfs,
                            totalPdfs: statusData.totalPdfs,
                            pdfs: statusData.pdfs
                        };
                    });

                    // Para o polling se completou ou deu erro
                    if (statusData.status === 'concluido' || statusData.status === 'erro') {
                        clearInterval(intervalId);
                    }
                } catch (error) {
                    console.error("Erro ao fazer polling:", error);
                }
            }, 2000);

            return () => clearInterval(intervalId);
        }
    }, [id, process?.status]);

    const handleRetry = async () =>
    {
        if (!id) return;

        setRetrying(true);
        try {
            await retryProcess(id);
            toast.success("Processo adicionado para reprocessamento!");

            // Recarrega o processo
            const processData = await getProcess(id);
            setProcess(processData);
        } catch (error: any) {
            console.error("Erro ao reprocessar:", error);
            toast.error(error.message || "Erro ao reprocessar processo");
        } finally {
            setRetrying(false);
        }
    };

    const handleGenerateAnalysis = async (type: 'geral' | 'focada') => {
        if (!id || !user) return;

        if (type === 'focada' && !focusTarget) {
            toast.error('Por favor, selecione um advogado ou réu para a análise focada');
            return;
        }

        setGeneratingAnalysis(true);
        try {
            await generateAnalysis({
                processId: id,
                userId: user.id.toString(),
                type,
                focusTarget: type === 'focada' ? focusTarget : undefined,
                focusType: type === 'focada' ? focusType : undefined
            });

            toast.success('Análise gerada com sucesso!');

            // Recarregar análises
            const [analysesData, availabilityData] = await Promise.all([
                getProcessAnalyses(id, user.id.toString()),
                getAnalysisAvailability(id)
            ]);

            setAnalyses(analysesData);
            setAnalysisAvailability(availabilityData);

        } catch (error: any) {
            console.error("Erro ao gerar análise:", error);
            toast.error(error.message || "Erro ao gerar análise");
        } finally {
            setGeneratingAnalysis(false);
        }
    };

    const toggleAnalysis = (id: string) => {
        setExpandedAnalyses(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const getStatusBadge = (status: string) =>
    {
        const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> =
        {
            concluido: { variant: "default", label: "Concluído" },
            processando: { variant: "secondary", label: "Processando" },
            erro: { variant: "destructive", label: "Erro" }
        };

        const config = variants[status] || variants.concluido;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    if (loading || !process) 
    {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-accent" />
                    <p className="text-muted-foreground">Carregando processo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-primary text-primary-foreground">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => navigate("/apps/etics/processes")}
                        className="text-primary-foreground hover:bg-primary/90"
                        >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                    
                    <Header/>
                </div>
            </div>
        </header>

        {/* Process Info */}
        <div className="border-b bg-card">
            <div className="container mx-auto px-4 py-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                <div className="flex-1">
                    {isEditingName ? (
                    <Input
                        value={process.name}
                        onChange={(e) => setProcess({ ...process, name: e.target.value })}
                        onBlur={() => setIsEditingName(false)}
                        className="text-2xl font-bold"
                        autoFocus
                    />
                    ) : (
                    <h1
                        className="text-2xl font-bold cursor-pointer hover:text-primary"
                        onClick={() => setIsEditingName(true)}
                    >
                        {process.name}
                    </h1>
                    )}
                </div>
                {getStatusBadge(process.status)}
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Advogado:</span>
                    <Badge variant="secondary">{process.lawyer}</Badge>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Réus:</span>
                    {process.defendants.map((reu, idx) => (
                    <Badge key={idx} className="bg-accent/10 text-accent border-accent/20">{reu}</Badge>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Data:</span>
                    <span>{new Date(process.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                {process.pdfs && process.pdfs.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">PDFs:</span>
                        <span className="text-sm">{process.pdfs.length} arquivo(s)</span>
                    </div>
                )}
                </div>
            </div>
            </div>
        </div>

        {/* Tabs Content */}
        <div className="container mx-auto px-4 py-6">
            <Tabs defaultValue="texto" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="texto">
                        <CheckCircleIcon className="mr-2 h-4 w-4" />
                        Resultado
                    </TabsTrigger>
                    <TabsTrigger value="analise">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Análises
                    </TabsTrigger>
                    <TabsTrigger value="chat">
                        <MessagesSquare className="mr-2 h-4 w-4" />
                        Chat
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="texto" className="mt-6 space-y-6">
                    {process.status === 'processando'
                    ?
                    (
                        <Card className="p-8 text-center">
                            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-accent" />
                            <h3 className="text-lg font-semibold mb-2">Processamento em andamento</h3>
                            <p className="text-muted-foreground mb-4">
                                {process.processedPdfs} de {process.totalPdfs} PDFs processados
                            </p>
                            <div className="max-w-md mx-auto">
                                <div className="text-sm text-muted-foreground mb-2">{process.progress}%</div>
                                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-accent transition-all duration-300" style={{ width: `${process.progress}%` }} />
                                </div>
                            </div>
                        </Card>
                    )
                    :
                    process.status === 'erro'
                    ?
                    (
                        <Card className="p-8 text-center">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                            <h3 className="text-lg font-semibold mb-2">Erro no processamento</h3>
                            <p className="text-muted-foreground mb-4">{process.errorMessage || 'Ocorreu um erro ao processar os PDFs'}</p>
                            <Button
                                onClick={handleRetry}
                                disabled={retrying}
                                variant="default"
                                className="mt-4"
                            >
                                {retrying ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Reprocessando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Tentar Novamente
                                    </>
                                )}
                            </Button>
                        </Card>
                    )
                    :
                    (
                        <Card className="p-6">
                            <div className="flex flex-col justify-center items-center gap-3">
                                <CheckCircleIcon className="h-8 w-8 text-accent" />
                                <h3 className="text-lg font-semibold">Processamento concluído com sucesso</h3>
                            </div>
                        </Card>
                    )}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">PDFs do Processo</h3>

                        {process.pdfs && process.pdfs.length > 0 
                        ? 
                        (
                            <div className="space-y-4">
                                {process.pdfs.map((pdf) => (
                                    <Card key={pdf.id} className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium mb-2">{pdf.filename}</h4>
                                                <div className="flex gap-4 text-sm text-muted-foreground">
                                                    <span>{Number(pdf.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                                    <span>{pdf.pageCount} páginas</span>
                                                    <Badge variant={pdf.status === "concluido" ? "default" : pdf.status === "erro" ? "destructive" : "secondary"}>
                                                        {pdf.status === "concluido" ? "Concluído" : pdf.status === "erro" ? "Erro" : "Processando"}
                                                    </Badge>
                                                </div>
                                                {pdf.status === 'processando' && (
                                                    <div className="mt-2">
                                                        <div className="text-xs text-muted-foreground mb-1">
                                                            Progresso: {pdf.progress}% (Página {pdf.currentPage} de {pdf.pageCount})
                                                        </div>
                                                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                                            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pdf.progress}%` }} />
                                                        </div>
                                                    </div>
                                                )}
                                                {pdf.errorMessage && (
                                                    <p className="text-sm text-destructive mt-2">{pdf.errorMessage}</p>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) 
                        : 
                        ( <p className="text-muted-foreground text-center py-8">Nenhum PDF anexado a este processo</p> )}
                    </Card>
                </TabsContent>

                <TabsContent value="analise" className="mt-6">
                    {process.status !== 'concluido' ? (
                        <Card className="p-8 text-center">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">Processo ainda não concluído</h3>
                            <p className="text-muted-foreground">
                                As análises só estarão disponíveis após o processamento completo dos PDFs
                            </p>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* Análise Geral */}
                            <Card className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        <h3 className="text-lg font-semibold">Análise Geral</h3>
                                    </div>
                                    {analysisAvailability?.geral.available ? (
                                        <Button
                                            onClick={() => handleGenerateAnalysis('geral')}
                                            disabled={generatingAnalysis}
                                            className="gap-2"
                                        >
                                            {generatingAnalysis ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Gerando...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-4 w-4" />
                                                    Gerar Análise Geral
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        <Badge variant="secondary">Já utilizada</Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Análise abrangente de todos os documentos do processo, incluindo principais pontos, argumentos e conclusões.
                                </p>

                                {analyses.find(a => a.type === 'geral') && (
                                    <div className="mt-4 p-4 bg-muted rounded-lg">
                                        <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => toggleAnalysis('geral')}>
                                            <span className="text-sm font-medium">Análise Geral</span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(analyses.find(a => a.type === 'geral')!.createdAt).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                        {expandedAnalyses['geral'] ? (
                                            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm mt-2">
                                                {analyses.find(a => a.type === 'geral')!.content}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground mt-2 line-clamp-4">
                                                {analyses.find(a => a.type === 'geral')!.content}
                                            </p>
                                        )}
                                        <Button variant="link" size="sm" className="mt-2" onClick={() => toggleAnalysis('geral')}>
                                            {expandedAnalyses['geral'] ? 'Recolher' : 'Expandir'}
                                        </Button>
                                    </div>
                                )}
                            </Card>

                            {/* Análise Focada */}
                            <Card className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <User className="h-5 w-5 text-accent" />
                                        <h3 className="text-lg font-semibold">Análise Focada</h3>
                                    </div>
                                    {analysisAvailability?.focada.available ? (
                                        <Button
                                            onClick={() => handleGenerateAnalysis('focada')}
                                            disabled={generatingAnalysis || !focusTarget}
                                            className="gap-2"
                                        >
                                            {generatingAnalysis ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Gerando...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-4 w-4" />
                                                    Gerar Análise Focada
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        <Badge variant="secondary">Já utilizada</Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Análise detalhada com foco específico em um advogado ou réu, incluindo todas as menções e evidências relacionadas.
                                </p>

                                {analysisAvailability?.focada.available && (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <Label>Tipo de Foco</Label>
                                            <Select value={focusType} onValueChange={(value: 'advogado' | 'reu') => setFocusType(value)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="advogado">Advogado</SelectItem>
                                                    <SelectItem value="reu">Réu</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Selecionar {focusType === 'advogado' ? 'Advogado' : 'Réu'}</Label>
                                            <Select value={focusTarget} onValueChange={setFocusTarget}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={`Escolha um ${focusType}`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {focusType === 'advogado' && process.lawyer && (
                                                        <SelectItem value={process.lawyer}>{process.lawyer}</SelectItem>
                                                    )}
                                                    {focusType === 'reu' && process.defendants && process.defendants.map((reu, idx) => (
                                                        <SelectItem key={idx} value={reu}>{reu}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {analyses.find(a => a.type === 'focada') && (
                                    <div className="mt-4 p-4 bg-muted rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">Análise Focada</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {analyses.find(a => a.type === 'focada')!.focusType === 'advogado' ? 'Advogado' : 'Réu'}: {analyses.find(a => a.type === 'focada')!.focusTarget}
                                                </Badge>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(analyses.find(a => a.type === 'focada')!.createdAt).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                                            {analyses.find(a => a.type === 'focada')!.content}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="chat" className="mt-6">
                    {process.status !== 'concluido' ? (
                        <Card className="p-8 text-center">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">Processo ainda não concluído</h3>
                            <p className="text-muted-foreground">
                                O chat só estará disponível após o processamento completo dos PDFs
                            </p>
                        </Card>
                    ) : (
                        <ProcessChat processId={id!} />
                    )}
                </TabsContent>
            </Tabs>
        </div>
        </div>
    );
}
