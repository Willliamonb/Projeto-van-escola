-- ============================================================
-- BANCO DE DADOS
-- ============================================================

DROP DATABASE IF EXISTS Lumio;

CREATE DATABASE Lumio
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE Lumio;


-- ============================================================
-- REPRESENTANTE / USUÁRIO
-- ============================================================

DROP TABLE IF EXISTS representante;

CREATE TABLE representante (
    id INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,

    tipo_documento ENUM('CPF', 'CNPJ') NULL,
    documento VARCHAR(18) UNIQUE NULL,

    google_id VARCHAR(255) UNIQUE NULL,
    foto VARCHAR(500) NULL,

    role ENUM('admin', 'user', 'membro')
        NOT NULL DEFAULT 'user',

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


-- ============================================================
-- ESCOLA
-- ============================================================

DROP TABLE IF EXISTS escola;

CREATE TABLE escola (
    id INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(240) NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,

    cep VARCHAR(9) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),

    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado CHAR(2) NOT NULL,

    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


-- ============================================================
-- MOTORISTA
-- ============================================================

DROP TABLE IF EXISTS motorista;

CREATE TABLE motorista (
    id INT AUTO_INCREMENT PRIMARY KEY,

    representante_id INT NOT NULL,

    status ENUM(
        'ativo',
        'inativo',
        'bloqueado'
    ) NOT NULL DEFAULT 'ativo',

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_motorista_representante
        FOREIGN KEY (representante_id)
        REFERENCES representante(id)
        ON DELETE CASCADE
);


-- ============================================================
-- AUXILIAR
-- ============================================================

DROP TABLE IF EXISTS auxiliar;

CREATE TABLE auxiliar (
    id INT AUTO_INCREMENT PRIMARY KEY,

    representante_id INT NOT NULL,

    status ENUM(
        'ativo',
        'inativo',
        'bloqueado'
    ) NOT NULL DEFAULT 'ativo',

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_auxiliar_representante
        FOREIGN KEY (representante_id)
        REFERENCES representante(id)
        ON DELETE CASCADE
);


-- ============================================================
-- VAN
-- ============================================================

DROP TABLE IF EXISTS van;

CREATE TABLE van (
    id INT AUTO_INCREMENT PRIMARY KEY,

    motorista_id INT NOT NULL,

    placa CHAR(7) NOT NULL UNIQUE,

    identificacao VARCHAR(100),

    capacidade INT,

    tipo_combustivel ENUM(
        'gasolina',
        'etanol',
        'diesel',
        'flex',
        'eletrico',
        'gnv'
    ) NULL,

    consumo_medio DECIMAL(10, 2),

    status ENUM(
        'ativa',
        'inativa',
        'manutencao'
    ) NOT NULL DEFAULT 'ativa',

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_van_motorista
        FOREIGN KEY (motorista_id)
        REFERENCES motorista(id)
);


-- ============================================================
-- ALUNO
-- ============================================================

DROP TABLE IF EXISTS aluno;

CREATE TABLE aluno (
    id INT AUTO_INCREMENT PRIMARY KEY,

    van_id INT NOT NULL,
    escola_id INT NOT NULL,

    nome VARCHAR(120) NOT NULL,

    foto VARCHAR(500),

    data_nascimento DATE,

    turno ENUM(
        'matutino',
        'vespertino',
        'noturno',
        'integral'
    ) NOT NULL,

    observacoes VARCHAR(500),

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_aluno_escola
        FOREIGN KEY (escola_id)
        REFERENCES escola(id),

    CONSTRAINT fk_aluno_van
        FOREIGN KEY (van_id)
        REFERENCES van(id)
);


-- ============================================================
-- REPRESENTANTE DO ALUNO
-- ============================================================

DROP TABLE IF EXISTS representante_aluno;

CREATE TABLE representante_aluno (
    id INT AUTO_INCREMENT PRIMARY KEY,

    aluno_id INT NOT NULL,

    representante_id INT NOT NULL,

    tipo_relacao VARCHAR(120),

    principal BOOLEAN NOT NULL DEFAULT FALSE,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_representante_aluno_aluno
        FOREIGN KEY (aluno_id)
        REFERENCES aluno(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_representante_aluno_representante
        FOREIGN KEY (representante_id)
        REFERENCES representante(id)
        ON DELETE CASCADE
);


-- ============================================================
-- PONTOS DO ALUNO
-- ============================================================

DROP TABLE IF EXISTS pontos_aluno;

CREATE TABLE pontos_aluno (
    id INT AUTO_INCREMENT PRIMARY KEY,

    aluno_id INT NOT NULL,

    tipo ENUM(
        'embarque',
        'desembarque'
    ) NOT NULL DEFAULT 'embarque',

    cep VARCHAR(9) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),

    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado CHAR(2) NOT NULL,

    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    observacoes VARCHAR(500),

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_pontos_aluno
        FOREIGN KEY (aluno_id)
        REFERENCES aluno(id)
        ON DELETE CASCADE
);


-- ============================================================
-- ENDEREÇOS DO REPRESENTANTE
-- ============================================================

DROP TABLE IF EXISTS enderecos;

CREATE TABLE enderecos (
    id INT AUTO_INCREMENT PRIMARY KEY,

    representante_id INT NOT NULL,

    cep VARCHAR(9) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),

    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado CHAR(2) NOT NULL,

    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_endereco_representante
        FOREIGN KEY (representante_id)
        REFERENCES representante(id)
        ON DELETE CASCADE
);


-- ============================================================
-- VÍNCULO
-- ============================================================

DROP TABLE IF EXISTS vinculo;

CREATE TABLE vinculo (
    id INT AUTO_INCREMENT PRIMARY KEY,

    representante_id INT NOT NULL,
    auxiliar_id INT NOT NULL,
    aluno_id INT NOT NULL,
    van_id INT NOT NULL,
    escola_id INT NOT NULL,

    turno ENUM(
        'matutino',
        'vespertino',
        'noturno',
        'integral'
    ) NOT NULL,

    status ENUM(
        'pendente',
        'ativo',
        'encerrado',
        'cancelado'
    ) NOT NULL DEFAULT 'pendente',

    data_inicio DATE,
    data_fim DATE,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_vinculo_escola
        FOREIGN KEY (escola_id)
        REFERENCES escola(id),

    CONSTRAINT fk_vinculo_auxiliar
        FOREIGN KEY (auxiliar_id)
        REFERENCES auxiliar(id),

    CONSTRAINT fk_vinculo_representante
        FOREIGN KEY (representante_id)
        REFERENCES representante(id),

    CONSTRAINT fk_vinculo_aluno
        FOREIGN KEY (aluno_id)
        REFERENCES aluno(id),

    CONSTRAINT fk_vinculo_van
        FOREIGN KEY (van_id)
        REFERENCES van(id)
);


-- ============================================================
-- CONTRATO
-- ============================================================

DROP TABLE IF EXISTS contrato;

CREATE TABLE contrato (
    id INT AUTO_INCREMENT PRIMARY KEY,

    vinculo_id INT NOT NULL,

    arquivo VARCHAR(500),

    status ENUM(
        'aguardando_envio',
        'aguardando_confirmacao',
        'ativo',
        'encerrado',
        'vencido'
    ) NOT NULL DEFAULT 'aguardando_envio',

    data_envio DATETIME,
    data_confirmacao DATETIME,

    data_inicio DATE,
    data_fim DATE,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_contrato_vinculo
        FOREIGN KEY (vinculo_id)
        REFERENCES vinculo(id)
);


-- ============================================================
-- ROTAS
-- ============================================================

DROP TABLE IF EXISTS rotas;

CREATE TABLE rotas (
    id INT AUTO_INCREMENT PRIMARY KEY,

    van_id INT NOT NULL,

    nome VARCHAR(150) NOT NULL,

    tipo ENUM(
        'ida',
        'volta',
        'ida_volta'
    ) NOT NULL DEFAULT 'ida_volta',

    status ENUM(
        'ativa',
        'inativa'
    ) NOT NULL DEFAULT 'ativa',

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_rota_van
        FOREIGN KEY (van_id)
        REFERENCES van(id)
);


-- ============================================================
-- PARADAS DA ROTA
-- ============================================================

DROP TABLE IF EXISTS rota_parada;

CREATE TABLE rota_parada (
    id INT AUTO_INCREMENT PRIMARY KEY,

    aluno_id INT NOT NULL,

    ponto VARCHAR(255) NOT NULL,

    ordem INT NOT NULL,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rota_parada_aluno
        FOREIGN KEY (aluno_id)
        REFERENCES aluno(id)
        ON DELETE CASCADE
);


-- ============================================================
-- VIAGENS
-- ============================================================

DROP TABLE IF EXISTS viagens;

CREATE TABLE viagens (
    id INT AUTO_INCREMENT PRIMARY KEY,

    rota_id INT NOT NULL,
    van_id INT NOT NULL,
    motorista_id INT NOT NULL,

    tipo ENUM(
        'ida',
        'volta'
    ) NOT NULL,

    inicio DATETIME,
    fim DATETIME,

    status ENUM(
        'planejada',
        'em_andamento',
        'finalizada',
        'cancelada'
    ) NOT NULL DEFAULT 'planejada',

    distancia DECIMAL(10, 2),

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_viagem_rota
        FOREIGN KEY (rota_id)
        REFERENCES rotas(id),

    CONSTRAINT fk_viagem_van
        FOREIGN KEY (van_id)
        REFERENCES van(id),

    CONSTRAINT fk_viagem_motorista
        FOREIGN KEY (motorista_id)
        REFERENCES motorista(id)
);


-- ============================================================
-- ALUNOS DA VIAGEM
-- ============================================================

DROP TABLE IF EXISTS viagem_aluno;

CREATE TABLE viagem_aluno (
    id INT AUTO_INCREMENT PRIMARY KEY,

    viagem_id INT NOT NULL,

    aluno_id INT NOT NULL,

    status ENUM(
        'pendente',
        'embarcou',
        'desembarcou',
        'ausente'
    ) NOT NULL DEFAULT 'pendente',

    observacao VARCHAR(500),

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_viagem_aluno_viagem
        FOREIGN KEY (viagem_id)
        REFERENCES viagens(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_viagem_aluno_aluno
        FOREIGN KEY (aluno_id)
        REFERENCES aluno(id)
        ON DELETE CASCADE
);