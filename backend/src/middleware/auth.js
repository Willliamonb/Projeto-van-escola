import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            mensagem: "Token não fornecido"
        });
    }

    const partes = authHeader.split(" ");

    if (partes.length !== 2 || partes[0] !== "Bearer") {
        return res.status(401).json({
            mensagem: "Formato do token inválido"
        });
    }

    const token = partes[1];

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err, usuarioDecodificado) => {
            if (err) {
                return res.status(403).json({
                    mensagem: "Token inválido ou expirado"
                });
            }

            req.usuario = usuarioDecodificado;

            next();
        }
    );
}

export default verificarToken;