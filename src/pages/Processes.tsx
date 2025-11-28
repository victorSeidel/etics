import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { Plus, ArrowRight, ArrowLeft, Star, Archive, Tag as TagIcon, X, Filter, Calendar } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

import { listProcesses, Process, toggleArchive, toggleFavorite, getTags, createTag, addTagToProcess, removeTagFromProcess, Tag } from "@/services/apiProcessService";

const Processes = () => {
    const { user } = useUser();
    const navigate = useNavigate();

    const [processes, setProcesses] = useState<Process[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [filter, setFilter] = useState<'all' | 'favorites' | 'archived'>('all');

    // Date and tag filters
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter processes based on selected filter, date range, and tags
    const filteredProcesses = processes.filter(p => {
        // Base filter (all, favorites, archived)
        if (filter === 'favorites' && !p.isFavorite) return false;
        if (filter === 'archived' && !p.isArchived) return false;
        if (filter === 'all' && p.isArchived) return false;

        // Date range filter
        if (startDate) {
            const processDate = new Date(p.createdAt);
            const filterStartDate = new Date(startDate);
            if (processDate < filterStartDate) return false;
        }
        if (endDate) {
            const processDate = new Date(p.createdAt);
            const filterEndDate = new Date(endDate);
            filterEndDate.setHours(23, 59, 59, 999); // Include the entire end date
            if (processDate > filterEndDate) return false;
        }

        // Tag filter (process must have ALL selected tags)
        if (selectedTagIds.length > 0) {
            const processTags = p.tags?.map(t => t.id) || [];
            const hasAllTags = selectedTagIds.every(tagId => processTags.includes(tagId));
            if (!hasAllTags) return false;
        }

        return true;
    });

    const totalPages = Math.ceil(filteredProcesses.length / itemsPerPage);
    const currentProcesses = filteredProcesses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const [loading, setLoading] = useState(true);

    // Tag creation state
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#3b82f6');
    const [isCreatingTag, setIsCreatingTag] = useState(false);

    // Clear all filters
    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedTagIds([]);
    };

    // Toggle tag selection for filtering
    const toggleTagFilter = (tagId: string) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    useEffect(() => {
        const loadProcesses = async () => {
            if (!user) return;

            try {
                const userProcesses = await listProcesses(user.id.toString());
                setProcesses(userProcesses);
            }
            catch (error: any) {
                console.error("Erro ao carregar processos:", error);
                toast.error(error.message || "Erro ao carregar processos");
            }
            finally {
                setLoading(false);
            }
        };

        if (user) {
            loadProcesses();
        }
    }, [user]);

    useEffect(() => {
        const loadTags = async () => {
            if (!user) return;

            try {
                const userTags = await getTags(user.id.toString());


                setTags(userTags);
            } catch (error: any) {
                console.error("Erro ao carregar tags:", error);
            }
        };

        if (user) {
            loadTags();
        }
    }, [user]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const hasProcessing = processes.some(p => p.status === 'processando');
            if (hasProcessing) {
                e.preventDefault();
                e.returnValue = 'Você tem processos em andamento. Se fechar a aba, o processamento será interrompido.';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [processes]);

    const handleToggleArchive = async (processId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await toggleArchive(processId);
            setProcesses(prev => prev.map(p =>
                p.id === processId ? { ...p, isArchived: result.isArchived } : p
            ));
            toast.success(result.isArchived ? 'Processo arquivado' : 'Processo desarquivado');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao arquivar processo');
        }
    };

    const handleToggleFavorite = async (processId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await toggleFavorite(processId);
            setProcesses(prev => prev.map(p =>
                p.id === processId ? { ...p, isFavorite: result.isFavorite } : p
            ));
            toast.success(result.isFavorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao favoritar processo');
        }
    };

    const handleCreateTag = async () => {
        if (!user || !newTagName.trim()) return;

        setIsCreatingTag(true);
        try {
            const tag = await createTag(user.id.toString(), newTagName.trim(), newTagColor);
            setTags(prev => [...prev, tag]);
            setNewTagName('');
            setNewTagColor('#3b82f6');
            toast.success('Tag criada com sucesso');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao criar tag');
        } finally {
            setIsCreatingTag(false);
        }
    };

    const handleAddTag = async (processId: string, tagId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await addTagToProcess(processId, tagId);
            const tag = tags.find(t => t.id === tagId);
            if (tag) {
                setProcesses(prev => prev.map(p =>
                    p.id === processId ? { ...p, tags: [...(p.tags || []), tag] } : p
                ));
                toast.success('Tag adicionada');
            }
        } catch (error: any) {
            toast.error(error.message || 'Erro ao adicionar tag');
        }
    };

    const handleRemoveTag = async (processId: string, tagId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await removeTagFromProcess(processId, tagId);
            setProcesses(prev => prev.map(p =>
                p.id === processId ? { ...p, tags: (p.tags || []).filter(t => t.id !== tagId) } : p
            ));
            toast.success('Tag removida');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao remover tag');
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
            <Header />

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
                    <Button onClick={() => navigate("/apps/analise-de-processos/processes/new")} variant="accent">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Análise
                    </Button>
                </div>

                {/* Process List */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Suas Análises</CardTitle>
                                <CardDescription>
                                    Lista de todos os processos analisados
                                </CardDescription>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <TagIcon className="h-4 w-4 mr-2" />
                                        Gerenciar Tags
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                    <div className="space-y-4">
                                        <h4 className="font-semibold">Criar Nova Tag</h4>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Nome da tag"
                                                value={newTagName}
                                                onChange={(e) => setNewTagName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                                            />
                                            <Input
                                                type="color"
                                                value={newTagColor}
                                                onChange={(e) => setNewTagColor(e.target.value)}
                                                className="w-20"
                                            />
                                            <Button onClick={handleCreateTag} disabled={isCreatingTag || !newTagName.trim()}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-sm">Tags Existentes</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {tags.map(tag => (
                                                    <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#fff' }}>
                                                        {tag.name}
                                                    </Badge>
                                                ))}
                                                {tags.length === 0 && (
                                                    <p className="text-sm text-muted-foreground">Nenhuma tag criada</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2 mt-4">
                            <Button
                                variant={filter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('all')}
                            >
                                Todos
                            </Button>
                            <Button
                                variant={filter === 'favorites' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('favorites')}
                            >
                                <Star className="h-4 w-4 mr-1" />
                                Favoritos
                            </Button>
                            <Button
                                variant={filter === 'archived' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('archived')}
                            >
                                <Archive className="h-4 w-4 mr-1" />
                                Arquivados
                            </Button>
                        </div>

                        {/* Advanced Filters */}
                        <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                                {(startDate || endDate || selectedTagIds.length > 0) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="text-xs"
                                    >
                                        Limpar Filtros
                                    </Button>
                                )}
                            </div>

                            {/* Date Range Filter */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Data Inicial
                                    </label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Data Final
                                    </label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="text-sm"
                                    />
                                </div>
                            </div>

                            {/* Tag Filter */}
                            {tags.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium flex items-center gap-1">
                                        <TagIcon className="h-3 w-3" />
                                        Filtrar por Tags
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <Badge
                                                key={tag.id}
                                                style={{
                                                    backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'transparent',
                                                    color: selectedTagIds.includes(tag.id) ? '#fff' : tag.color,
                                                    borderColor: tag.color,
                                                    borderWidth: '2px'
                                                }}
                                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => toggleTagFilter(tag.id)}
                                            >
                                                {tag.name}
                                                {selectedTagIds.includes(tag.id) && (
                                                    <X className="h-3 w-3 ml-1" />
                                                )}
                                            </Badge>
                                        ))}
                                    </div>
                                    {selectedTagIds.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Mostrando processos com {selectedTagIds.length === 1 ? 'a tag selecionada' : 'todas as tags selecionadas'}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Active Filters Summary */}
                            {(startDate || endDate || selectedTagIds.length > 0) && (
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">
                                        {filteredProcesses.length} processo(s) encontrado(s) com os filtros aplicados
                                    </p>
                                </div>
                            )}
                        </div>
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
                                        currentProcesses.map((process) => (
                                            <Card key={process.id} onClick={() => navigate(`/apps/analise-de-processos/processes/${process.id}`)}
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

                                                            {/* Tags Display */}
                                                            {process.tags && process.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mb-3">
                                                                    {process.tags.map(tag => (
                                                                        <Badge
                                                                            key={tag.id}
                                                                            style={{ backgroundColor: tag.color, color: '#fff' }}
                                                                            className="flex items-center gap-1"
                                                                        >
                                                                            {tag.name}
                                                                            <X
                                                                                className="h-3 w-3 cursor-pointer hover:opacity-70"
                                                                                onClick={(e) => handleRemoveTag(process.id, tag.id, e)}
                                                                            />
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                <span>{new Date(process.createdAt).toLocaleDateString('pt-BR')}</span>
                                                                <Badge variant={process.status === "concluido" ? "default" : process.status === "erro" ? "destructive" : "secondary"}>
                                                                    {process.status === "concluido" ? "Concluído" : process.status === "erro" ? "Erro" : `Processando ${process.progress}%`}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        {/* Action Icons */}
                                                        <div className="flex flex-col gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={(e) => handleToggleFavorite(process.id, e)}
                                                            >
                                                                <Star
                                                                    className={`h-4 w-4 ${process.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
                                                                />
                                                            </Button>

                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={(e) => handleToggleArchive(process.id, e)}
                                                            >
                                                                <Archive
                                                                    className={`h-4 w-4 ${process.isArchived ? 'fill-blue-400' : ''}`} />
                                                            </Button>

                                                            <Popover>
                                                                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                    >
                                                                        <TagIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-60" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="space-y-2">
                                                                        <h4 className="font-semibold text-sm">Adicionar Tag</h4>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {tags.filter(tag => !process.tags?.some(pt => pt.id === tag.id)).map(tag => (
                                                                                <Badge
                                                                                    key={tag.id}
                                                                                    style={{ backgroundColor: tag.color, color: '#fff' }}
                                                                                    className="cursor-pointer hover:opacity-80"
                                                                                    onClick={(e) => handleAddTag(process.id, tag.id, e)}
                                                                                >
                                                                                    {tag.name}
                                                                                </Badge>
                                                                            ))}
                                                                            {tags.filter(tag => !process.tags?.some(pt => pt.id === tag.id)).length === 0 && (
                                                                                <p className="text-sm text-muted-foreground">Todas as tags já foram adicionadas</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>

                                                            <ArrowRight className="h-5 w-5 text-accent flex-shrink-0 mt-auto" />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                        </div>

                        {processes.length > 0 && (
                            <div className="flex items-center justify-between pt-6">
                                <Button variant="secondary" disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} >
                                    <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
                                </Button>

                                <span className="text-sm text-muted-foreground">
                                    Página {currentPage} de {totalPages}
                                </span>

                                <Button variant="secondary" disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>
                                    Próxima <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default Processes;
