import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import db from "../config/db.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ======================================================
// GERAR TOKEN JWT
// ======================================================

function gerarToken(usuario) {
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

        // Verifica se o email já existe
        const [usuarios] = await db.execute(
            "SELECT id FROM representante WHERE email = ?",
            [email]
        );

        if (usuarios.length > 0) {
            return res.status(409).json({
                mensagem: "Este email já está cadastrado."
            });
        }

        // Criptografa a senha
        const senhaHash = await bcrypt.hash(senha, 10);

        // Cadastra usuário
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
                nome,
                email,
                senhaHash,
                tipo_documento || null,
                documento || null,
                "user"
            ]
        );

        return res.status(201).json({
            mensagem: "Usuário cadastrado com sucesso.",
            usuario: {
                id: resultado.insertId,
                nome,
                email,
                role: "user"
            }
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
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensagem: "Email ou senha inválidos."
            });
        }

        const usuario = usuarios[0];

        // Verifica senha
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
// PERFIL
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

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const {
            sub: googleId,
            name,
            email,
            picture
        } = payload;

        if (!email) {
            return res.status(400).json({
                mensagem: "Não foi possível obter o email do Google."
            });
        }

        // Procura usuário pelo Google ID
        let [usuarios] = await db.execute(
            `
            SELECT
                id,
                nome,
                email,
                senha,
                google_id,
                foto,
                role
            FROM representante
            WHERE google_id = ?
            `,
            [googleId]
        );

        // Caso não encontre pelo Google ID,
        // procura pelo email
        if (usuarios.length === 0) {
            [usuarios] = await db.execute(
                `
                SELECT
                    id,
                    nome,
                    email,
                    senha,
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

        // ==============================================
        // USUÁRIO NÃO EXISTE → CADASTRAR
        // ==============================================

        if (usuarios.length === 0) {
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

            // ==========================================
            // USUÁRIO JÁ EXISTE
            // ==========================================

            usuario = usuarios[0];

            // Atualiza Google ID e foto se necessário
            await db.execute(
                `
                UPDATE representante
                SET
                    google_id = ?,
                    foto = ?
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
// ATUALIZAR ENDEREÇO
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

        // Verifica se já existe endereço
        const [enderecos] = await db.execute(
            `
            SELECT id
            FROM enderecos
            WHERE representante_id = ?
            `,
            [usuarioId]
        );

        if (enderecos.length > 0) {

            // Atualiza endereço existente
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

            // Cria novo endereço
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
            mensagem: "Endereço atualizado com sucesso."
        });

    } catch (erro) {
        console.error("Erro ao atualizar endereço:", erro);

        return res.status(500).json({
            mensagem: "Erro interno do servidor."
        });
    }
}

