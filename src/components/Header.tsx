import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";

import { Settings, LogOut} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Header()
{
    const {user, handleLogout } = useUser();
    const navigate = useNavigate();

    if (!user) return null;

    return (
        <div className="flex items-center gap-4">
            <Badge variant="secondary" className="hidden sm:flex">
                {user.plan.toUpperCase()}&nbsp;-&nbsp;<span className="text-accent">{user.credits}</span>&nbsp;créditos
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
            </Button>
        </div>
    )
}