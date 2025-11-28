import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { FileText, Settings, LogOut } from "lucide-react";

import { Logo } from "@/components/Logo"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AppCardProps { name: string; description: string; icon: React.ReactNode; href: string; color: string; functional: boolean; }

const AppCard = ({ name, description, icon, href, color, functional }: AppCardProps) => 
{
    const navigate = useNavigate();

    return (
        <Card onClick={() => navigate(href)}
                className={`transition-all hover:shadow-lg cursor-pointer group border-l-4 hover:border-l-8 ${functional ? 'hover:border-l-accent' : `hover:${color}`}`} >
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${functional ? 'bg-accent/10' : 'bg-muted'} group-hover:scale-110 transition-transform`}>
                        {icon}
                    </div>
                    {!functional && ( <Badge variant="secondary" className="text-xs">Em breve</Badge> )}
                </div>
                <CardTitle className="text-xl mt-4">{name}</CardTitle>
                <CardDescription className="text-sm">{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant={functional ? "accent" : "outline"} 
                        className="w-full group-hover:shadow-md transition-shadow">
                    {functional ? 'Acessar' : 'Em breve'}
                </Button>
            </CardContent>
        </Card>
    );
};

const AppsHub = () => 
{
    const { API_URL, user, handleLogout } = useUser();
    const navigate = useNavigate();

    if (!user) return null;

    const apps = 
    [
        {
            name: "Análise de Processos",
            description: "Análise inteligente de processos jurídicos com IA",
            icon: <FileText className="h-6 w-6 text-accent" />,
            href: "/apps/analise-de-processos/processes",
            color: "border-l-accent",
            functional: true
        }
    ];

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                        <Logo width={150} />
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
                            <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div className="bg-gradient-to-r from-primary via-primary/90 to-accent/30 rounded-lg p-8 mb-8 shadow-lg">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Bem-vindo, {user.name}!
                    </h1>
                    <p className="text-white/90">
                        Escolha uma aplicação abaixo para começar
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {apps.map((app) => (
                        <AppCard key={app.name} name={app.name} description={app.description} icon={app.icon} href={app.href} color={app.color} functional={app.functional} />
                    ))}
                </div>
            </main>
        </div>
    );
};

export default AppsHub;
