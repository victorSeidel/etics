import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { Settings, LogOut} from "lucide-react";

import { Logo } from "@/components/Logo"

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Header()
{
    const {user, handleLogout } = useUser();
    const navigate = useNavigate();

    if (!user) return null;

    return (
        <header className="border-b border-border bg-card">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/apps")}>
                        <Logo width={150} />
                    </div>
                    <nav className="hidden md:flex items-center gap-6">
                        <button
                            onClick={() => navigate("/apps/analise-de-processos/processes")}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                            Processos
                        </button>
                        {user.role === "admin" && (
                            <button
                            onClick={() => navigate("/apps/analise-de-processos/admin")}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                            Admin
                            </button>
                        )}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="hidden sm:flex cursor-pointer" onClick={() => navigate("/subscribe")}>
                        {user.plan.toUpperCase()}&nbsp;-&nbsp;<span className="text-accent">{user.credits}</span>&nbsp;créditos
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </header>
    )
}