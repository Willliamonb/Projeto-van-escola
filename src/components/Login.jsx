import { useState } from "react";
import "./Login.css";

import Logo from "../assets/logo.svg";
import Background from "../assets/background.png";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Login:", {
      email,
      senha,
    });
  };

  return (
    <main
      className="lumio-login"
      style={{
        backgroundImage: `url(${Background})`,
      }}
    >
      {/* Camada escura / diagonal sobre a imagem */}
      <div className="lumio-login__overlay" />

      {/* Card principal */}
      <section className="lumio-login__card">

        {/* Lado Esquerdo: Área do formulário */}
        <div className="lumio-login__form-section">

          {/* Logo */}
          <div className="lumio-login__brand">
            <img
              src={Logo}
              alt="Lumio"
              className="lumio-login__logo"
            />
          </div>

          {/* Formulário */}
          <form
            onSubmit={handleSubmit}
            className="lumio-login__form"
          >

            {/* E-mail */}
            <div className="lumio-login__field">
              <label htmlFor="lumio-email">
                Email:
              </label>

              <input
                id="lumio-email"
                type="email"
                placeholder="Digite seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Senha */}
            <div className="lumio-login__field">
              <label htmlFor="lumio-password">
                Senha:
              </label>

              <input
                id="lumio-password"
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              className="lumio-login__submit"
            >
              Entrar
            </button>
          </form>

          {/* Separador */}
          <div className="lumio-login__separator">
            <span className="lumio-login__separator-line" />
            <span className="lumio-login__separator-text">
              OU
            </span>
            <span className="lumio-login__separator-line" />
          </div>

          {/* Login com Google */}
          <button
            type="button"
            className="lumio-login__google"
          >
            <svg
              className="lumio-login__google-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>

            <span>
              Continue com o Google
            </span>
          </button>

          {/* Cadastro */}
          <p className="lumio-login__signup">
            Não possui uma conta?{" "}
            <a href="#signup">
              Crie uma agora.
            </a>
          </p>

        </div>

        {/* Lado Direito: Painel Azul Escuro interno */}
        <div className="lumio-login__panel-side" />

      </section>
    </main>
  );
}