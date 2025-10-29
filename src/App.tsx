import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Subscribe from "./pages/Subscribe";
import AppsHub from "./pages/AppsHub";
import Processes from "./pages/Processes";
import ProcessView from "./pages/ProcessView";
import NewProcess from "./pages/NewProcess";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => 
(
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/home" element={<Landing />} />
                    <Route path="/index" element={<Landing />} />
                    
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/subscribe" element={<Subscribe />} />

                    <Route path="/apps" element={<AppsHub />} />

                    <Route path="/apps/etics/processes" element={<Processes />} />
                    <Route path="/apps/etics/processes/:id" element={<ProcessView />} />
                    <Route path="/apps/etics/processes/new" element={<NewProcess />} />
                    <Route path="/apps/etics/admin" element={<Admin />} />

                    <Route path="/settings" element={<Settings />} />

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
);

export default App;