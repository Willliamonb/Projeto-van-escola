import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
    console.log(`Servidor rodando em: http://localhost:${PORTA}`);
});