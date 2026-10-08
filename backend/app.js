import express from "express";
import "dotenv/config";
import cors from "cors";

import usuarioRotas from "./src/routes/usuariosRotas.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.use("/api/usuarios", usuarioRotas);

// Rota de teste
app.get("/", (req, res) => {
    res.json({
        mensagem: "API Lumio funcionando!"
    });
});

export default app;