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
import { AnalysisViewer } from "@/components/AnalysisViewer";

import { getProcess, getProcessStatus, retryProcess, Process } from "@/services/apiProcessService";
import { generateAnalysis, getProcessAnalyses, getAnalysisAvailability, Analysis, AnalysisAvailability } from "@/services/apiAnalysisService";

export default function ProcessView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useUser();

    const [process, setProcess] = useState<Process | null>(null);

    const [isEditingName, setIsEditingName] = useState(false);

    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);

    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [analysisAvailability, setAnalysisAvailability] = useState<AnalysisAvailability | null>(null);
    const [generatingAnalysis, setGeneratingAnalysis] = useState(false);

    const [focusAdvogado, setFocusAdvogado] = useState<string>('');
    const [focusReu, setFocusReu] = useState<string>('');

    const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const loadProcess = async () => {
            if ((!id || !user.id) && user.role !== "admin") return;

            try {
                const processData = await getProcess(id);
                if (Number(processData.userId) !== Number(user.id)) { navigate("/apps/etics/processes"); return; }
                setProcess(processData);
            }
            catch (error: any) {
                console.error("Erro ao carregar processo:", error);
                toast.error(error.message || "Processo não encontrado");
                navigate("/apps/etics/processes");
            }
            finally {
                setLoading(false);
            }
        };

        loadProcess();
    }, [navigate, id, user]);

    useEffect(() => {
        const loadAnalyses = async () => {
            if (!id || !user) return;

            try {
                const [analysesData, availabilityData] = await Promise.all([getProcessAnalyses(id, user.id.toString()), getAnalysisAvailability(id)]);

                setAnalyses(analysesData);
                setAnalysisAvailability(availabilityData);
            }
            catch (error: any) {
                console.error("Erro ao carregar análises:", error);
            }
        };

        if (process && process.status === 'concluido') loadAnalyses();
    }, [id, user, process?.status]);

    useEffect(() => {
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

                    if (statusData.status === 'concluido' || statusData.status === 'erro') clearInterval(intervalId);
                }
                catch (error) {
                    console.error("Erro ao fazer polling:", error);
                }
            }, 2000);

            return () => clearInterval(intervalId);
        }
    }, [id, process?.status]);

    // Polling para verificar status das análises em geração
    useEffect(() => {
        if (!id || !user) return;

        const hasGeneratingAnalysis = analyses.some(a => a.status === 'gerando');

        if (hasGeneratingAnalysis) {
            const intervalId = setInterval(async () => {
                try {
                    const [analysesData, availabilityData] = await Promise.all([
                        getProcessAnalyses(id, user.id.toString()),
                        getAnalysisAvailability(id)
                    ]);

                    setAnalyses(analysesData);
                    setAnalysisAvailability(availabilityData);
                } catch (error) {
                    console.error("Erro ao atualizar status das análises:", error);
                }
            }, 3000);

            return () => clearInterval(intervalId);
        }
    }, [id, user, analyses]);

    const handleRetry = async () => {
        if (!id) return;

        setRetrying(true);
        try {
            await retryProcess(id);
            toast.success("Processo adicionado para reprocessamento!");

            const processData = await getProcess(id);
            setProcess(processData);
        }
        catch (error: any) {
            console.error("Erro ao reprocessar:", error);
            toast.error(error.message || "Erro ao reprocessar processo");
        }
        finally {
            setRetrying(false);
        }
    };

    const handleGenerateAnalysis = async (type: 'geral' | 'focada') => {
        if (!id || !user) return;

        if (type === 'focada' && !focusAdvogado && !focusReu) {
            toast.error('Por favor, selecione pelo menos um advogado ou réu para a análise focada');
            return;
        }

        setGeneratingAnalysis(true);

        try {
            toast.success('Gerando análise... Você será notificado por e-mail ao término do processo.');
            window.location.reload();

            await generateAnalysis({
                processId: id,
                userId: user.id.toString(),
                type,
                focusAdvogado: type === 'focada' && focusAdvogado ? focusAdvogado : undefined,
                focusReu: type === 'focada' && focusReu ? focusReu : undefined
            });

            const [analysesData, availabilityData] = await Promise.all([
                getProcessAnalyses(id, user.id.toString()),
                getAnalysisAvailability(id)
            ]);

            setAnalyses(analysesData);
            setAnalysisAvailability(availabilityData);

        }
        catch (error: any) {
            console.error("Erro ao gerar análise:", error);
            toast.error(error.message || "Erro ao gerar análise");
        }
        finally {
            setGeneratingAnalysis(false);
        }
    };

    const toggleAnalysis = (id: string) => {
        setExpandedAnalyses(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> =
        {
            concluido: { variant: "default", label: "Concluído" },
            processando: { variant: "secondary", label: "Processando" },
            erro: { variant: "destructive", label: "Erro" }
        };

        const config = variants[status] || variants.concluido;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    if (loading || !process) {
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
            <Header />

            {/* Process Info */}
            <div className="border-b bg-primary text-primary-foreground">
                <div className="container mx-auto px-4 py-6">
                    <div className="space-y-4">
                        <Button variant="ghost" onClick={() => navigate("/apps/analise-de-processos/processes")}
                            className="text-primary-foreground hover:bg-primary/90" >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                        </Button>

                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                {isEditingName
                                    ?
                                    (
                                        <Input
                                            value={process.name}
                                            onChange={(e) => setProcess({ ...process, name: e.target.value })}
                                            onBlur={() => setIsEditingName(false)}
                                            className="text-2xl font-bold"
                                            autoFocus
                                        />
                                    )
                                    :
                                    (
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
                                <span>Advogado:</span>
                                <Badge variant="secondary">{process.lawyer}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>Réus:</span>
                                {process.defendants.map((reu, idx) => (
                                    <Badge key={idx} className="bg-accent/10 text-accent border-accent/20">{reu}</Badge>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <span>Data:</span>
                                <span>{new Date(process.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {process.pdfs && process.pdfs.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span>PDFs:</span>
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
                        {process.status === 'processando' || process.status === 'aguardando'
                            ?
                            (
                                <Card className="p-8 text-center">
                                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-accent" />
                                    <h3 className="text-lg font-semibold mb-2">Processamento em andamento</h3>
                                    <p className="text-muted-foreground mb-4">
                                        {process.processedPdfs} de {process.totalPdfs} PDFs processados
                                    </p>
                                    <div className="max-w-md mx-auto mb-8">
                                        <div className="text-sm text-muted-foreground mb-2">{process.progress}%</div>
                                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${process.progress}%` }} />
                                        </div>
                                    </div>
                                    <p>
                                        Você pode sair dessa janela se necessário. Você será avisado por email quando o processamento finalizar.
                                    </p>
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
                                            <p>
                                                Você já pode fazer a análise do processo ou conversar no chat.
                                            </p>
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
                                (
                                    <Card className="p-6">
                                        <div className="flex flex-col justify-center items-center gap-3">
                                            <Loader2 className="h-8 w-8 text-accent animate-spin" />
                                            <h3 className="text-lg font-semibold">Processamento dos PDFs em andamento...</h3>
                                        </div>
                                    </Card>
                                )}
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
                                                disabled={generatingAnalysis || analyses.some(a => a.type === 'geral' && a.status === 'gerando')}
                                                className="gap-2"
                                            >
                                                {generatingAnalysis || analyses.some(a => a.type === 'geral' && a.status === 'gerando') ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        {analyses.find(a => a.type === 'geral' && a.status === 'gerando')?.statusMessage || 'Processando...'}
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
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-sm font-medium">Análise Geral</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(analyses.find(a => a.type === 'geral')!.createdAt).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            <AnalysisViewer content={analyses.find(a => a.type === 'geral')!.content || ''} />
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
                                                disabled={generatingAnalysis || (!focusAdvogado && !focusReu) ||
                                                    (focusAdvogado === "none") && (focusReu === "none") ||
                                                    analyses.some(a => a.type === 'focada' && a.status === 'gerando')}
                                                className="gap-2"
                                            >
                                                {generatingAnalysis || analyses.some(a => a.type === 'focada' && a.status === 'gerando') ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        {analyses.find(a => a.type === 'focada' && a.status === 'gerando')?.statusMessage || 'Processando...'}
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
                                        Análise detalhada com foco específico em advogado e/ou réu, incluindo todas as menções e evidências relacionadas.
                                    </p>

                                    {analysisAvailability?.focada.available && (
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="space-y-2">
                                                <Label>Selecionar Advogado</Label>
                                                <Select value={focusAdvogado} onValueChange={setFocusAdvogado}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Escolha um advogado (opcional)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Nenhum</SelectItem>
                                                        {process.lawyer && (
                                                            <SelectItem value={process.lawyer}>{process.lawyer}</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Selecionar Réu</Label>
                                                <Select value={focusReu} onValueChange={setFocusReu}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Escolha um réu (opcional)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Nenhum</SelectItem>
                                                        {process.defendants && process.defendants.map((reu, idx) => (
                                                            <SelectItem key={idx} value={reu}>{reu}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {analyses.find(a => a.type === 'focada') && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">Análise Focada</span>
                                                    {analyses.find(a => a.type === 'focada')!.focusAdvogado && (
                                                        <Badge variant="outline" className="text-xs">
                                                            Advogado: {analyses.find(a => a.type === 'focada')!.focusAdvogado}
                                                        </Badge>
                                                    )}
                                                    {analyses.find(a => a.type === 'focada')!.focusReu && (
                                                        <Badge variant="outline" className="text-xs">
                                                            Réu: {analyses.find(a => a.type === 'focada')!.focusReu}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(analyses.find(a => a.type === 'focada')!.createdAt).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            <AnalysisViewer content={analyses.find(a => a.type === 'focada')!.content || ''} />
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
