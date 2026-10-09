
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Cadastro.css';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const FORMULARIO_INICIAL = {
  nome: '',
  email: '',
  senha: '',
  cpf: '',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

export default function Cadastro() {
  const [formData, setFormData] = useState(FORMULARIO_INICIAL);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { id, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [id]: id === 'estado' ? value.toUpperCase() : value,
    }));

    setMensagem('');
    setErro(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (carregando) return;

    setCarregando(true);
    setMensagem('');
    setErro(false);

    try {
      // ETAPA 1: cadastrar o usuário
      const respostaCadastro = await fetch(
        `${API_URL}/usuarios/cadastrar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nome: formData.nome.trim(),
            email: formData.email.trim(),
            senha: formData.senha,
            tipo_documento: 'CPF',
            documento: formData.cpf.replace(/\D/g, ''),
          }),
        }
      );

      const dadosCadastro = await respostaCadastro
        .json()
        .catch(() => ({}));

      if (!respostaCadastro.ok) {
        throw new Error(
          dadosCadastro.mensagem ||
            'Não foi possível cadastrar o usuário.'
        );
      }

      const token = dadosCadastro.token;

      if (!token) {
        setErro(true);
        setMensagem(
          'O usuário foi cadastrado, mas o servidor não retornou o token de autenticação. Verifique a função cadastrarUsuario no backend.'
        );
        return;
      }

      // ETAPA 2: salvar o endereço
      const respostaEndereco = await fetch(
        `${API_URL}/usuarios/endereco`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cep: formData.cep.replace(/\D/g, ''),
            logradouro: formData.rua.trim(),
            numero: formData.numero.trim(),
            complemento: formData.complemento.trim(),
            bairro: formData.bairro.trim(),
            cidade: formData.cidade.trim(),
            estado: formData.estado.trim(),
          }),
        }
      );

      const dadosEndereco = await respostaEndereco
        .json()
        .catch(() => ({}));

      if (!respostaEndereco.ok) {
        setErro(true);
        setMensagem(
          `A conta foi criada, mas o endereço não foi salvo: ${
            dadosEndereco.mensagem ||
            'Erro ao atualizar endereço.'
          } Entre em contato com o suporte antes de tentar cadastrar novamente.`
        );
        return;
      }

      // ETAPA 3: concluir o cadastro
      const emailCadastrado = formData.email.trim();

      setFormData({ ...FORMULARIO_INICIAL });

      navigate('/login', {
        state: {
          mensagem:
            'Cadastro realizado com sucesso. Faça login para continuar.',
          email: emailCadastrado,
        },
      });
    } catch (error) {
      setErro(true);

      setMensagem(
        error instanceof TypeError
          ? 'Não foi possível conectar ao servidor. Verifique se o backend está funcionando.'
          : error.message ||
              'Ocorreu um erro ao realizar o cadastro.'
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
            <div className="lumio-register__logo-icon">
              🚌
            </div>

            <span className="lumio-register__logo-text">
              Lumio
            </span>
          </div>

          <h1 className="lumio-register__title">
            Cadastre-se
          </h1>

          <p className="lumio-register__subtitle">
            Preencha seus dados para criar sua conta.
          </p>
        </header>

        <form
          className="lumio-register__form"
          onSubmit={handleSubmit}
        >
          {mensagem && (
            <p
              className={`lumio-register__message ${
                erro
                  ? 'lumio-register__message--error'
                  : 'lumio-register__message--success'
              }`}
              role={erro ? 'alert' : 'status'}
            >
              {mensagem}
            </p>
          )}

          <div className="lumio-register__grid">
            <div className="lumio-register__column">
              <div className="lumio-register__field">
                <label htmlFor="nome">
                  Nome completo:
                </label>

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
                  onChange={handleChange}
                  maxLength={9}
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
                <label htmlFor="complemento">
                  Complemento:
                </label>

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
              {carregando ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </div>
        </form>

        <div className="lumio-register__separator">
          <span className="lumio-register__separator-line" />
          <span className="lumio-register__separator-text">
            OU
          </span>
          <span className="lumio-register__separator-line" />
        </div>

        <footer className="lumio-register__footer">
          <button
            type="button"
            className="lumio-register__google"
            aria-label="Cadastrar com o Google"
            onClick={() => {
              setErro(true);
              setMensagem(
                'O cadastro com Google ainda não está conectado ao frontend.'
              );
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
          </button>

          <p className="lumio-register__login-redirect">
            Já possui uma conta? <Link to="/login">Faça login.</Link>
          </p>
        </footer>
      </section>
    </main>
  );
}