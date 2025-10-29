import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { FileText, Plus, ArrowRight, ArrowLeft } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";

import { listProcesses, Process } from "@/services/apiProcessService";

const Processes = () =>
{
    const { user } = useUser();
    const navigate = useNavigate();

    const [processes, setProcesses] = useState<Process[]>([]);

    const [loading, setLoading] = useState(true);

    useEffect(() =>
    {
        const loadProcesses = async () =>
        {
            if (!user) return;

            try 
            {
                const userProcesses = await listProcesses(user.id.toString());
                setProcesses(userProcesses);
            } 
            catch (error: any) 
            {
                console.error("Erro ao carregar processos:", error);
                toast.error(error.message || "Erro ao carregar processos");
            } 
            finally 
            {
                setLoading(false);
            }
        };

        if (user)
        {
            loadProcesses();
        }
    }, [user]);

    useEffect(() => 
    {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => 
        {
            const hasProcessing = processes.some(p => p.status === 'processando');
            if (hasProcessing)
            {
                e.preventDefault();
                e.returnValue = 'Você tem processos em andamento. Se fechar a aba, o processamento será interrompido.';
            }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [processes]);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/apps")}>
                        <FileText className="h-6 w-6 text-accent" />
                        <span className="text-xl font-semibold">ETICS</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6">
                        <button
                            onClick={() => navigate("/apps/etics/processes")}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                            Processos
                        </button>
                        {user.role === "admin" && (
                            <button
                            onClick={() => navigate("/apps/etics/admin")}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                            Admin
                            </button>
                        )}
                    </nav>
                </div>
                <Header/>
            </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-8">
            <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate("/apps")} >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Hub
            </Button>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Processos</h1>
                    <p className="text-muted-foreground">
                    Gerencie e analise seus processos jurídicos
                    </p>
                </div>
                <Button onClick={() => navigate("/apps/etics/processes/new")} variant="accent">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Análise
                </Button>
            </div>

            {/* Process List */}
            <Card>
                <CardHeader>
                    <CardTitle>Suas Análises</CardTitle>
                    <CardDescription>
                    Lista de todos os processos analisados
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                    {loading 
                    ? 
                    (
                        <div className="text-center py-8 text-muted-foreground">
                            Carregando processos...
                        </div>
                    ) 
                    : 
                    processes.length === 0 
                    ? 
                    (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum processo encontrado. Crie sua primeira análise!
                        </div>
                    ) 
                    : 
                    (
                        processes.map((process) => (
                            <Card  key={process.id} onClick={() => navigate(`/apps/etics/processes/${process.id}`)}
                                className="cursor-pointer transition-all hover:border-accent border-l-4 border-l-accent/50 hover:border-l-accent hover:shadow-lg"                          
                            >
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                        <h3 className="font-semibold text-lg mb-2">{process.name}</h3>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <Badge variant="secondary">
                                            {process.lawyer}
                                            </Badge>
                                            {process.defendants.map((reu, index) => (
                                            <Badge key={index} className="bg-accent/10 text-accent border-accent/20">
                                                {reu}
                                            </Badge>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span>{new Date(process.createdAt).toLocaleDateString('pt-BR')}</span>
                                            <Badge 
                                            variant={process.status === "concluido" ? "default" : process.status === "erro" ? "destructive" : "secondary"}
                                            >
                                            {process.status === "concluido" ? "Concluído" : process.status === "erro" ? "Erro" : `Processando ${process.progress}%`}
                                            </Badge>
                                        </div>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-accent flex-shrink-0" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                    </div>
                </CardContent>
            </Card>
        </main>
        </div>
    );
};

export default Processes;
