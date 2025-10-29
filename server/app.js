import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";

import configRoutes from "./routes/configRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import processRoutes from "./routes/processRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import emailRoutes from "./routes/emailRoutes.js"; 

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rotas públicas
app.use("/api/auth", authRoutes);

// Rotas autenticadas
app.use("/api/config", configRoutes);
app.use("/api/users", userRoutes);
app.use("/api/processes", processRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/plans", subscriptionRoutes);
app.use("/api/analyses", analysisRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/email", emailRoutes);

app.use(express.static(path.join(__dirname, "../dist")));

app.get(/.*/, (req, res) => { res.sendFile(path.join(__dirname, "../dist/index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor rodando na porta ${PORT}`); });