import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

import { FileText, Upload, ArrowLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";

import { createProcess, uploadPdfs } from "@/services/apiProcessService";

const NewProcess = () =>
{
    const { user, setUser } = useUser();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [processName, setProcessName] = useState("");
    const [lawyer, setLawyer] = useState("");
    const [defendants, setDefendants] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    {
        if (e.target.files && e.target.files.length > 0)
        {
            const selectedFiles = Array.from(e.target.files);
            const pdfFiles = selectedFiles.filter(file => file.type === "application/pdf");

            if (pdfFiles.length !== selectedFiles.length)
            {
                toast({
                    title: "Atenção",
                    description: "Apenas arquivos PDF foram adicionados. Outros formatos foram ignorados.",
                    variant: "destructive"
                });
            }

            if (pdfFiles.length > 0)
            {
                setFiles(prevFiles => [...prevFiles, ...pdfFiles]);
                toast({
                    title: "Arquivos adicionados",
                    description: `${pdfFiles.length} arquivo(s) PDF adicionado(s).`
                });
            }
        }
    };

    const removeFile = (index: number) => 
    {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
        toast({
            title: "Arquivo removido",
            description: "O arquivo foi removido da lista."
        });
    };

    const formatFileSize = (bytes: number): string => 
    {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const handleSubmit = async (e: React.FormEvent) =>
    {
        e.preventDefault();

        if (files.length === 0)
        {
            toast({
                title: "Erro",
                description: "Por favor, faça o upload de pelo menos um arquivo PDF.",
                variant: "destructive"
            });
            return;
        }

        if (user.credits <= 0)
        {
            toast({ title: "Créditos insuficientes", description: `Você precisa de 1 crédito.`, variant: "destructive" });
            return;
        }

        setIsUploading(true);

        try
        {
            // Cria o processo no backend
            const process = await createProcess({
                userId: user.id.toString(),
                name: processName,
                lawyer,
                defendants: defendants.split(',').map(d => d.trim()).filter(d => d)
            });

            toast({
                title: "Processo criado!",
                description: "Fazendo upload dos PDFs..."
            });

            // Upload dos PDFs
            await uploadPdfs(process.id, files);

            // Atualiza créditos do usuário
            const updatedUser = { ...user, credits: user.credits - 1 };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);

            toast({
                title: "Upload concluído!",
                description: `${files.length} PDF(s) adicionado(s) à fila de processamento. Redirecionando...`
            });

            // Redireciona para a visualização do processo
            setTimeout(() => {
                navigate(`/apps/etics/processes/${process.id}`);
            }, 1500);

        }
        catch (error: any)
        {
            console.error(error);
            toast({
                title: "Erro",
                description: error.message || "Falha ao criar processo e fazer upload",
                variant: "destructive"
            });
        }
        finally
        {
            setIsUploading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/apps/etics/dashboard")}>
                    <FileText className="h-6 w-6 text-accent" />
                    <span className="text-xl font-semibold">ETICS</span>
                    </div>
                </div>
                <Header/>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8 max-w-3xl">
                <Button
                variant="ghost"
                className="mb-6 gap-2"
                onClick={() => navigate("/apps/etics/processes")}
                >
                <ArrowLeft className="h-4 w-4" />
                Voltar aos Processos
                </Button>

                <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Nova Análise de Processo</h1>
                <p className="text-muted-foreground">
                    Preencha os dados e faça upload de um ou mais PDFs para análise
                </p>
                </div>

                <Card>
                <CardHeader>
                    <CardTitle>Informações do Processo</CardTitle>
                    <CardDescription>
                    Este processo custará 1 crédito. Você possui {user.credits} créditos disponíveis.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="processName">Nome do Processo *</Label>
                        <Input
                        id="processName"
                        placeholder="Ex: Processo 123456-78.2024"
                        value={processName}
                        onChange={(e) => setProcessName(e.target.value)}
                        required
                        disabled={isUploading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="lawyer">Advogado *</Label>
                        <Input
                        id="lawyer"
                        placeholder="Nome do advogado"
                        value={lawyer}
                        onChange={(e) => setLawyer(e.target.value)}
                        required
                        disabled={isUploading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="defendants">Réu(s) *</Label>
                        <Input
                        id="defendants"
                        placeholder="Nome dos réus (separados por vírgula)"
                        value={defendants}
                        onChange={(e) => setDefendants(e.target.value)}
                        required
                        disabled={isUploading}
                        />
                        <p className="text-xs text-muted-foreground">
                        Para múltiplos réus, separe os nomes por vírgula
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="files">Documentos PDF *</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/50 transition-colors">
                        <input
                            id="files"
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            multiple
                            className="hidden"
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="files"
                            className={`cursor-pointer flex flex-col items-center gap-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <div className="text-sm">
                            <span className="text-accent font-medium">Clique para fazer upload</span>
                            <span className="text-muted-foreground"> ou arraste os arquivos</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                            Múltiplos PDFs até 1GB cada
                            </p>
                        </label>
                        </div>

                        {files.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between">
                            <Label className="text-sm">Arquivos selecionados ({files.length})</Label>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-muted p-2 rounded gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 flex-shrink-0"
                                    onClick={() => removeFile(index)}
                                    disabled={isUploading}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                </div>
                            ))}
                            </div>
                        </div>
                        )}
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate("/apps/etics/processes")}
                        disabled={isUploading}
                        >
                        Cancelar
                        </Button>
                        <Button
                        type="submit"
                        className="flex-1"
                        variant="accent"
                        disabled={isUploading || files.length === 0}
                        >
                        {isUploading ? "Enviando..." : "Iniciar Análise"}
                        </Button>
                    </div>
                    </form>
                </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default NewProcess;
