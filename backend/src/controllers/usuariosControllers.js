
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import db from "../config/db.js";

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

// ======================================================
// GERAR TOKEN JWT
// ======================================================

function gerarToken(usuario) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET não configurado no .env");
    }

    return jwt.sign(
        {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            role: usuario.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "2h"
        }
    );
}

// ======================================================
// CADASTRAR USUÁRIO
// ======================================================

export async function cadastrarUsuario(req, res) {
    try {
        const {
            nome,
            email,
            senha,
            tipo_documento,
            documento
        } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({
                mensagem: "Nome, email e senha são obrigatórios."
            });
        }

        const [usuariosExistentes] = await db.execute(
            "SELECT id FROM representante WHERE email = ?",
            [email.trim()]
        );

        if (usuariosExistentes.length > 0) {
            return res.status(409).json({
                mensagem: "Este email já está cadastrado."
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const [resultado] = await db.execute(
            `
            INSERT INTO representante
            (
                nome,
                email,
                senha,
                tipo_documento,
                documento,
                role
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                nome.trim(),
                email.trim(),
                senhaHash,
                tipo_documento || null,
                documento || null,
                "user"
            ]
        );

        const usuario = {
            id: resultado.insertId,
            nome: nome.trim(),
            email: email.trim(),
            role: "user"
        };

        // Gera o token JWT após criar o usuário
        const token = gerarToken(usuario);

        return res.status(201).json({
            mensagem: "Usuário cadastrado com sucesso.",
            token,
            usuario
        });

    } catch (erro) {
        console.error("Erro ao cadastrar usuário:", erro);

        return res.status(500).json({
            mensagem: "Erro interno do servidor."
        });
    }
}

// ======================================================
// LOGIN
// ======================================================

export async function login(req, res) {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                mensagem: "Email e senha são obrigatórios."
            });
        }

        const [usuarios] = await db.execute(
            `
            SELECT
                id,
                nome,
                email,
                senha,
                tipo_documento,
                documento,
                foto,
                role
            FROM representante
            WHERE email = ?
            `,
            [email.trim()]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensagem: "Email ou senha inválidos."
            });
        }

        const usuario = usuarios[0];

        const senhaValida = await bcrypt.compare(
            senha,
            usuario.senha
        );

        if (!senhaValida) {
            return res.status(401).json({
                mensagem: "Email ou senha inválidos."
            });
        }

        const token = gerarToken(usuario);

        return res.status(200).json({
            mensagem: "Login realizado com sucesso.",
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                tipo_documento: usuario.tipo_documento,
                documento: usuario.documento,
                foto: usuario.foto,
                role: usuario.role
            }
        });

    } catch (erro) {
        console.error("Erro no login:", erro);

        return res.status(500).json({
            mensagem: "Erro interno do servidor."
        });
    }
}

// ======================================================
// BUSCAR PERFIL DO USUÁRIO
// ======================================================

export async function perfil(req, res) {
    try {
        const usuarioId = req.usuario.id;

        const [usuarios] = await db.execute(
            `
            SELECT
                id,
                nome,
                email,
                tipo_documento,
                documento,
                foto,
                role,
                criado_em,
                atualizado_em
            FROM representante
            WHERE id = ?
            `,
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: "Usuário não encontrado."
            });
        }

        return res.status(200).json({
            usuario: usuarios[0]
        });

    } catch (erro) {
        console.error("Erro ao buscar perfil:", erro);

        return res.status(500).json({
            mensagem: "Erro interno do servidor."
        });
    }
}

// ======================================================
// LOGIN COM GOOGLE
// ======================================================

export async function loginGoogle(req, res) {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                mensagem: "Credencial do Google não fornecida."
            });
        }

        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({
                mensagem: "GOOGLE_CLIENT_ID não configurado."
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            return res.status(400).json({
                mensagem: "Não foi possível obter os dados da conta Google."
            });
        }

        const {
            sub: googleId,
            name,
            email,
            picture,
            email_verified: emailVerificado
        } = payload;

        if (!emailVerificado) {
            return res.status(401).json({
                mensagem: "O email da conta Google não foi verificado."
            });
        }

        // Procura primeiro pelo identificador Google
        let [usuarios] = await db.execute(
            `
            SELECT
                id,
                nome,
                email,
                google_id,
                foto,
                role
            FROM representante
            WHERE google_id = ?
            `,
            [googleId]
        );

        // Se não encontrar, procura pelo email
        if (usuarios.length === 0) {
            [usuarios] = await db.execute(
                `
                SELECT
                    id,
                    nome,
                    email,
                    google_id,
                    foto,
                    role
                FROM representante
                WHERE email = ?
                `,
                [email]
            );
        }

        let usuario;

        if (usuarios.length === 0) {
            // Cria uma conta para o usuário Google
            const [resultado] = await db.execute(
                `
                INSERT INTO representante
                (
                    nome,
                    email,
                    senha,
                    google_id,
                    foto,
                    role
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    name || "Usuário Google",
                    email,
                    "",
                    googleId,
                    picture || null,
                    "user"
                ]
            );

            usuario = {
                id: resultado.insertId,
                nome: name || "Usuário Google",
                email,
                google_id: googleId,
                foto: picture || null,
                role: "user"
            };

        } else {
            usuario = usuarios[0];

            // Vincula a conta Google ao usuário existente
            await db.execute(
                `
                UPDATE representante
                SET google_id = ?, foto = ?
                WHERE id = ?
                `,
                [
                    googleId,
                    picture || usuario.foto || null,
                    usuario.id
                ]
            );

            usuario.google_id = googleId;
            usuario.foto = picture || usuario.foto || null;
        }

        const token = gerarToken(usuario);

        return res.status(200).json({
            mensagem: "Login com Google realizado com sucesso.",
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                foto: usuario.foto,
                role: usuario.role
            }
        });

    } catch (erro) {
        console.error("Erro no login com Google:", erro);

        return res.status(500).json({
            mensagem: "Erro ao realizar login com Google."
        });
    }
}

// ======================================================
// ATUALIZAR OU CADASTRAR ENDEREÇO
// ======================================================

export async function atualizarEndereco(req, res) {
    try {
        const usuarioId = req.usuario.id;

        const {
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            estado
        } = req.body;

        // Verifica se o usuário existe
        const [usuarios] = await db.execute(
            "SELECT id FROM representante WHERE id = ?",
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: "Usuário não encontrado."
            });
        }

        // Verifica se o usuário já possui endereço
        const [enderecos] = await db.execute(
            `
            SELECT id
            FROM enderecos
            WHERE representante_id = ?
            `,
            [usuarioId]
        );

        if (enderecos.length > 0) {
            // Atualiza o endereço existente
            await db.execute(
                `
                UPDATE enderecos
                SET
                    cep = ?,
                    logradouro = ?,
                    numero = ?,
                    complemento = ?,
                    bairro = ?,
                    cidade = ?,
                    estado = ?
                WHERE representante_id = ?
                `,
                [
                    cep || null,
                    logradouro || null,
                    numero || null,
                    complemento || null,
                    bairro || null,
                    cidade || null,
                    estado || null,
                    usuarioId
                ]
            );

        } else {
            // Insere um novo endereço
            await db.execute(
                `
                INSERT INTO enderecos
                (
                    representante_id,
                    cep,
                    logradouro,
                    numero,
                    complemento,
                    bairro,
                    cidade,
                    estado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    usuarioId,
                    cep || null,
                    logradouro || null,
                    numero || null,
                    complemento || null,
                    bairro || null,
                    cidade || null,
                    estado || null
                ]
            );
        }

        return res.status(200).json({
            mensagem: "Endereço salvo com sucesso."
        });

    } catch (erro) {
        console.error("Erro ao atualizar endereço:", erro);

        return res.status(500).json({
            mensagem: "Erro interno do servidor."
        });
    }
}