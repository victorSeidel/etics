import { Logo } from "@/components/Logo"

export function Footer()
{
    return (
        <footer className="border-t border-border/40 bg-muted/10">
            <div className="container mx-auto px-6 py-16">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">

                    {/* Coluna 1 – Marca */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Logo />
                        </div>

                        <p className="text-sm text-muted-foreground italic">
                            IA para análise criminal
                        </p>

                        <div className="flex gap-4 pt-2">
                            {/* Coloque seus ícones reais aqui */}
                            <a href="#" className="text-muted-foreground hover:text-foreground transition">
                                <i className="ri-instagram-line text-xl" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-foreground transition">
                                <i className="ri-twitter-x-line text-xl" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-foreground transition">
                                <i className="ri-linkedin-fill text-xl" />
                            </a>
                        </div>
                    </div>

                    {/* Coluna 2 – Produto */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg">Produto</h4>

                        <ul className="space-y-2 text-muted-foreground text-sm">
                            <li><a href="#features" className="hover:text-foreground transition">Funcionalidades</a></li>
                            <li><a href="#pricing" className="hover:text-foreground transition">Planos e Preços</a></li>
                            <li><a href="#" className="hover:text-foreground transition">Atualizações (Changelog)</a></li>
                        </ul>
                    </div>

                    {/* Coluna 3 – Suporte */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg">Suporte</h4>

                        <ul className="space-y-2 text-muted-foreground text-sm">
                            <li><a href="#" className="hover:text-foreground transition">Central de Ajuda</a></li>
                            <li><a href="#" className="hover:text-foreground transition">Reportar Bug</a></li>
                            <li><a href="#" className="hover:text-foreground transition">Status do Servidor</a></li>
                        </ul>
                    </div>

                    {/* Coluna 4 – Legal */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg">Legal</h4>

                        <ul className="space-y-2 text-muted-foreground text-sm">
                            <li><a href="#" className="hover:text-foreground transition">Termos de Uso</a></li>
                            <li><a href="#" className="hover:text-foreground transition">Política de Privacidade</a></li>
                            <li><a href="#" className="hover:text-foreground transition">Cookies</a></li>
                        </ul>
                    </div>
                </div>

                {/* Linha de baixo */}
                <div className="border-t border-border/40 mt-12 pt-6 text-center text-sm text-muted-foreground">
                    © 2025 ETICS - Transformando a análise jurídica com inteligência artificial. <br />
                    A IA pode gerar imprecisões; a validação final das informações é indispensável.
                </div>

            </div>
        </footer>
    )
}