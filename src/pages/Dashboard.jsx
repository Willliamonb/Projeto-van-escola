
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Dashboard.css";

const API_MAPA = "https://nominatim.openstreetmap.org/search";
const API_ROTA = "https://router.project-osrm.org/trip/v1/driving";

const camposIniciais = [
  { id: "partida", titulo: "Ponto de partida / Garagem", endereco: "", numero: "", tipo: "partida" },
  { id: "aluno1", titulo: "Aluno 1", endereco: "", numero: "", tipo: "aluno" },
  { id: "aluno2", titulo: "Aluno 2", endereco: "", numero: "", tipo: "aluno" },
  { id: "escola", titulo: "Escola / Destino final", endereco: "", numero: "", tipo: "escola" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const mapaElemento = useRef(null);
  const mapaRef = useRef(null);
  const vanRef = useRef(null);
  const rotaRef = useRef(null);
  const marcadoresRef = useRef([]);
  const posicaoRef = useRef(null);
  const timerRef = useRef(null);

  const [usuario, setUsuario] = useState(null);
  const [campos, setCampos] = useState(camposIniciais);
  const [sugestoes, setSugestoes] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [distancia, setDistancia] = useState("-");
  const [tempo, setTempo] = useState("-- min");
  const [velocidade, setVelocidade] = useState(0);
  const [coordenadas, setCoordenadas] = useState("- , -");
  const [paradas, setParadas] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("@App:token");
    const usuarioSalvo = localStorage.getItem("@App:usuario");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setUsuario(JSON.parse(usuarioSalvo || "{}"));
    } catch {
      setUsuario({});
    }
  }, [navigate]);

  useEffect(() => {
    if (!mapaElemento.current || mapaRef.current) return;

    const mapa = L.map(mapaElemento.current, {
      zoomControl: false,
    }).setView([-23.5505, -46.6333], 12);

    mapaRef.current = mapa;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapa);

    L.control.zoom({ position: "topright" }).addTo(mapa);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setMensagem("Este navegador não oferece suporte à geolocalização.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const novaPosicao = [lat, lng];

        posicaoRef.current = novaPosicao;
        setCoordenadas(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setVelocidade(
          pos.coords.speed == null
            ? 0
            : Number((pos.coords.speed * 3.6).toFixed(1))
        );

        const mapa = mapaRef.current;
        if (!mapa) return;

        if (!vanRef.current) {
          const iconeVan = L.divIcon({
            className: "lumio-van-icon",
            html: '<div class="van-pin">🚐<span>Sua van</span></div>',
            iconSize: [90, 42],
            iconAnchor: [30, 20],
          });

          vanRef.current = L.marker(novaPosicao, { icon: iconeVan }).addTo(mapa);
          mapa.setView(novaPosicao, 14);
        } else {
          vanRef.current.setLatLng(novaPosicao);
        }
      },
      (erro) => {
        console.warn("Não foi possível obter o GPS:", erro.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  function atualizarCampo(id, propriedade, valor) {
    setCampos((atuais) =>
      atuais.map((campo) =>
        campo.id === id ? { ...campo, [propriedade]: valor } : campo
      )
    );
  }

  async function buscarSugestoes(campo, valor) {
    const consulta = valor.trim();
    const apenasNumeros = consulta.replace(/\D/g, "");

    if (timerRef.current) clearTimeout(timerRef.current);

    if (apenasNumeros.length === 8) {
      timerRef.current = setTimeout(async () => {
        try {
          const resposta = await fetch(
            `https://viacep.com.br/ws/${apenasNumeros}/json/`
          );
          const dados = await resposta.json();

          if (!dados.erro) {
            const endereco = [
              dados.logradouro,
              dados.bairro,
              dados.localidade,
              dados.uf,
            ].filter(Boolean).join(", ");

            setSugestoes((atuais) => ({
              ...atuais,
              [campo.id]: [{ display_name: endereco }],
            }));
          }
        } catch {
          setSugestoes((atuais) => ({ ...atuais, [campo.id]: [] }));
        }
      }, 250);
      return;
    }

    if (consulta.length < 3) {
      setSugestoes((atuais) => ({ ...atuais, [campo.id]: [] }));
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const url = `${API_MAPA}?format=jsonv2&addressdetails=1&countrycodes=br&limit=5&q=${encodeURIComponent(consulta)}`;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("Falha na busca de endereços.");

        const dados = await resposta.json();
        setSugestoes((atuais) => ({ ...atuais, [campo.id]: dados }));
      } catch {
        setSugestoes((atuais) => ({ ...atuais, [campo.id]: [] }));
      }
    }, 500);
  }

  async function localizarEndereco(campo) {
    const termo = `${campo.endereco.trim()}${campo.numero.trim() ? `, ${campo.numero.trim()}` : ""}`;

    if (!campo.endereco.trim()) {
      throw new Error(`Preencha o endereço: ${campo.titulo}.`);
    }

    const url = `${API_MAPA}?format=jsonv2&countrycodes=br&limit=1&q=${encodeURIComponent(termo)}`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
      throw new Error("Não foi possível consultar o serviço de endereços.");
    }

    const dados = await resposta.json();

    if (!dados.length) {
      throw new Error(`Endereço não encontrado: ${termo}`);
    }

    return {
      lat: Number(dados[0].lat),
      lng: Number(dados[0].lon),
      nome: campo.titulo,
      endereco: dados[0].display_name,
      tipo: campo.tipo,
    };
  }

  async function usarGPSNaPartida() {
    const posicao = posicaoRef.current;

    if (!posicao) {
      setMensagem("Aguardando sinal do GPS. Permita o acesso à localização no navegador.");
      return;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${posicao[0]}&lon=${posicao[1]}`;
      const resposta = await fetch(url);
      const dados = await resposta.json();

      const endereco = dados.display_name || `${posicao[0]}, ${posicao[1]}`;

      setCampos((atuais) =>
        atuais.map((campo) =>
          campo.id === "partida" ? { ...campo, endereco, numero: "" } : campo
        )
      );

      mapaRef.current?.setView(posicao, 16);
      setMensagem("");
    } catch {
      setMensagem("Não foi possível converter sua localização em endereço.");
    }
  }

  function centralizarGPS() {
    if (posicaoRef.current) {
      mapaRef.current?.setView(posicaoRef.current, 16, { animate: true });
    } else {
      setMensagem("Aguardando sinal do GPS da van.");
    }
  }

  function limparRota() {
    const mapa = mapaRef.current;
    if (!mapa) return;

    if (rotaRef.current) {
      mapa.removeLayer(rotaRef.current);
      rotaRef.current = null;
    }

    marcadoresRef.current.forEach((marcador) => mapa.removeLayer(marcador));
    marcadoresRef.current = [];
  }

  async function gerarRota() {
    const preenchidos = campos.filter((campo) => campo.endereco.trim());

    if (preenchidos.length < 2) {
      setMensagem("Preencha o ponto de partida e pelo menos mais um endereço.");
      return;
    }

    if (!preenchidos.some((campo) => campo.id === "partida")) {
      setMensagem("Informe o ponto de partida da van.");
      return;
    }

    setCarregando(true);
    setMensagem("");
    limparRota();
    setParadas([]);

    try {
      const localizacoes = [];

      for (const campo of preenchidos) {
        localizacoes.push(await localizarEndereco(campo));
      }

      const coordenadasRota = localizacoes
        .map((ponto) => `${ponto.lng},${ponto.lat}`)
        .join(";");

      const url = `${API_ROTA}/${coordenadasRota}?overview=full&geometries=geojson&source=first&roundtrip=false&destination=last`;

      let resposta = await fetch(url);

      if (!resposta.ok) {
        throw new Error("O serviço de rotas está indisponível. Tente novamente.");
      }

      const dados = await resposta.json();

      if (dados.code !== "Ok" || !dados.trips?.length) {
        throw new Error("Não foi possível calcular a rota para esses endereços.");
      }

      const trip = dados.trips[0];
      const mapa = mapaRef.current;

      rotaRef.current = L.geoJSON(
        { type: "Feature", geometry: trip.geometry },
        { style: { color: "#d97706", weight: 5, opacity: 0.9 } }
      ).addTo(mapa);

      const ordem = dados.waypoints
        .map((waypoint, indiceOriginal) => ({
          ordem: waypoint.waypoint_index,
          ponto: localizacoes[indiceOriginal],
        }))
        .sort((a, b) => a.ordem - b.ordem)
        .map((item) => item.ponto);

      ordem.forEach((ponto, indice) => {
        const numero = indice + 1;

        const marcador = L.marker([ponto.lat, ponto.lng], {
          icon: L.divIcon({
            className: "lumio-stop-icon",
            html: `<div class="stop-pin">${numero}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        }).addTo(mapa);

        marcador.bindPopup(
          `<strong>${numero}. ${ponto.nome}</strong><br>${ponto.endereco}`
        );

        marcadoresRef.current.push(marcador);
      });

      const limites = L.latLngBounds(
        ordem.map((ponto) => [ponto.lat, ponto.lng])
      );

      mapa.fitBounds(limites, { padding: [45, 45] });

      setDistancia(`${(trip.distance / 1000).toFixed(1)} km`);
      setTempo(`${Math.round(trip.duration / 60)} min`);
      setParadas(ordem);
    } catch (erro) {
      setMensagem(erro.message || "Erro ao gerar a rota.");
    } finally {
      setCarregando(false);
    }
  }

  function sair() {
    localStorage.removeItem("@App:token");
    localStorage.removeItem("@App:usuario");
    navigate("/login", { replace: true });
  }

  return (
    <div className="lumio-dashboard">
      <header className="lumio-header">
        <div className="lumio-brand">
          <span className="lumio-brand-icon">🚐</span>
          <div>
            <strong>Lumio</strong>
            <small>Rotas inteligentes</small>
          </div>
        </div>

        <div className="lumio-user">
          <div className="lumio-avatar">
            {usuario?.foto ? (
              <img src={usuario.foto} alt="" />
            ) : (
              (usuario?.nome || usuario?.email || "U").charAt(0).toUpperCase()
            )}
          </div>
          <div className="lumio-user-info">
            <strong>{usuario?.nome || "Minha conta"}</strong>
            <small>Transportador escolar</small>
          </div>
          <button className="lumio-logout" onClick={sair}>Sair</button>
        </div>
      </header>

      <main className="lumio-main">
        <section className="lumio-map-section">
          <div ref={mapaElemento} className="lumio-map" />

          <div className="lumio-eta-card">
            <span>Tempo estimado</span>
            <strong>{tempo}</strong>
            <small>da rota calculada</small>
          </div>

          <button
            className="lumio-location-button"
            onClick={centralizarGPS}
            title="Centralizar minha localização"
          >
            ◎
          </button>
        </section>

        <aside className="lumio-sidebar">
          <div className="lumio-panel-heading">
            <span className="lumio-badge">✦ OTIMIZADOR DE TRAJETO</span>
            <h1>Mapear alunos</h1>
            <p>Organize os endereços e planeje a rota da van escolar.</p>
          </div>

          {mensagem && <div className="lumio-alert">{mensagem}</div>}

          <div className="lumio-address-list">
            {campos.map((campo, indice) => (
              <div className="lumio-field" key={campo.id}>
                <label htmlFor={`endereco-${campo.id}`}>
                  <span className={`lumio-field-number ${campo.tipo}`}>
                    {campo.tipo === "partida" ? "↗" : campo.tipo === "escola" ? "⌂" : indice}
                  </span>
                  {campo.titulo}
                </label>

                <div className="lumio-address-row">
                  <div className="lumio-autocomplete">
                    <input
                      id={`endereco-${campo.id}`}
                      type="text"
                      value={campo.endereco}
                      placeholder="Digite endereço ou CEP"
                      autoComplete="off"
                      onChange={(e) => {
                        atualizarCampo(campo.id, "endereco", e.target.value);
                        buscarSugestoes(campo, e.target.value);
                      }}
                    />

                    {!!sugestoes[campo.id]?.length && (
                      <div className="lumio-suggestions">
                        {sugestoes[campo.id].map((item, indiceSugestao) => (
                          <button
                            type="button"
                            key={`${campo.id}-${indiceSugestao}`}
                            onClick={() => {
                              atualizarCampo(campo.id, "endereco", item.display_name);
                              setSugestoes((atuais) => ({ ...atuais, [campo.id]: [] }));
                            }}
                          >
                            {item.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    className="lumio-number-input"
                    type="text"
                    value={campo.numero}
                    placeholder="Nº"
                    aria-label={`Número do endereço de ${campo.titulo}`}
                    onChange={(e) => atualizarCampo(campo.id, "numero", e.target.value)}
                  />

                  {campo.id === "partida" && (
                    <button
                      className="lumio-gps-button"
                      type="button"
                      title="Usar GPS como partida"
                      onClick={usarGPSNaPartida}
                    >
                      ◎
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            className="lumio-route-button"
            onClick={gerarRota}
            disabled={carregando}
          >
            {carregando ? "Calculando rota..." : "✦ Gerar rota inteligente"}
          </button>

          <div className="lumio-metrics">
            <div>
              <span>Distância total</span>
              <strong>{distancia}</strong>
            </div>
            <div>
              <span>Velocidade GPS</span>
              <strong>{velocidade} km/h</strong>
            </div>
            <div>
              <span>Endereços</span>
              <strong>{paradas.length || 0}</strong>
            </div>
            <div>
              <span>Coordenadas GPS</span>
              <strong>{coordenadas}</strong>
            </div>
          </div>

          <section className="lumio-timeline-section">
            <h2>☷ Sequência de paradas</h2>

            {paradas.length === 0 ? (
              <p className="lumio-empty">
                Preencha os endereços e gere a rota para ver a sequência de paradas.
              </p>
            ) : (
              <ol className="lumio-timeline">
                {paradas.map((parada, indice) => (
                  <li key={`${parada.nome}-${indice}`}>
                    <span>{indice + 1}</span>
                    <div>
                      <strong>{parada.nome}</strong>
                      <small>{parada.endereco}</small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="lumio-map-credit">
            Mapas © OpenStreetMap · Rotas calculadas por OSRM
          </p>
        </aside>
      </main>
    </div>
  );
}