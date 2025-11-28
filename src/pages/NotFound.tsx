import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileText, Home, ArrowRight, Search, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b border-border/40 backdrop-blur-lg bg-background/95 sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo />
                    </div>
                    <Button 
                        variant="outline" 
                        className="font-medium"
                        onClick={() => navigate("/")}
                    >
                        <Home className="mr-2 h-4 w-4" />
                        Voltar ao Início
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center py-16">
                <div className="container mx-auto px-6">
                    <div className="max-w-2xl mx-auto text-center space-y-8">
                        {/* Icon and Status */}
                        <div className="space-y-4">
                            <div className="relative inline-flex">
                                <div className="w-32 h-32 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-16 w-16 text-primary" />
                                </div>
                                <div className="absolute -top-2 -right-2 bg-accent text-white rounded-full px-3 py-1 text-sm font-bold">
                                    404
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <h1 className="text-4xl md:text-4xl font-bold tracking-tight">
                                    Página Não Encontrada
                                </h1>
                                <p className="text-xl text-muted-foreground max-w-md mx-auto leading-relaxed">
                                    O conteúdo que você está procurando não existe ou foi movido para outro local.
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                            <Button 
                                size="lg" 
                                variant="accent" 
                                className="text-base font-semibold px-8 py-3 h-auto"
                                onClick={() => navigate("/")}
                            >
                                <Home className="mr-2 h-5 w-5" />
                                Página Inicial
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button 
                                size="lg" 
                                variant="outline" 
                                className="text-base font-semibold px-8 py-3 h-auto"
                                onClick={() => navigate("/auth")}
                            >
                                Acessar Plataforma
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NotFound;