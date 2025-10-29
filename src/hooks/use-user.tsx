import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/types/user";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useUser()
{
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();

    useEffect(() =>
    {
        const token = localStorage.getItem("token");
        if (!token)
        {
            setLoading(false);
            navigate("/auth");
            return;
        }

        fetchUser(token);
    }, [navigate]);

    const fetchUser = async (token: string) =>
    {
        try
        {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok)
            {
                throw new Error("Token inválido");
            }

            const data = await response.json();
            setUser(data.user);
            setLoading(false);
        }
        catch (error)
        {
            console.error("Erro ao buscar usuário:", error);
            localStorage.removeItem("token");
            setLoading(false);
            navigate("/auth");
        }
    };

    const handleLogin = (token: string, userData: User) =>
    {
        localStorage.setItem("token", token);
        setUser(userData);
    };

    const handleLogout = async () =>
    {
        try
        {
            const token = localStorage.getItem("token");
            if (token)
            {
                await fetch(`${API_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }
        }
        catch (error)
        {
            console.error("Erro ao fazer logout:", error);
        }
        finally
        {
            localStorage.removeItem("token");
            setUser(null);
            navigate("/");
        }
    };

    const refreshUser = async () =>
    {
        const token = localStorage.getItem("token");
        if (token)
        {
            await fetchUser(token);
        }
    };

    const updateCredits = (newCredits: number) =>
    {
        if (user)
        {
            setUser({ ...user, credits: newCredits });
        }
    };

    return {
        API_URL,
        user,
        setUser,
        loading,
        handleLogin,
        handleLogout,
        refreshUser,
        updateCredits
    };
}