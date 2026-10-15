import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import "./Cadastro.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const FORMULARIO_INICIAL = {
  nome: "",
  email: "",
  senha: "",
  cpf: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

export default function Cadastro() {
  const [formData, setFormData] = useState(FORMULARIO_INICIAL);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  const navigate = useNavigate();
  
  const handleChange = (e) => {
    const { id, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [id]: id === "estado" ? value.toUpperCase() : value,
    }));

    setMensagem("");
    setErro(false);
  };

  
  const buscarCep = async (valor) => {
    const cepLimpo = valor.replace(/\D/g, '').slice(0, 8);

    setFormData((prev) => ({
      ...prev,
      cep: cepLimpo,
    }));

    setMensagem('');
    setErro(false);

    if (cepLimpo.length !== 8) {
      return;
    }

    try {
      const resposta = await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`
      );

      if (!resposta.ok) {
        throw new Error('Não foi possível consultar o CEP.');
      }

      const dados = await resposta.json();

      if (dados.erro) {
        setMensagem('CEP não encontrado. Confira os números digitados.');
        setErro(true);

        setFormData((prev) => ({
          ...prev,
          rua: '',
          bairro: '',
          cidade: '',
          estado: '',
        }));

        return;
      }

      setFormData((prev) => ({
        ...prev,
        rua: dados.logradouro || '',
        bairro: dados.bairro || '',
        cidade: dados.localidade || '',
        estado: (dados.uf || '').toUpperCase(),
      }));

    } catch (error) {
      console.error('Erro ao buscar CEP:', error);

      setMensagem(
        'Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.'
      );
      setErro(true);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (carregando) return;

    setCarregando(true);
    setMensagem("");
    setErro(false);

    try {
      // ETAPA 1: cadastrar o usuário
      const respostaCadastro = await fetch(`${API_URL}/usuarios/cadastrar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          email: formData.email.trim(),
          senha: formData.senha,
          tipo_documento: "CPF",
          documento: formData.cpf.replace(/\D/g, ""),
        }),
      });

      const dadosCadastro = await respostaCadastro.json().catch(() => ({}));

      if (!respostaCadastro.ok) {
        throw new Error(
          dadosCadastro.mensagem || "Não foi possível cadastrar o usuário.",
        );
      }

      const token = dadosCadastro.token;

      if (!token) {
        setErro(true);
        setMensagem(
          "O usuário foi cadastrado, mas o servidor não retornou o token de autenticação. Verifique a função cadastrarUsuario no backend.",
        );
        return;
      }

      // ETAPA 2: salvar o endereço
      const respostaEndereco = await fetch(`${API_URL}/usuarios/endereco`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cep: formData.cep.replace(/\D/g, ""),
          logradouro: formData.rua.trim(),
          numero: formData.numero.trim(),
          complemento: formData.complemento.trim(),
          bairro: formData.bairro.trim(),
          cidade: formData.cidade.trim(),
          estado: formData.estado.trim(),
        }),
      });

      const dadosEndereco = await respostaEndereco.json().catch(() => ({}));

      if (!respostaEndereco.ok) {
        setErro(true);
        setMensagem(
          `A conta foi criada, mas o endereço não foi salvo: ${
            dadosEndereco.mensagem || "Erro ao atualizar endereço."
          } Entre em contato com o suporte antes de tentar cadastrar novamente.`,
        );
        return;
      }

      // ETAPA 3: concluir o cadastro
      const emailCadastrado = formData.email.trim();

      setFormData({ ...FORMULARIO_INICIAL });

      navigate("/login", {
        state: {
          mensagem:
            "Cadastro realizado com sucesso. Faça login para continuar.",
          email: emailCadastrado,
        },
      });
    } catch (error) {
      setErro(true);

      setMensagem(
        error instanceof TypeError
          ? "Não foi possível conectar ao servidor. Verifique se o backend está funcionando."
          : error.message || "Ocorreu um erro ao realizar o cadastro.",
      );
    } finally {
      setCarregando(false);
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    if (carregando) return;

    setCarregando(true);
    setMensagem("");
    setErro(false);

    try {
      if (!credential) {
        throw new Error("O Google não retornou a credencial.");
      }

      const resposta = await fetch(`${API_URL}/usuarios/login/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential }),
      });

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem || "Não foi possível continuar com o Google.",
        );
      }

      if (!dados.token || !dados.usuario) {
        throw new Error("O servidor não retornou a autenticação.");
      }

      localStorage.setItem("@App:token", dados.token);
      localStorage.setItem("@App:usuario", JSON.stringify(dados.usuario));

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErro(true);
      setMensagem(
        error instanceof TypeError
          ? "Não foi possível conectar ao backend."
          : error.message || "Erro ao cadastrar com o Google.",
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="lumio-register">
      <section className="lumio-register__card">
        <header className="lumio-register__header">
          <div className="lumio-register__brand">
            <div className="lumio-register__logo-icon">🚌</div>

            <span className="lumio-register__logo-text">Lumio</span>
          </div>

          <h1 className="lumio-register__title">Cadastre-se</h1>

          <p className="lumio-register__subtitle">
            Preencha seus dados para criar sua conta.
          </p>
        </header>

        <form className="lumio-register__form" onSubmit={handleSubmit}>
          {mensagem && (
            <p
              className={`lumio-register__message ${
                erro
                  ? "lumio-register__message--error"
                  : "lumio-register__message--success"
              }`}
              role={erro ? "alert" : "status"}
            >
              {mensagem}
            </p>
          )}

          <div className="lumio-register__grid">
            <div className="lumio-register__column">
              <div className="lumio-register__field">
                <label htmlFor="nome">Nome completo:</label>

                <input
                  type="text"
                  id="nome"
                  placeholder="Seu nome completo"
                  value={formData.nome}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="lumio-register__field">
                <label htmlFor="email">E-mail:</label>

                <input
                  type="email"
                  id="email"
                  placeholder="nome@exemplo.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="lumio-register__field">
                <label htmlFor="senha">Senha:</label>

                <input
                  type="password"
                  id="senha"
                  placeholder="Crie uma senha segura"
                  value={formData.senha}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="lumio-register__field">
                <label htmlFor="cpf">CPF:</label>

                <input
                  type="text"
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={handleChange}
                  maxLength={14}
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            <div className="lumio-register__column">
              <div className="lumio-register__field">
                <label htmlFor="cep">CEP:</label>

                  <input
    type="text"
    id="cep"
    placeholder="00000-000"
    value={formData.cep}
    onChange={(e) => buscarCep(e.target.value)}
    maxLength={8}
    inputMode="numeric"
    autoComplete="postal-code"
    required
  />
              </div>

              <div className="lumio-register__row">
                <div className="lumio-register__field lumio-register__field--grow-2">
                  <label htmlFor="rua">Rua:</label>

                  <input
                    type="text"
                    id="rua"
                    placeholder="Nome da rua"
                    value={formData.rua}
                    onChange={handleChange}
                    autoComplete="address-line1"
                    required
                  />
                </div>

                <div className="lumio-register__field lumio-register__field--grow-1">
                  <label htmlFor="numero">Número:</label>

                  <input
                    type="text"
                    id="numero"
                    placeholder="Nº"
                    value={formData.numero}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="lumio-register__field">
                <label htmlFor="complemento">Complemento:</label>

                <input
                  type="text"
                  id="complemento"
                  placeholder="Apto, bloco, andar"
                  value={formData.complemento}
                  onChange={handleChange}
                  autoComplete="address-line2"
                />
              </div>

              <div className="lumio-register__field">
                <label htmlFor="bairro">Bairro:</label>

                <input
                  type="text"
                  id="bairro"
                  placeholder="Nome do bairro"
                  value={formData.bairro}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="lumio-register__address-bottom">
            <div className="lumio-register__row">
              <div className="lumio-register__field lumio-register__field--grow-3">
                <label htmlFor="cidade">Cidade:</label>

                <input
                  type="text"
                  id="cidade"
                  placeholder="Nome da cidade"
                  value={formData.cidade}
                  onChange={handleChange}
                  autoComplete="address-level2"
                  required
                />
              </div>

              <div className="lumio-register__field lumio-register__field--grow-1">
                <label htmlFor="estado">Estado:</label>

                <input
                  type="text"
                  id="estado"
                  placeholder="UF"
                  value={formData.estado}
                  onChange={handleChange}
                  maxLength={2}
                  autoComplete="address-level1"
                  className="lumio-register__input--center"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="lumio-register__submit"
              disabled={carregando}
            >
              {carregando ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </form>

        <div className="lumio-register__separator">
          <span className="lumio-register__separator-line" />
          <span className="lumio-register__separator-text">OU</span>
          <span className="lumio-register__separator-line" />
        </div>

        <footer className="lumio-register__footer">
          <div className="lumio-register__google-container">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setErro(true);
                setMensagem("Não foi possível autenticar com o Google.");
              }}
              type="icon"
              shape="circle"
              theme="outline"
              size="large"
              locale="pt_BR"
            />
          </div>

          <p className="lumio-register__login-redirect">
            Já possui uma conta? <Link to="/login">Faça login.</Link>
          </p>
        </footer>
      </section>
    </main>
  );
}
