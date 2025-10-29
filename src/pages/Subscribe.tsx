import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ArrowLeft, Check, FileText, Star, CreditCard, MapPin, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const Subscribe = () => 
{
    const navigate = useNavigate();
    
    const [searchParams, setSearchParams] = useSearchParams();
    const plan = searchParams.get("plan") || "professional";
    
    const [formData, setFormData] = useState({ nomeTitular: '', cpf: '', email: '', telefone: '', cep: '', numeroCasa: '', numeroCartao: '', validade: '', cvv: '' });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const plans = 
    {
        free: {
            id: "free",
            name: "Gratuito",
            price: "R$ 0",
            period: "sempre gratuito",
            description: "Perfeito para conhecer a plataforma",
            features: ["1 análise por mês", "Suporte básico"],
            popular: false
        },
        basic: {
            id: "basic",
            name: "Básico",
            price: "R$ 97",
            period: "por ano",
            description: "Ideal para advogados autônomos",
            features: ["5 análises por mês", "Suporte prioritário"],
            popular: true
        },
        professional: {
            id: "pro",
            name: "Profissional",
            price: "R$ 397",
            period: "por ano",
            description: "Para escritórios em crescimento",
            features: ["10 análises por mês", "Suporte dedicado"],
            popular: false
        }
    };

    const currentPlan = plans[plan as keyof typeof plans] || plans.professional;
    const handlePlanChange = (newPlan: string) => { setSearchParams({ plan: newPlan }); };

    const validateCPF = (cpf: string): boolean => 
    {
        cpf = cpf.replace(/[^\d]/g, '');
        
        if (cpf.length !== 11) return false;
        
        if (/^(\d)\1+$/.test(cpf)) return false;
        
        let sum = 0;
        for (let i = 0; i < 9; i++) { sum += parseInt(cpf.charAt(i)) * (10 - i); }
        let remainder = 11 - (sum % 11);
        let digit = remainder >= 10 ? 0 : remainder;
        
        if (digit !== parseInt(cpf.charAt(9))) return false;
        
        sum = 0;
        for (let i = 0; i < 10; i++) { sum += parseInt(cpf.charAt(i)) * (11 - i); }
        remainder = 11 - (sum % 11);
        digit = remainder >= 10 ? 0 : remainder;
        
        return digit === parseInt(cpf.charAt(10));
    };

    const validateCreditCard = (cardNumber: string): boolean => 
    {
        cardNumber = cardNumber.replace(/\s/g, '');
        
        let sum = 0;
        let isEven = false;
        
        for (let i = cardNumber.length - 1; i >= 0; i--) 
        {
            let digit = parseInt(cardNumber.charAt(i));
            
            if (isEven) 
            {
                digit *= 2;
                if (digit > 9) { digit -= 9; }
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        return sum % 10 === 0;
    };

    const validateEmail = (email: string): boolean => 
    {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateValidade = (validade: string): boolean => 
    {
        const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
        if (!regex.test(validade)) return false;
        
        const [month, year] = validade.split('/');
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        
        const cardYear = parseInt(year);
        const cardMonth = parseInt(month);
        
        if (cardYear < currentYear) return false;
        if (cardYear === currentYear && cardMonth < currentMonth) return false;
        
        return true;
    };

    const validatePhone = (phone: string): boolean => 
    {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 11;
    };

    const validateCEP = (cep: string): boolean => 
    {
        const cleaned = cep.replace(/\D/g, '');
        return cleaned.length === 8;
    };

    const handleInputChange = (field: string, value: string) => 
    {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        if (errors[field]) { setErrors(prev => ({ ...prev, [field]: '' })); }
    };

    const handleSubmit = async (e: React.FormEvent) => 
    {
        e.preventDefault();
        setIsLoading(true);
        
        const newErrors: Record<string, string> = {};

        if (!formData.nomeTitular.trim()) newErrors.nomeTitular = "Nome do titular é obrigatório";

        if (!formData.email) {
        newErrors.email = "Email é obrigatório";
        } else if (!validateEmail(formData.email)) {
        newErrors.email = "Email inválido";
        }

        if (!formData.telefone) {
        newErrors.telefone = "Telefone é obrigatório";
        } else if (!validatePhone(formData.telefone)) {
        newErrors.telefone = "Telefone inválido";
        }

        if (!formData.cep) {
        newErrors.cep = "CEP é obrigatório";
        } else if (!validateCEP(formData.cep)) {
        newErrors.cep = "CEP inválido";
        }

        if (!formData.numeroCasa.trim()) {
        newErrors.numeroCasa = "Número da casa é obrigatório";
        }

        if (!formData.numeroCartao) {
        newErrors.numeroCartao = "Número do cartão é obrigatório";
        } else if (!validateCreditCard(formData.numeroCartao)) {
        newErrors.numeroCartao = "Número do cartão inválido";
        }

        if (!formData.cpf) {
        newErrors.cpf = "CPF é obrigatório";
        } else if (!validateCPF(formData.cpf)) {
        newErrors.cpf = "CPF inválido";
        }

        if (!formData.validade) {
        newErrors.validade = "Validade é obrigatória";
        } else if (!validateValidade(formData.validade)) {
        newErrors.validade = "Validade inválida ou expirada";
        }

        if (!formData.cvv) {
        newErrors.cvv = "CVV é obrigatório";
        } else if (formData.cvv.length < 3) {
        newErrors.cvv = "CVV inválido";
        }

        if (Object.keys(newErrors).length > 0)
        {
            setErrors(newErrors);
            setIsLoading(false);
            return;
        }

        try
        {
            const token = localStorage.getItem("token");
            if (!token) 
            {
                setErrors({ submit: "Você precisa estar logado para assinar um plano" });
                setIsLoading(false);
                return;
            }

            const plansResponse = await fetch(`${API_URL}/api/subscriptions/plans`, { headers: { "Authorization": `Bearer ${token}` } });
            if (!plansResponse.ok) throw new Error("Erro ao buscar planos");

            const plansData = await plansResponse.json();
            console.log(plansData);
            const selectedPlan = plansData.find((p: any) => p.name === plan);
            if (!selectedPlan) throw new Error("Plano não encontrado");

            const response = await fetch(`${API_URL}/api/subscriptions/subscribe`, 
            {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ planId: selectedPlan.id, billingCycle: "yearly", paymentData: formData })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.details || data.error || "Erro ao processar pagamento");

            navigate("/settings");
        }
        catch (error: any)
        {
            console.error("Erro ao processar assinatura:", error);
            setErrors({ submit: error.message || "Erro ao processar pagamento. Tente novamente." });
        }
        finally
        {
            setIsLoading(false);
        }
    };

    const formatCPF = (value: string) => 
    {
        return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
    };

    const formatCreditCard = (value: string) => 
    {
        return value.replace(/\D/g, '').replace(/(\d{4})(\d)/, '$1 $2').replace(/(\d{4})(\d)/, '$1 $2').replace(/(\d{4})(\d)/, '$1 $2').replace(/(\d{4})\d+?$/, '$1');
    };

    const formatValidade = (value: string) => 
    {
        return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\/\d{2})\d+?$/, '$1');
    };

    const formatPhone = (value: string) => 
    {
        return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
    };

    const formatCEP = (value: string) => 
    {
        return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border/40 backdrop-blur-lg bg-background/95 sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
                        <div className="relative">
                            <FileText className="h-7 w-7 text-accent" />
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></div>
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            ETICS
                        </span>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/")}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                </div>
            </header>

            <div className="container mx-auto px-6 py-12 max-w-6xl">
                <h1 className="text-3xl font-bold mb-8">Assinatura de Plano</h1>

                <div className="flex flex-col gap-12">

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Escolha seu Plano</h3>
                        <div className="grid grid-cols-2 gap-8">
                            {Object.values(plans).filter(p => p.id !== 'free').map((planItem) => (
                                <Card key={planItem.id} onClick={() => handlePlanChange(planItem.id)}
                                    className={cn("cursor-pointer transition-all duration-300 border-2",
                                        currentPlan.id === planItem.id ? "border-accent bg-accent/5 shadow-lg scale-105" 
                                            : "border-border hover:border-primary/50 hover:shadow-md")} >
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <h4 className="font-semibold text-lg">{planItem.name}</h4>
                                                    {planItem.popular && (
                                                        <span className="bg-gradient-to-r from-primary to-accent text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                            <Star className="h-3 w-3 fill-current" />
                                                            Popular
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-2xl font-bold">{planItem.price}</span>
                                                    <span className="text-muted-foreground text-sm">{planItem.period}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{planItem.description}</p>
                                            </div>
                                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                                    currentPlan.id === planItem.id ? "border-accent bg-accent" : "border-border" )}>
                                                {currentPlan.id === planItem.id && ( <Check className="h-3 w-3 text-white" /> )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Informações de Pagamento</CardTitle>
                            <CardDescription>
                                Preencha todos os campos para finalizar sua assinatura
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Dados Pessoais */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        Dados Pessoais
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="nomeTitular">Nome Completo do Titular</Label>
                                            <Input
                                            id="nomeTitular"
                                            value={formData.nomeTitular}
                                            onChange={(e) => handleInputChange("nomeTitular", e.target.value)}
                                            placeholder="João G Victor"
                                            className={cn(errors.nomeTitular && "border-destructive")}
                                            />
                                            {errors.nomeTitular && (
                                            <p className="text-sm text-destructive">{errors.nomeTitular}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                        <Label htmlFor="cpf">CPF</Label>
                                        <Input
                                            id="cpf"
                                            value={formData.cpf}
                                            onChange={(e) => handleInputChange("cpf", formatCPF(e.target.value))}
                                            placeholder="000.000.000-00"
                                            maxLength={14}
                                            className={cn(errors.cpf && "border-destructive")}
                                        />
                                        {errors.cpf && (
                                            <p className="text-sm text-destructive">{errors.cpf}</p>
                                        )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleInputChange("email", e.target.value)}
                                            placeholder="seu@email.com"
                                            className={cn(errors.email && "border-destructive")}
                                        />
                                        {errors.email && (
                                            <p className="text-sm text-destructive">{errors.email}</p>
                                        )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="telefone">Telefone</Label>
                                            <Input
                                            id="telefone"
                                            value={formData.telefone}
                                            onChange={(e) => handleInputChange("telefone", formatPhone(e.target.value))}
                                            placeholder="(11) 99999-9999"
                                            maxLength={15}
                                            className={cn(errors.telefone && "border-destructive")}
                                            />
                                            {errors.telefone && (
                                            <p className="text-sm text-destructive">{errors.telefone}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Endereço */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Endereço
                                    </h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                        <Label htmlFor="cep">CEP</Label>
                                        <Input
                                            id="cep"
                                            value={formData.cep}
                                            onChange={(e) => handleInputChange("cep", formatCEP(e.target.value))}
                                            placeholder="00000-000"
                                            maxLength={9}
                                            className={cn(errors.cep && "border-destructive")}
                                        />
                                        {errors.cep && (
                                            <p className="text-sm text-destructive">{errors.cep}</p>
                                        )}
                                        </div>

                                        <div className="space-y-2">
                                        <Label htmlFor="numeroCasa">Número</Label>
                                        <Input
                                            id="numeroCasa"
                                            value={formData.numeroCasa}
                                            onChange={(e) => handleInputChange("numeroCasa", e.target.value)}
                                            placeholder="123"
                                            className={cn(errors.numeroCasa && "border-destructive")}
                                        />
                                        {errors.numeroCasa && (
                                            <p className="text-sm text-destructive">{errors.numeroCasa}</p>
                                        )}
                                        </div>
                                    </div>
                                </div>

                                {/* Cartão de Crédito */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" />
                                        Cartão de Crédito
                                    </h3>
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="numeroCartao">Número do Cartão</Label>
                                            <Input
                                            id="numeroCartao"
                                            value={formData.numeroCartao}
                                            onChange={(e) => handleInputChange("numeroCartao", formatCreditCard(e.target.value))}
                                            placeholder="0000 0000 0000 0000"
                                            maxLength={19}
                                            className={cn(errors.numeroCartao && "border-destructive")}
                                            />
                                            {errors.numeroCartao && (
                                            <p className="text-sm text-destructive">{errors.numeroCartao}</p>
                                            )}
                                        </div>

                                    
                                        <div className="space-y-2">
                                        <Label htmlFor="validade">Validade</Label>
                                        <Input
                                            id="validade"
                                            value={formData.validade}
                                            onChange={(e) => handleInputChange("validade", formatValidade(e.target.value))}
                                            placeholder="MM/AA"
                                            maxLength={5}
                                            className={cn(errors.validade && "border-destructive")}
                                        />
                                        {errors.validade && (
                                            <p className="text-sm text-destructive">{errors.validade}</p>
                                        )}
                                        </div>

                                        <div className="space-y-2">
                                        <Label htmlFor="cvv">CVV</Label>
                                        <Input
                                            id="cvv"
                                            value={formData.cvv}
                                            onChange={(e) => handleInputChange("cvv", e.target.value.replace(/\D/g, ''))}
                                            placeholder="000"
                                            maxLength={4}
                                            className={cn(errors.cvv && "border-destructive")}
                                        />
                                        {errors.cvv && (
                                            <p className="text-sm text-destructive">{errors.cvv}</p>
                                        )}
                                        </div>
                                    </div>
                                </div>

                                {errors.submit && (
                                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                        <p className="text-sm text-destructive text-center">{errors.submit}</p>
                                    </div>
                                )}

                                <Button 
                                    type="submit" 
                                    className="w-full font-semibold py-3 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
                                    disabled={isLoading}
                                >
                                    {isLoading 
                                    ? 
                                    (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Processando...
                                        </>
                                    ) 
                                    : 
                                    (
                                        `Assinar ${currentPlan.name} - ${currentPlan.price}`
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
  );
}

export default Subscribe;