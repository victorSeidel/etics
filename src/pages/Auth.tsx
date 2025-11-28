import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

import { FileText } from "lucide-react";

import { Logo } from "@/components/Logo"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const Auth = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const { user } = useUser();

    const [mode, setMode] = useState<"signin" | "signup" | "forgot">((searchParams.get("mode") as "signin" | "signup" | "forgot") || "signin");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);

    useEffect(() => { if (user) { navigate("/apps"); } }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let endpoint = "";
            let body: Record<string, string> = {};

            if (mode === "signin") {
                endpoint = "/api/auth/login";
                body = { email, password };
            }
            else if (mode === "signup") {
                endpoint = "/api/auth/register";
                body = { email, password, name };
            }
            else if (mode === "forgot") {
                endpoint = "/api/auth/reset-password";
                body = { email };
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Erro ao processar requisição");

            if (mode === "forgot") {
                toast({ title: "Verifique seu e-mail", description: "Se o e-mail existir em nosso sistema, você receberá uma nova senha." });
                setMode("signin");
                setEmail("");
                setPassword("");
                return;
            }

            localStorage.setItem("token", data.token);
            toast({ title: mode === "signin" ? "Login realizado!" : "Conta criada!", description: "Redirecionando..." });

            setTimeout(() => navigate("/apps"), 1000);
        }
        catch (error: any) {
            toast({ title: "Erro", description: error.message || "Ocorreu um erro. Tente novamente.", variant: "destructive" });
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <Logo />
                </div>

                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold">
                            {mode === "signin"
                                ? "Bem-vindo de volta"
                                : mode === "signup"
                                    ? "Criar conta"
                                    : "Redefinir senha"}
                        </CardTitle>
                        <CardDescription>
                            {mode === "signin"
                                ? "Entre com seu e-mail e senha"
                                : mode === "signup"
                                    ? "Comece sua jornada gratuitamente"
                                    : "Informe seu e-mail para redefinir a senha"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {mode === "signup" && (
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome completo</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="João Silva"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {mode !== "forgot" && (
                                <div className="space-y-2">
                                    <Label htmlFor="password">Senha</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                variant="accent"
                                disabled={loading}
                            >
                                {loading
                                    ? "Processando..."
                                    : mode === "signin"
                                        ? "Entrar"
                                        : mode === "signup"
                                            ? "Criar conta"
                                            : "Enviar link de redefinição"}
                            </Button>

                            <div className="text-center text-sm space-y-2">
                                {mode === "signin" && (
                                    <>
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setMode("forgot")}
                                                className="text-accent hover:underline hover:text-accent/90"
                                            >
                                                Esqueci minha senha
                                            </button>
                                        </div>
                                        <div className="text-muted-foreground">
                                            Não tem uma conta?{" "}
                                            <button
                                                type="button"
                                                onClick={() => setMode("signup")}
                                                className="text-accent hover:underline hover:text-accent/90"
                                            >
                                                Cadastre-se
                                            </button>
                                        </div>
                                    </>
                                )}

                                {mode === "signup" && (
                                    <div className="text-muted-foreground">
                                        Já tem uma conta?{" "}
                                        <button
                                            type="button"
                                            onClick={() => setMode("signin")}
                                            className="text-accent hover:underline hover:text-accent/90"
                                        >
                                            Entrar
                                        </button>
                                    </div>
                                )}

                                {mode === "forgot" && (
                                    <div className="text-muted-foreground">
                                        Lembrou sua senha?{" "}
                                        <button
                                            type="button"
                                            onClick={() => setMode("signin")}
                                            className="text-accent hover:underline hover:text-accent/90"
                                        >
                                            Voltar ao login
                                        </button>
                                    </div>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Auth;