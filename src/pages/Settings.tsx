import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { FileText, ArrowLeft, User as UserIcon, Lock, CreditCard, Trash2, Save, Eye, EyeOff, RefreshCcw } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/Header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
    AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { getUserProfile, updateUserProfile, changePassword, getCreditBalance, deleteUserAccount, UserProfile, CreditBalance } from "@/services/apiUserService";

const Settings = () => 
{
    const { user, handleLogout, refreshUser } = useUser();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
    const [loading, setLoading] = useState(true);

    // Profile form state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);

    // Password form state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    useEffect(() => {
        const loadUserData = async () => 
        {
            if (!user) return;

            try 
            {
                const [profileData, creditsData] = await Promise.all([ getUserProfile(user.id),
                    getCreditBalance(user.id)
                ]);

                setProfile(profileData);
                setCreditBalance(creditsData);
                setName(profileData.name);
                setEmail(profileData.email);
            } catch (error: any) {
                console.error("Erro ao carregar dados do usuário:", error);
                toast.error(error.message || "Erro ao carregar dados do usuário");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            loadUserData();
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user || !profile) return;

        if (!name.trim()) {
            toast.error("O nome não pode estar vazio");
            return;
        }

        if (!email.trim()) {
            toast.error("O email não pode estar vazio");
            return;
        }

        setProfileLoading(true);

        try {
            await updateUserProfile(user.id, { name, email });
            toast.success("Perfil atualizado com sucesso");
            await refreshUser();
        } catch (error: any) {
            console.error("Erro ao atualizar perfil:", error);
            toast.error(error.message || "Erro ao atualizar perfil");
        } finally {
            setProfileLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("Todos os campos de senha são obrigatórios");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("A nova senha deve ter no mínimo 6 caracteres");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("As senhas não coincidem");
            return;
        }

        setPasswordLoading(true);

        try {
            await changePassword(user.id, { currentPassword, newPassword });
            toast.success("Senha alterada com sucesso");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            console.error("Erro ao alterar senha:", error);
            toast.error(error.message || "Erro ao alterar senha");
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;

        try {
            await deleteUserAccount(user.id);
            toast.success("Conta deletada com sucesso");
            handleLogout();
        } catch (error: any) {
            console.error("Erro ao deletar conta:", error);
            toast.error(error.message || "Erro ao deletar conta");
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
            <Header/>

            <main className="container mx-auto px-6 py-8 flex flex-col items-center">
                <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate("/apps")}>
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao Hub
                </Button>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Configurações</h1>
                    <p className="text-muted-foreground">
                        Gerencie suas informações de conta e preferências
                    </p>
                </div>

                {loading 
                ? 
                (
                    <div className="text-center py-8 text-muted-foreground">
                        Carregando informações da conta...
                    </div>
                ) 
                : 
                (
                    <div className="grid grid-cols-2 gap-6 max-w-4xl">
                        {/* Informações da Conta */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <UserIcon className="h-5 w-5 text-accent" />
                                    <CardTitle>Informações da Conta</CardTitle>
                                </div>
                                <CardDescription>
                                    Atualize suas informações pessoais
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleUpdateProfile} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nome</Label>
                                        <Input
                                            id="name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Seu nome completo"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="seu@email.com"
                                        />
                                    </div>

                                    <Button type="submit" disabled={profileLoading} className="gap-2">
                                        <Save className="h-4 w-4" />
                                        {profileLoading ? "Salvando..." : "Salvar Alterações"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Assinatura e Créditos */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-accent" />
                                    <CardTitle>Assinatura e Créditos</CardTitle>
                                </div>
                                <CardDescription>
                                    Informações sobre seu plano e créditos disponíveis
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Plano Atual</span>
                                        <Badge variant="default">
                                            {profile?.planDisplayName || 'Gratuito'}
                                        </Badge>
                                    </div>

                                    <Separator />

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Status da Assinatura</span>
                                        <Badge
                                            variant={profile?.subscriptionStatus === 'active' ? 'default' : 'secondary'}
                                        >
                                            {profile?.subscriptionStatus === 'active' ? 'Ativa' :
                                             profile?.subscriptionStatus === 'cancelled' ? 'Cancelada' :
                                             profile?.subscriptionStatus === 'expired' ? 'Expirada' :
                                             'Suspensa'}
                                        </Badge>
                                    </div>

                                    {profile?.billingCycle && (
                                        <>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Ciclo de Cobrança</span>
                                                <span className="text-sm text-muted-foreground">
                                                    {profile.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    <Separator />

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Créditos Disponíveis</span>
                                            <span className="text-lg font-bold text-accent">
                                                {creditBalance?.available || 0}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Créditos Utilizados</span>
                                            <span className="text-sm text-muted-foreground">
                                                {creditBalance?.used || 0}
                                            </span>
                                        </div>
                                    </div>

                                    <Button className="gap-2">
                                        <a href="/subscribe" className="flex items-center justify-center gap-2">
                                            <RefreshCcw className="h-4 w-4" />
                                            Alterar Plano
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Alterar Senha */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-accent" />
                                    <CardTitle>Segurança</CardTitle>
                                </div>
                                <CardDescription>
                                    Altere sua senha para manter sua conta segura
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleChangePassword} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPassword">Senha Atual</Label>
                                        <div className="relative">
                                            <Input
                                                id="currentPassword"
                                                type={showCurrentPassword ? "text" : "password"}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Digite sua senha atual"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showCurrentPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">Nova Senha</Label>
                                        <div className="relative">
                                            <Input
                                                id="newPassword"
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Digite sua nova senha (mínimo 6 caracteres)"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showNewPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                                        <div className="relative">
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirme sua nova senha"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <Button type="submit" disabled={passwordLoading} className="gap-2">
                                        <Lock className="h-4 w-4" />
                                        {passwordLoading ? "Alterando..." : "Alterar Senha"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Zona de Perigo */}
                        <Card className="border-destructive/50">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Trash2 className="h-5 w-5 text-destructive" />
                                    <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
                                </div>
                                <CardDescription>
                                    Ações irreversíveis que afetam permanentemente sua conta
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Uma vez que você deletar sua conta, não há como voltar atrás.
                                        Por favor, tenha certeza.
                                    </p>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" className="gap-2">
                                                <Trash2 className="h-4 w-4" />
                                                Deletar Conta
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta ação não pode ser desfeita. Isso irá permanentemente deletar sua conta
                                                    e remover seus dados de nossos servidores.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={handleDeleteAccount}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Sim, deletar minha conta
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Settings;
