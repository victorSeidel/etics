import { useNavigate, useSearchParams } from "react-router-dom";

interface LogoProps
{
    width?: number;
    height?: number;
}

export function Logo({ width, height }: LogoProps)
{
    const logoWidth = width ?? 200;
    const logoheight = height;

    const navigate = useNavigate();

    return (
        <img src="/logo.png" alt="Logo da ETICS Intelligence" width={logoWidth} onClick={() => navigate("/apps")} />
    )
}