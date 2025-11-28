import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileText, Sparkles, Clock, Shield, Check, Zap, Star, ArrowRight } from "lucide-react";

import { Logo } from "@/components/Logo"
import { Footer } from "@/components/Footer"

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border/40 backdrop-blur-lg bg-background/95 sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo />
                    </div>
                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">
                            Vantagens
                        </a>
                        <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">
                            Planos
                        </a>
                        <Button variant="ghost" className="font-medium" onClick={() => navigate("/auth")}>
                            Acessar Plataforma
                        </Button>
                        <Button className="font-medium bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity" 
                                onClick={() => navigate("/auth?mode=signup")}>
                            Começar Gratuitamente
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
                <div className="container mx-auto px-6 py-24 md:py-36 relative">
                    <div className="max-w-4xl mx-auto text-center space-y-10">
                        <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full border border-primary/20 mb-4">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-primary">Revolucionando a análise jurídica com IA</span>
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                            Domine seus processos com 
                            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-3">
                                Inteligência Artificial
                            </span>
                        </h1>
                        
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Transforme documentos jurídicos complexos em insights claros e acionáveis. 
                            Nossa IA especializada identifica padrões, riscos e oportunidades em minutos, 
                            não em horas.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                            <Button size="lg" variant="accent" className="text-base font-semibold px-8 py-3 h-auto" 
                                    onClick={() => navigate("/auth?mode=signup")}>
                                <Zap className="mr-2 h-5 w-5" />
                                Experimentar Análise Gratuita
                            </Button>
                            <Button size="lg" variant="outline" className="text-base font-semibold px-8 py-3 h-auto"
                                    onClick={() => navigate("/auth")}>
                                Ver Demonstração
                            </Button>
                        </div>

                        <div className="flex flex-wrap justify-center gap-8 pt-8 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-accent" />
                                <span>Sem necessidade de cartão</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-accent" />
                                <span>Configuração em 2 minutos</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-accent" />
                                <span>Suporte especializado</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="relative py-24 bg-gradient-to-b from-muted/30 to-background">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">
                            Por que Escolher o ETICS?
                        </h2>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Tecnologia de ponta desenvolvida especificamente para o universo jurídico, 
                            combinando precisão técnica com agilidade operacional.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                        {[
                            {
                                icon: FileText,
                                title: "Análise Multiformato",
                                description: "Processamento inteligente de PDFs com OCR avançado para máxima precisão na extração de dados.",
                                color: "accent"
                            },
                            {
                                icon: Sparkles,
                                title: "IA Especializada",
                                description: "Algoritmos que entendem documentos e contextos jurídicos e fazem análises precisamente.",
                                color: "primary"
                            },
                            {
                                icon: Clock,
                                title: "Agilidade Comprovada",
                                description: "Reduza o tempo de análise com processamento em background e notificações via e-mail e plataforma.",
                                color: "accent"
                            },
                            {
                                icon: Shield,
                                title: "Segurança Máxima",
                                description: "Criptografia, compliance com LGPD e infraestrutura em nuvem segura. Seus dados estão sempre protegidos conosco.",
                                color: "primary"
                            }
                        ].map((feature, index) => (
                            <div key={index} className="group relative">
                                <div className="relative bg-background border rounded-2xl p-8 space-y-4 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 h-full">
                                    <div className={`w-14 h-14 rounded-2xl bg-${feature.color}/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                        <feature.icon className={`h-7 w-7 text-${feature.color}`} />
                                    </div>
                                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                                        {feature.title}
                                    </h3>
                                    <p className="text-muted-foreground leading-relaxed text-justify">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-24 bg-gradient-to-b from-background to-muted/20">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">
                            Invista em eficiência
                        </h2>
                        <p className="text-xl text-muted-foreground">
                            Planos desenhados para escritórios de todos os tamanhos. <br/>
                            <span className="font-semibold text-foreground"> Comece gratuitamente</span> e evolua conforme sua necessidade.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {[
                            {                             
                                name: "Gratuito",
                                price: "R$ 0",
                                period: "sempre gratuito",
                                description: "Perfeito para conhecer a plataforma",
                                features: [
                                    "1 crédito por mês",
                                    "Suporte básico",
                                ],
                                buttonVariant: "outline" as "accent" | "outline" | "link" | "default" | "destructive" | "secondary" | "ghost",
                                url: '/auth',
                                popular: false
                            },
                            {
                                name: "Básico",
                                price: "R$ 97",
                                period: "por mês",
                                description: "Ideal para advogados autônomos",
                                features: [
                                    "10 créditos por mês",
                                    "Suporte prioritário",
                                ],
                                buttonVariant: "accent" as "accent" | "outline" | "link" | "default" | "destructive" | "secondary" | "ghost",
                                url: '/subscribe?plan=basic',
                                popular: true
                            },
                            {
                                name: "Profissional",
                                price: "R$ 597",
                                period: "por ano",
                                description: "Para escritórios em crescimento",
                                features: [
                                    "120 créditos por ano",
                                    "Suporte dedicado",
                                ],
                                buttonVariant: "outline" as "accent" | "outline" | "link" | "default" | "destructive" | "secondary" | "ghost",
                                url: '/subscribe?plan=professional',
                                popular: false
                            }
                        ].map((plan, index) => (
                            <div key={index} className={`relative border rounded-2xl p-8 space-y-6 transition-all duration-300 hover:shadow-xl ${
                                plan.popular 
                                ? 'border-2 border-accent bg-accent/5 scale-105' 
                                : 'hover:border-primary/50'
                            }`}>
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="bg-gradient-to-r from-primary to-accent text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                                            <Star className="h-4 w-4 fill-current" />
                                            Mais Popular
                                        </span>
                                    </div>
                                )}
                                
                                <div className="text-center space-y-4">
                                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                                    <div className="flex items-baseline justify-center gap-2">
                                        <span className="text-5xl font-bold">{plan.price}</span>
                                        <span className="text-muted-foreground text-lg">{plan.period}</span>
                                    </div>
                                    <p className="text-muted-foreground font-medium">{plan.description}</p>
                                </div>
                                
                                <ul className="space-y-4">
                                    {plan.features.map((feature, featureIndex) => (
                                        <li key={featureIndex} className="flex items-start gap-3">
                                            <Check className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                                            <span className="text-sm leading-relaxed">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                
                                <Button 
                                    className={`w-full font-semibold py-3 text-base ${plan.popular ? 'bg-gradient-to-r from-primary to-accent hover:opacity-90' : ''}`}
                                    variant={plan.buttonVariant}
                                    onClick={() => navigate(plan.url)}
                                >
                                    {plan.name === "Gratuito" ? "Começar Gratuitamente" : "Assinar Agora"}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto text-center space-y-8">
                        <h2 className="text-3xl md:text-5xl font-bold">
                            Pronto para revolucionar sua análise jurídica?
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Junte-se a centenas de advogados que já economizam horas de trabalho tedioso 
                            e oferecem insights mais valiosos aos seus clientes.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" variant="accent" className="text-base font-semibold px-8 py-3 h-auto" 
                                    onClick={() => navigate("/auth?mode=signup")}>
                                <Zap className="mr-2 h-5 w-5" />
                                Começar Agora - É Gratuito
                            </Button>
                            <Button size="lg" variant="outline" className="text-base font-semibold px-8 py-3 h-auto"
                                    onClick={() => navigate("/auth")}>
                                Solicitar Demonstração
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Não é necessário cartão de crédito  •  Configuração em 2 minutos  • Suporte especializado
                        </p>
                    </div>
                </div>
            </section>

            <Footer/>
        </div>
    );
};

export default Landing;