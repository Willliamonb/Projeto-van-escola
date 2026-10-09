
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import Background from "../assets/Background.png";

import "./Login.css";
import Logo from "../assets/logo.svg";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ======================================================
  // LOGIN TRADICIONAL
  // ======================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (carregando) return;

    setCarregando(true);
    setMensagem("");
    setErro(false);

    try {
      const resposta = await fetch(`${API_URL}/usuarios/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          senha,
        }),
      });

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem || "Não foi possível realizar o login."
        );
      }

      if (!dados.token || !dados.usuario) {
        throw new Error(
          "O servidor não retornou os dados necessários para entrar."
        );
      }

      localStorage.setItem("@App:token", dados.token);
      localStorage.setItem(
        "@App:usuario",
        JSON.stringify(dados.usuario)
      );

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErro(true);

      setMensagem(
        error instanceof TypeError
          ? "Não foi possível conectar ao servidor. Verifique se o backend está funcionando."
          : error.message || "Ocorreu um erro ao realizar o login."
      );
    } finally {
      setCarregando(false);
    }
  };

  // ======================================================
  // LOGIN COM GOOGLE
  // ======================================================

  const handleGoogleSuccess = async (credentialResponse) => {
    if (carregando) return;

    setCarregando(true);
    setMensagem("");
    setErro(false);

    try {
      if (!credentialResponse.credential) {
        throw new Error("O Google não retornou a credencial.");
      }

      const resposta = await fetch(
        `${API_URL}/usuarios/login/google`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credential: credentialResponse.credential,
          }),
        }
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem || "Não foi possível entrar com o Google."
        );
      }

      if (!dados.token || !dados.usuario) {
        throw new Error(
          "O servidor não retornou os dados de autenticação."
        );
      }

      localStorage.setItem("@App:token", dados.token);
      localStorage.setItem(
        "@App:usuario",
        JSON.stringify(dados.usuario)
      );

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErro(true);

      setMensagem(
        error instanceof TypeError
          ? "Não foi possível conectar ao servidor. Verifique se o backend está funcionando."
          : error.message || "Erro ao entrar com o Google."
      );
    } finally {
      setCarregando(false);
    }
  };

  const handleGoogleError = () => {
    setErro(true);
    setMensagem("Não foi possível autenticar com o Google.");
  };

  return (
    <main
      className="lumio-login"
      style={{
        backgroundImage: `url(${Background})`,
      }}
    >
      <div className="lumio-login__overlay" />

      <section className="lumio-login__card">
        <div className="lumio-login__form-section">
          <div className="lumio-login__brand">
            <img
              src={Logo}
              alt="Lumio"
              className="lumio-login__logo"
            />
          </div>

          {location.state?.mensagem && (
            <p className="lumio-login__message" role="status">
              {location.state.mensagem}
            </p>
          )}

          {mensagem && (
            <p
              className={
                erro
                  ? "lumio-login__message lumio-login__message--error"
                  : "lumio-login__message"
              }
              role={erro ? "alert" : "status"}
            >
              {mensagem}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="lumio-login__form"
          >
            <div className="lumio-login__field">
              <label htmlFor="lumio-email">Email:</label>

              <input
                id="lumio-email"
                type="email"
                placeholder="Digite seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="lumio-login__field">
              <label htmlFor="lumio-password">Senha:</label>

              <input
                id="lumio-password"
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="lumio-login__submit"
              disabled={carregando}
            >
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="lumio-login__separator">
            <span className="lumio-login__separator-line" />
            <span className="lumio-login__separator-text">
              OU
            </span>
            <span className="lumio-login__separator-line" />
          </div>

          <div className="lumio-login__google">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text="continue_with"
              theme="outline"
              size="large"
              shape="rectangular"
              width="280"
              locale="pt_BR"
            />
          </div>

          {carregando && (
            <p className="lumio-login__loading" role="status">
              Autenticando, aguarde...
            </p>
          )}

          <p className="lumio-login__signup">
            Não possui uma conta?{" "}
            <Link to="/cadastro">Crie uma agora.</Link>
          </p>
        </div>

        <div className="lumio-login__panel-side" />
      </section>
    </main>
  );
}