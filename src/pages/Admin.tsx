import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { FileText, LogOut, Users, FileText as FileIcon, ArrowLeft, Save, X, BarChart3, CreditCard, Edit, Trash2, DollarSign, Activity, AlertTriangle, CheckCircle, 
    Clock, UserCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { User } from "@/types/user";

interface Process {
    id: string;
    name: string;
    lawyer: string;
    defendants: string[];
    status: 'processando' | 'concluido' | 'erro';
    progress: number;
    totalPdfs: number;
    processedPdfs: number;
    error_message?: string;
    createdAt: string;
    completed_at?: string;
    userId: number;
    user?: User;
}

interface ProcessAnalysis {
    id: string;
    processId: string;
    userId: number;
    type: 'general' | 'focused';
    focusTarget?: string;
    focusType?: string;
    status: 'gerando' | 'concluida' | 'erro';
    tokensUsed: number;
    modelUsed: string;
    createdAt: string;
    result?: string;
    process?: Process;
    user?: User;
}

interface Subscription {
    id: string;
    user_id: number;
    plan_id: string;
    credits_available: number;
    credits_used: number;
    status: 'active' | 'canceled' | 'past_due';
    billing_cycle: 'monthly' | 'yearly';
    current_period_start: string;
    current_period_end: string;
    user?: User;
    plan?: Plan;
}

interface Plan {
    id: string;
    name: string;
    display_name: string;
    description: string;
    credits_per_month: number;
    price_monthly: number;
    price_yearly: number;
    features: string[];
    is_active: boolean;
}

interface UserStats {
    user_id: number;
    user_name: string;
    user_email: string;
    total_processes: number;
    total_analyses: number;
    total_tokens: number;
    total_credits_used: number;
    last_activity: string;
}

const Admin = () => 
{
    const { API_URL, user, handleLogout } = useUser();
    const navigate = useNavigate();

    // Estados principais
    const [users, setUsers] = useState<User[]>([]);
    const [processes, setProcesses] = useState<Process[]>([]);
    const [analyses, setAnalyses] = useState<ProcessAnalysis[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [userStats, setUserStats] = useState<UserStats[]>([]);

    // Estados de prompts
    const [promptGeneralAnalysis, setPromptGeneralAnalysis] = useState('');
    const [promptFocusedAnalysis, setPromptFocusedAnalysis] = useState('');
    const [isEditingGeneral, setIsEditingGeneral] = useState(false);
    const [isEditingFocused, setIsEditingFocused] = useState(false);
    const [tempPromptGeneral, setTempPromptGeneral] = useState('');
    const [tempPromptFocused, setTempPromptFocused] = useState('');
    const [savingGeneral, setSavingGeneral] = useState(false);
    const [savingFocused, setSavingFocused] = useState(false);

    // Estados de filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');

    // Estados de diálogos
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [currentUser, setCurrentUser] = useState<Partial<User>>({});
    const [savingUser, setSavingUser] = useState(false);

    useEffect(() => 
    {
        const checkRole = async () => 
        {
            if (!user) return;

            if (user.role !== "admin") { navigate("/apps/etics/processes"); return; }
        };

        if (user) checkRole();
    }, [user, navigate]);

    useEffect(() => 
    {
        fetchAllData();
    }, [API_URL]);

    function normalizeArray<T>(data: any, key?: string): T[] 
    {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (data.data && Array.isArray(data.data)) return data.data;
        if (key && data[key] && Array.isArray(data[key])) return data[key];
        if (key && Array.isArray(data[0]?.[key])) return data[0][key];
        return [data];
    }

    async function fetchAllData() 
    {
        try 
        {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [
                usersRes,
                processesRes,
                analysesRes,
                subscriptionsRes,
                plansRes,
                configRes
            ] = await Promise.all([
                fetch(`${API_URL}/api/users`, { headers }),
                fetch(`${API_URL}/api/processes/all`, { headers }),
                fetch(`${API_URL}/api/analyses/all`, { headers }),
                fetch(`${API_URL}/api/subscriptions/all`, { headers }),
                fetch(`${API_URL}/api/subscriptions/plans`, { headers }),
                fetch(`${API_URL}/api/config`, { headers })
            ]);

            const usersData = await usersRes.json();
            const processesData = await processesRes.json();
            const analysesData = await analysesRes.json();
            const subscriptionsData = await subscriptionsRes.json();
            const plansData = await plansRes.json();
            const configData = await configRes.json();

            const normalizedUsers = normalizeArray<User>(usersData, "users");
            const normalizedProcesses = normalizeArray<Process>(processesData, "processes");
            const normalizedAnalyses = normalizeArray<ProcessAnalysis>(analysesData, "analyses");
            const normalizedSubscriptions = normalizeArray<Subscription>(subscriptionsData, "subscriptions");
            const normalizedPlans = normalizeArray<Plan>(plansData, "plans");

            setUsers(normalizedUsers);
            setProcesses(normalizedProcesses);
            setAnalyses(normalizedAnalyses);
            setSubscriptions(normalizedSubscriptions);
            setPlans(normalizedPlans);

            calculateUserStats(normalizedUsers, normalizedProcesses, normalizedAnalyses, normalizedSubscriptions);

            const promptGeneralAnalysisResult = configData.find((r: any) => r.name === 'prompt_general_analysis')?.value || '';
            const promptFocusedAnalysisResult = configData.find((r: any) => r.name === 'prompt_focused_analysis')?.value || '';
            setPromptGeneralAnalysis(promptGeneralAnalysisResult);
            setPromptFocusedAnalysis(promptFocusedAnalysisResult);

        } 
        catch (error) 
        {
            console.error('Erro ao carregar dados:', error);
            toast.error('Erro ao carregar dados do sistema');
        }
    }

    function calculateUserStats(users: User[], processes: Process[], analyses: ProcessAnalysis[], subscriptions: Subscription[]) 
    {
        const stats: UserStats[] = users.map(user => 
        {
            const userProcesses = processes.filter(p => p.userId === user.id);
            const userAnalyses = analyses.filter(a => a.userId === user.id);
            const userSubscription = subscriptions.find(s => s.user_id === user.id);

            const totalTokens = userAnalyses.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);
            const lastActivity = [...userProcesses, ...userAnalyses].map(item => item.createdAt).sort().reverse()[0] || user.created_at;

            return {
                user_id: user.id,
                user_name: user.name,
                user_email: user.email,
                total_processes: userProcesses.length,
                total_analyses: userAnalyses.length,
                total_tokens: totalTokens,
                total_credits_used: userSubscription?.credits_used || 0,
                last_activity: lastActivity
            };
        });

        setUserStats(stats);
    }

    const handleEditUser = (user: User) => {
        setCurrentUser(user);
        setIsEditingUser(true);
        setIsUserDialogOpen(true);
    };

    const handleSaveUser = async () => 
    {
        setSavingUser(true);

        try 
        {
            const token = localStorage.getItem('token');
            const method = isEditingUser ? 'PUT' : 'POST';
            const url = isEditingUser ? `${API_URL}/api/users/${currentUser.id}` : `${API_URL}/api/users`;

            const response = await fetch(url, 
            {
                method,
                headers: 
                {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(currentUser)
            });

            if (!response.ok) throw new Error('Erro ao salvar usuário');

            toast.success(isEditingUser ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso');
            setIsUserDialogOpen(false);
            fetchAllData();
        } 
        catch (error) 
        {
            console.error('Erro ao salvar usuário:', error);
            toast.error('Erro ao salvar usuário');
        } 
        finally 
        {
            setSavingUser(false);
        }
    };

    const handleDeleteUser = async (userId: number) => 
    {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

        try 
        {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });

            if (!response.ok) { throw new Error('Erro ao excluir usuário'); }

            toast.success('Usuário excluído com sucesso');
            fetchAllData();
        } 
        catch (error) 
        {
            console.error('Erro ao excluir usuário:', error);
            toast.error('Erro ao excluir usuário');
        }
    };

    const handleEditGeneral = () => 
    {
        setTempPromptGeneral(promptGeneralAnalysis);
        setIsEditingGeneral(true);
    };

    const handleEditFocused = () => 
    {
        setTempPromptFocused(promptFocusedAnalysis);
        setIsEditingFocused(true);
    };

    const handleCancelGeneral = () => 
    {
        setIsEditingGeneral(false);
        setTempPromptGeneral('');
    };

    const handleCancelFocused = () => 
    {
        setIsEditingFocused(false);
        setTempPromptFocused('');
    };

    const handleSaveGeneral = async () => 
    {
        setSavingGeneral(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/config/prompt_general_analysis`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ value: tempPromptGeneral })
            });

            if (!response.ok) {
                throw new Error('Erro ao salvar prompt');
            }

            setPromptGeneralAnalysis(tempPromptGeneral);
            setIsEditingGeneral(false);
            toast.success('Prompt de análise geral atualizado com sucesso');
        } catch (error) {
            console.error('Erro ao salvar prompt:', error);
            toast.error('Erro ao atualizar prompt');
        } finally {
            setSavingGeneral(false);
        }
    };

    const handleSaveFocused = async () => 
    {
        setSavingFocused(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/config/prompt_focused_analysis`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ value: tempPromptFocused })
            });

            if (!response.ok) {
                throw new Error('Erro ao salvar prompt');
            }

            setPromptFocusedAnalysis(tempPromptFocused);
            setIsEditingFocused(false);
            toast.success('Prompt de análise focada atualizado com sucesso');
        } catch (error) {
            console.error('Erro ao salvar prompt:', error);
            toast.error('Erro ao atualizar prompt');
        } finally {
            setSavingFocused(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            processing: { variant: "secondary", icon: Clock },
            completed: { variant: "default", icon: CheckCircle },
            error: { variant: "destructive", icon: AlertTriangle },
            active: { variant: "default", icon: CheckCircle },
            canceled: { variant: "secondary", icon: X },
            past_due: { variant: "destructive", icon: AlertTriangle },
            pending: { variant: "secondary", icon: Clock }
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.processing;
        const Icon = config.icon;

        return (
            <Badge variant={config.variant as any} className="gap-1">
                <Icon className="h-3 w-3" />
                {(status || 'N').charAt(0).toUpperCase() + (status || 'A').slice(1)}
            </Badge>
        );
    };

    const formatDate = (dateString: string) => { return new Date(dateString).toLocaleDateString('pt-BR'); };
    const formatDateTime = (dateString: string) => { return new Date(dateString).toLocaleString('pt-BR'); };
    const formatCurrency = (value: number) =>  { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); };

    const filteredProcesses = processes.filter(process => 
    {
        const matchesSearch = (process?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
            || (process?.lawyer || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || process.status === statusFilter;
        const matchesUser = userFilter === 'all' || process.userId.toString() === userFilter;

        let matchesDate = true;
        if (dateFilter !== 'all') 
        {
            const processDate = new Date(process.createdAt);
            const now = new Date();

            if (dateFilter === 'today') 
            {
                matchesDate = processDate.toDateString() === now.toDateString();
            } 
            else if (dateFilter === 'week') 
            {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                matchesDate = processDate >= weekAgo;
            } 
            else if (dateFilter === 'month') 
            {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                matchesDate = processDate >= monthAgo;
            }
        }

        return matchesSearch && matchesStatus && matchesUser && matchesDate;
    });

    const totalUsers = users.length;
    const totalProcesses = processes.length;
    const totalAnalyses = analyses.length;
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
    const totalRevenue = subscriptions.reduce((sum, sub) => 
    {
        const plan = plans.find(p => p.id === sub.plan_id);
        if (!plan) return sum;
        return sum + (sub.billing_cycle === 'monthly' ? plan.price_monthly : plan.price_yearly);
    }, 0);
    const processingCount = processes.filter(p => p.status === 'processando').length;

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
                        <nav className="hidden md:flex items-center gap-6">
                            <button
                                onClick={() => navigate("/apps/etics/processes")}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Processos
                            </button>
                            <button
                                onClick={() => navigate("/apps/etics/admin")}
                                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                            >
                                Admin
                            </button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <Badge className="bg-accent text-accent-foreground">ADMIN</Badge>
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate("/apps")}>
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao Hub
                </Button>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Painel Administrativo</h1>
                    <p className="text-muted-foreground">
                        Gerencie usuários, processos e configurações do sistema
                    </p>
                </div>

                {/* Cards de estatísticas gerais */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalUsers}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Processos</CardTitle>
                            <FileIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalProcesses}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Análises</CardTitle>
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalAnalyses}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Assinaturas</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{activeSubscriptions}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Processando</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{processingCount}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Receita</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="users" className="space-y-6">
                    <TabsList className="grid grid-cols-2 lg:grid-cols-7 w-full">
                        <TabsTrigger value="users">Usuários</TabsTrigger>
                        <TabsTrigger value="stats">Estatísticas</TabsTrigger>
                        <TabsTrigger value="processes">Processos</TabsTrigger>
                        <TabsTrigger value="analyses">Análises</TabsTrigger>
                        <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
                        <TabsTrigger value="prompts">Prompts</TabsTrigger>
                        <TabsTrigger value="reports">Relatórios</TabsTrigger>
                    </TabsList>

                    {/* Usuários */}
                    <TabsContent value="users">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Gerenciamento de Usuários</CardTitle>
                                        <CardDescription>
                                            Crie, edite e gerencie todos os usuários da plataforma
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Cargo</TableHead>
                                            <TableHead>Processos</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                                        {user.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {processes.filter(p => p.userId === user.id).length}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="default" className="bg-green-500">
                                                        <UserCheck className="h-3 w-3 mr-1" />
                                                        Ativo
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleEditUser(user)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(user.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Estatísticas por Usuário */}
                    <TabsContent value="stats">
                        <Card>
                            <CardHeader>
                                <CardTitle>Estatísticas de Uso por Usuário</CardTitle>
                                <CardDescription>
                                    Visualize o consumo e atividade de cada usuário
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Processos</TableHead>
                                            <TableHead>Análises</TableHead>
                                            <TableHead>Tokens Usados</TableHead>
                                            <TableHead>Última Atividade</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {userStats.map((stat) => (
                                            <TableRow key={stat.user_id}>
                                                <TableCell className="font-medium">{stat.user_name}</TableCell>
                                                <TableCell>{stat.user_email}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{stat.total_processes}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{stat.total_analyses}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {stat.total_tokens.toLocaleString()}
                                                </TableCell>
                                                <TableCell>{formatDateTime(stat.last_activity)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Processos */}
                    <TabsContent value="processes">
                        <Card>
                            <CardHeader>
                                <CardTitle>Todos os Processos</CardTitle>
                                <CardDescription>
                                    Visualize todos os processos do sistema com filtros avançados
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-4 mb-6">
                                    <div className="flex-1 min-w-[200px]">
                                        <Input
                                            placeholder="Buscar processos..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Select value={userFilter} onValueChange={setUserFilter}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Filtrar por usuário" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os usuários</SelectItem>
                                            {users.map(user => (
                                                <SelectItem key={user.id} value={user.id.toString()}>
                                                    {user.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Filtrar status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="processing">Processando</SelectItem>
                                            <SelectItem value="completed">Concluído</SelectItem>
                                            <SelectItem value="error">Erro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={dateFilter} onValueChange={setDateFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Filtrar data" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas as datas</SelectItem>
                                            <SelectItem value="today">Hoje</SelectItem>
                                            <SelectItem value="week">Última semana</SelectItem>
                                            <SelectItem value="month">Último mês</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Advogado</TableHead>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>PDFs</TableHead>
                                            <TableHead>Progresso</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProcesses.map((process) => (
                                            <TableRow key={process.id}>
                                                <TableCell className="font-medium">{process.name}</TableCell>
                                                <TableCell>{process.lawyer}</TableCell>
                                                <TableCell>
                                                    {users.find(u => u.id === process.userId)?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {process.totalPdfs}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-full bg-secondary rounded-full h-2 min-w-[60px]">
                                                            <div
                                                                className="bg-primary h-2 rounded-full transition-all"
                                                                style={{ width: `${process.progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm">{process.progress}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatDate(process.createdAt)}</TableCell>
                                                <TableCell>{getStatusBadge(process.status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Análises */}
                    <TabsContent value="analyses">
                        <Card>
                            <CardHeader>
                                <CardTitle>Histórico de Análises</CardTitle>
                                <CardDescription>
                                    Visualize detalhadamente todas as análises realizadas pelo sistema de IA
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Processo</TableHead>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Foco</TableHead>
                                            <TableHead>Tokens</TableHead>
                                            <TableHead>Modelo</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analyses.map((analysis) => (
                                            <TableRow key={analysis.id}>
                                                <TableCell className="font-medium">
                                                    {processes.find(p => p.id === analysis.processId)?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {users.find(u => u.id === analysis.userId)?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={analysis.type === 'general' ? 'default' : 'secondary'}>
                                                        {analysis.type === 'general' ? 'Geral' : 'Focada'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">
                                                            {analysis.focusTarget || '-'}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {analysis.focusType}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {analysis.tokensUsed?.toLocaleString() || '0'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{analysis.modelUsed}</Badge>
                                                </TableCell>
                                                <TableCell>{formatDateTime(analysis.createdAt)}</TableCell>
                                                <TableCell>{getStatusBadge(analysis.status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Assinaturas */}
                    <TabsContent value="subscriptions">
                        <Card>
                            <CardHeader>
                                <CardTitle>Gerenciamento de Assinaturas</CardTitle>
                                <CardDescription>
                                    Visualize todas as assinaturas do sistema
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Plano</TableHead>
                                            <TableHead>Créditos</TableHead>
                                            <TableHead>Ciclo</TableHead>
                                            <TableHead>Início</TableHead>
                                            <TableHead>Término</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {subscriptions.map((subscription) => (
                                            <TableRow key={subscription.id}>
                                                <TableCell className="font-medium">
                                                    {users.find(u => u.id === subscription.user_id)?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {plans.find(p => p.id === subscription.plan_id)?.display_name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">
                                                            {subscription.credits_available} disponíveis
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {subscription.credits_used} usados
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {subscription.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{formatDate(subscription.current_period_start)}</TableCell>
                                                <TableCell>{formatDate(subscription.current_period_end)}</TableCell>
                                                <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Prompts */}
                    <TabsContent value="prompts">
                        <Card>
                            <CardHeader>
                                <CardTitle>Configuração de Prompts</CardTitle>
                                <CardDescription>
                                    Configure os prompts utilizados nas análises de IA
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="p-4 border rounded-lg">
                                        <h3 className="font-medium mb-2">Prompt de Análise Geral</h3>
                                        {isEditingGeneral ? (
                                            <div className="space-y-3">
                                                <Textarea
                                                    value={tempPromptGeneral}
                                                    onChange={(e) => setTempPromptGeneral(e.target.value)}
                                                    rows={8}
                                                    className="w-full font-mono text-sm"
                                                    placeholder="Digite o prompt de análise geral..."
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={handleSaveGeneral}
                                                        disabled={savingGeneral}
                                                        size="sm"
                                                        className="gap-2"
                                                    >
                                                        <Save className="h-4 w-4" />
                                                        {savingGeneral ? 'Salvando...' : 'Salvar'}
                                                    </Button>
                                                    <Button
                                                        onClick={handleCancelGeneral}
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-2"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        Cancelar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-3 rounded">
                                                    {promptGeneralAnalysis || 'Nenhum prompt configurado'}
                                                </p>
                                                <Button variant="outline" size="sm" className="mt-3" onClick={handleEditGeneral}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Editar Prompt
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <h3 className="font-medium mb-2">Prompt de Análise Focada</h3>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Use <code className="bg-muted px-1 py-0.5 rounded">{'{FOCUS_TARGET}'}</code> para o nome do advogado/réu e <code className="bg-muted px-1 py-0.5 rounded">{'{FOCUS_TYPE}'}</code> para o tipo.
                                        </p>
                                        {isEditingFocused ? (
                                            <div className="space-y-3">
                                                <Textarea
                                                    value={tempPromptFocused}
                                                    onChange={(e) => setTempPromptFocused(e.target.value)}
                                                    rows={8}
                                                    className="w-full font-mono text-sm"
                                                    placeholder="Digite o prompt de análise focada..."
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={handleSaveFocused}
                                                        disabled={savingFocused}
                                                        size="sm"
                                                        className="gap-2"
                                                    >
                                                        <Save className="h-4 w-4" />
                                                        {savingFocused ? 'Salvando...' : 'Salvar'}
                                                    </Button>
                                                    <Button
                                                        onClick={handleCancelFocused}
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-2"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        Cancelar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-3 rounded">
                                                    {promptFocusedAnalysis || 'Nenhum prompt configurado'}
                                                </p>
                                                <Button variant="outline" size="sm" className="mt-3" onClick={handleEditFocused}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Editar Prompt
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Relatórios */}
                    <TabsContent value="reports">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Relatório Financeiro</CardTitle>
                                    <CardDescription>
                                        Visão geral da receita e assinaturas
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Receita Total (MRR)</p>
                                                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                                            </div>
                                            <DollarSign className="h-8 w-8 text-green-500" />
                                        </div>
                                        <div className="space-y-3">
                                            {plans.map(plan => {
                                                const planSubs = subscriptions.filter(s => s.plan_id === plan.id && s.status === 'active');
                                                const planRevenue = planSubs.reduce((sum, sub) =>
                                                    sum + (sub.billing_cycle === 'monthly' ? plan.price_monthly : plan.price_yearly / 12), 0
                                                );
                                                return (
                                                    <div key={plan.id} className="flex justify-between items-center p-3 border rounded">
                                                        <div>
                                                            <p className="font-medium">{plan.display_name}</p>
                                                            <p className="text-sm text-muted-foreground">{planSubs.length} assinantes</p>
                                                        </div>
                                                        <p className="font-bold">{formatCurrency(planRevenue)}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Relatório de Consumo</CardTitle>
                                    <CardDescription>
                                        Documentos analisados e tokens utilizados
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total de Documentos</p>
                                                <p className="text-2xl font-bold">
                                                    {processes.reduce((sum, p) => sum + p.totalPdfs, 0)}
                                                </p>
                                            </div>
                                            <FileIcon className="h-8 w-8 text-blue-500" />
                                        </div>
                                        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total de Tokens</p>
                                                <p className="text-2xl font-bold">
                                                    {analyses.reduce((sum, a) => sum + (a.tokensUsed || 0), 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <Zap className="h-8 w-8 text-yellow-500" />
                                        </div>
                                        <div className="space-y-3">
                                            <h4 className="font-medium text-sm">Top Usuários por Consumo</h4>
                                            {userStats
                                                .sort((a, b) => b.total_tokens - a.total_tokens)
                                                .slice(0, 5)
                                                .map(stat => (
                                                    <div key={stat.user_id} className="flex justify-between items-center p-3 border rounded">
                                                        <div>
                                                            <p className="font-medium">{stat.user_name}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {stat.total_analyses} análises
                                                            </p>
                                                        </div>
                                                        <p className="font-bold">{stat.total_tokens.toLocaleString()} tokens</p>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Dialog de Usuário */}
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isEditingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
                        <DialogDescription>
                            {isEditingUser ? 'Atualize as informações do usuário' : 'Preencha os dados do novo usuário'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Nome</Label>
                            <Input
                                value={currentUser.name || ''}
                                onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                                placeholder="Nome completo"
                            />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={currentUser.email || ''}
                                onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                                placeholder="email@exemplo.com"
                            />
                        </div>
                        <div>
                            <Label>Cargo</Label>
                            <Select
                                value={currentUser.role || 'user'}
                                onValueChange={(value) => setCurrentUser({ ...currentUser, role: value as 'user' | 'admin' })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Usuário</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveUser} disabled={savingUser}>
                            {savingUser ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Admin;
