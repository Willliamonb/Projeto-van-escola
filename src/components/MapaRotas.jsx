
import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/MapaRotas.css";

import {
  buscarEnderecoPorCoordenadas,
  buscarSugestoes,
  calcularRota,
  localizarEndereco,
} from "../services/mapaRotasService";

const PONTOS_INICIAIS = [
  {
    id: "partida",
    titulo: "Ponto de Partida / Garagem",
    icone: "fa-location-dot",
    endereco: "",
    numero: "",
    localizacao: null,
  },
  {
    id: "aluno1",
    titulo: "Aluno 1 (Endereço)",
    icone: "fa-child",
    endereco: "",
    numero: "",
    localizacao: null,
  },
  {
    id: "aluno2",
    titulo: "Aluno 2 (Endereço)",
    icone: "fa-child",
    endereco: "",
    numero: "",
    localizacao: null,
  },
  {
    id: "escola",
    titulo: "Escola / Destino Final",
    icone: "fa-school",
    endereco: "",
    numero: "",
    localizacao: null,
  },
];

function iconeMapa(texto, icone, van = false) {
  return L.divIcon({
    className: "",
    html: `<div class="lumio-map-pin ${
      van ? "lumio-map-pin--van" : ""
    }">
      <i class="fa-solid ${icone}"></i>
      <span>${texto}</span>
    </div>`,
    iconAnchor: [15, 30],
  });
}

export default function MapaRotas() {
  const elementoMapa = useRef(null);
  const mapaRef = useRef(null);
  const rotaRef = useRef(null);
  const marcadoresRef = useRef([]);
  const marcadorVanRef = useRef(null);
  const posicaoRef = useRef(null);
  const timersRef = useRef({});
  const ultimaBuscaRef = useRef({});

  const [pontos, setPontos] = useState(PONTOS_INICIAIS);
  const [sugestoes, setSugestoes] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [distancia, setDistancia] = useState(null);
  const [duracao, setDuracao] = useState(null);
  const [velocidade, setVelocidade] = useState(0);
  const [coordenadas, setCoordenadas] = useState(null);
  const [sequencia, setSequencia] = useState([]);
  const [quantidadeParadas, setQuantidadeParadas] = useState(0);

  // Inicialização do mapa.
  useEffect(() => {
    if (!elementoMapa.current || mapaRef.current) return;

    const mapa = L.map(elementoMapa.current, {
      zoomControl: false,
    }).setView([-23.5505, -46.6333], 12);

    mapaRef.current = mapa;

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }
    ).addTo(mapa);

    L.control.zoom({ position: "topright" }).addTo(mapa);

    const timer = setTimeout(() => mapa.invalidateSize(), 100);

    return () => {
      clearTimeout(timer);
      Object.values(timersRef.current).forEach(clearTimeout);
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Acompanhamento do GPS.
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const local = [lat, lng];

        posicaoRef.current = local;
        setCoordenadas({ lat, lng });

        setVelocidade(
          pos.coords.speed == null
            ? 0
            : Math.max(0, pos.coords.speed * 3.6)
        );

        const mapa = mapaRef.current;
        if (!mapa) return;

        if (!marcadorVanRef.current) {
          marcadorVanRef.current = L.marker(local, {
            icon: iconeMapa("Van", "fa-van-shuttle", true),
          }).addTo(mapa);

          mapa.setView(local, 15);

          buscarEnderecoPorCoordenadas(lat, lng)
            .then((endereco) => {
              setPontos((atuais) =>
                atuais.map((ponto, indice) =>
                  indice === 0 && !ponto.endereco
                    ? { ...ponto, endereco, localizacao: null }
                    : ponto
                )
              );
            })
            .catch((erro) => {
              console.warn("Não foi possível obter o endereço GPS:", erro);
            });
        } else {
          marcadorVanRef.current.setLatLng(local);
        }
      },
      (erro) => {
        console.warn("GPS indisponível:", erro.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Atualização do campo e busca de sugestões.
  const atualizarPonto = (id, campo, valor) => {
    if (campo === "endereco") {
      // Invalida qualquer busca anterior imediatamente.
      ultimaBuscaRef.current[id] = valor;
      clearTimeout(timersRef.current[id]);

      setPontos((atuais) =>
        atuais.map((ponto) =>
          ponto.id === id
            ? { ...ponto, endereco: valor, localizacao: null }
            : ponto
        )
      );

      setMensagem("");

      const termo = valor.trim();

      if (termo.replace(/\D/g, "").length === 8 || termo.length < 3) {
        setSugestoes((atuais) => ({ ...atuais, [id]: [] }));
        return;
      }

      timersRef.current[id] = setTimeout(async () => {
        try {
          const resultados = await buscarSugestoes(termo);

          // Não exibe resultados de uma pesquisa anterior.
          if (ultimaBuscaRef.current[id] !== valor) return;

          setSugestoes((atuais) => ({
            ...atuais,
            [id]: Array.isArray(resultados) ? resultados : [],
          }));
        } catch (erro) {
          if (ultimaBuscaRef.current[id] !== valor) return;

          console.warn("Erro ao buscar sugestões:", erro);

          setSugestoes((atuais) => ({ ...atuais, [id]: [] }));
        }
      }, 1000);

      return;
    }

    setPontos((atuais) =>
      atuais.map((ponto) =>
        ponto.id === id ? { ...ponto, [campo]: valor } : ponto
      )
    );
  };

  // Seleciona a sugestão e guarda suas coordenadas.
  const selecionarSugestao = (pontoId, item) => {
    const endereco =
      item.enderecoCompleto ||
      item.display_name ||
      item.nome ||
      "";

    const lat = Number(item.lat);
    const lng = Number(item.lng ?? item.lon);

    if (
      !endereco ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setMensagem("Não foi possível selecionar esse endereço. Tente outra sugestão.");
      return;
    }

    clearTimeout(timersRef.current[pontoId]);
    ultimaBuscaRef.current[pontoId] = endereco;

    setPontos((atuais) =>
      atuais.map((ponto) =>
        ponto.id === pontoId
          ? {
              ...ponto,
              endereco,
              localizacao: {
                lat,
                lng,
                displayName: endereco,
              },
            }
          : ponto
      )
    );

    setSugestoes((atuais) => ({ ...atuais, [pontoId]: [] }));
    setMensagem("");
  };

  const usarGpsNaPartida = useCallback(async () => {
    const posicao = posicaoRef.current;

    if (!posicao) {
      setMensagem("Aguardando autorização e sinal do GPS.");
      return;
    }

    try {
      const endereco = await buscarEnderecoPorCoordenadas(
        posicao[0],
        posicao[1]
      );

      setPontos((atuais) =>
        atuais.map((ponto, indice) =>
          indice === 0
            ? {
                ...ponto,
                endereco,
                localizacao: {
                  lat: posicao[0],
                  lng: posicao[1],
                  displayName: endereco,
                },
              }
            : ponto
        )
      );

      setSugestoes((atuais) => ({ ...atuais, partida: [] }));
      setMensagem("");
    } catch (erro) {
      setMensagem(
        erro.message || "Não foi possível obter o endereço GPS."
      );
    }
  }, []);

  const limparRota = () => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    if (rotaRef.current) {
      mapa.removeLayer(rotaRef.current);
      rotaRef.current = null;
    }

    marcadoresRef.current.forEach((marcador) =>
      mapa.removeLayer(marcador)
    );

    marcadoresRef.current = [];
  };

  // Gera a rota usando as coordenadas selecionadas sempre que disponíveis.
  const processarRotaInteligente = async () => {
    setMensagem("");

    const preenchidos = pontos.filter((ponto) =>
      ponto.endereco.trim()
    );

    if (!pontos[0].endereco.trim() || preenchidos.length < 2) {
      setMensagem("Preencha a partida e pelo menos um destino.");
      return;
    }

    setCarregando(true);
    limparRota();

    try {
      const localizacoes = [];

      for (const ponto of preenchidos) {
        let local;

        if (
          ponto.localizacao &&
          Number.isFinite(ponto.localizacao.lat) &&
          Number.isFinite(ponto.localizacao.lng)
        ) {
          // Usa as coordenadas da sugestão escolhida.
          local = ponto.localizacao;
        } else {
          // Se não houve seleção, procura o endereço normalmente.
          local = await localizarEndereco(
            ponto.endereco,
            ponto.numero
          );
        }

        localizacoes.push({
          ...local,
          id: ponto.id,
          titulo: ponto.titulo,
        });
      }

      const resultado = await calcularRota(localizacoes);
      const mapa = mapaRef.current;

      if (!mapa) return;

      rotaRef.current = L.geoJSON(
        {
          type: "Feature",
          geometry: resultado.geometria,
        },
        {
          style: {
            color: "#d97706",
            weight: 5,
            opacity: 0.85,
          },
        }
      ).addTo(mapa);

      const bounds = [];

      resultado.sequencia.forEach((ponto, indice) => {
        const local = [ponto.lat, ponto.lng];
        bounds.push(local);

        const marcador = L.marker(local, {
          icon: iconeMapa(
            `${indice + 1}. ${ponto.titulo}`,
            "fa-location-dot"
          ),
        }).addTo(mapa);

        marcadoresRef.current.push(marcador);
      });

      if (bounds.length) {
        mapa.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 15,
        });
      }

      setSequencia(resultado.sequencia);
      setDistancia(resultado.distanciaKm);
      setDuracao(resultado.duracaoMin);
      setQuantidadeParadas(resultado.sequencia.length);
    } catch (erro) {
      setMensagem(erro.message || "Erro ao calcular a rota.");
    } finally {
      setCarregando(false);
    }
  };

  const centralizarGPS = () => {
    if (posicaoRef.current && mapaRef.current) {
      mapaRef.current.setView(posicaoRef.current, 16, {
        animate: true,
      });
    } else {
      setMensagem("Aguardando sinal de GPS da van.");
    }
  };

  return (
    <div className="rotas-app">
      <header className="rotas-header">
        <div className="rotas-brand">
          <i className="fa-solid fa-van-shuttle" />
          <h1>
            Lumio <span>| Rotas</span>
          </h1>
        </div>

        <div className="rotas-user">
          <i className="fa-solid fa-circle-user" />
          <span>Minha Van</span>
        </div>
      </header>

      <main className="rotas-layout">
        <section className="rotas-mapa">
          <div className="rotas-mapa-canvas" ref={elementoMapa} />

          <div className="rotas-eta">
            <span>Tempo total estimado</span>
            <strong>
              {duracao == null ? "--" : `${Math.round(duracao)} min`}
            </strong>
          </div>

          <button
            type="button"
            className="rotas-gps-float"
            title="Minha localização"
            onClick={centralizarGPS}
          >
            <i className="fa-solid fa-location-crosshairs" />
          </button>
        </section>

        <aside className="rotas-sidebar">
          <div className="rotas-heading">
            <span className="rotas-badge">
              <i className="fa-solid fa-route" /> Otimizador de trajeto
            </span>

            <h2>Mapear alunos</h2>
            <p>
              Defina a partida, os endereços e os números das residências.
            </p>
          </div>

          <div className="rotas-form">
            {pontos.map((ponto, indice) => (
              <div className="rotas-field" key={ponto.id}>
                <label htmlFor={`endereco-${ponto.id}`}>
                  <i className={`fa-solid ${ponto.icone}`} />
                  {ponto.titulo}
                </label>

                <div className="rotas-input-row">
                  <div className="rotas-autocomplete">
                    <input
                      id={`endereco-${ponto.id}`}
                      type="text"
                      value={ponto.endereco}
                      placeholder={
                        indice === 3
                          ? "Endereço da escola..."
                          : "Digite rua, bairro, cidade ou CEP..."
                      }
                      autoComplete="off"
                      onChange={(e) =>
                        atualizarPonto(
                          ponto.id,
                          "endereco",
                          e.target.value
                        )
                      }
                      onFocus={() => setMensagem("")}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setSugestoes((atuais) => ({
                            ...atuais,
                            [ponto.id]: [],
                          }));
                        }
                      }}
                    />

                    {sugestoes[ponto.id]?.length > 0 && (
                      <div
                        className="rotas-sugestoes"
                        role="listbox"
                        aria-label={`Sugestões para ${ponto.titulo}`}
                      >
                        {sugestoes[ponto.id].map((item, index) => {
                          const nome =
                            item.enderecoCompleto ||
                            item.display_name ||
                            item.nome;

                          const chave =
                            item.id ??
                            item.place_id ??
                            `${ponto.id}-${index}`;

                          return (
                            <button
                              type="button"
                              role="option"
                              aria-selected="false"
                              key={chave}
                              onClick={() =>
                                selecionarSugestao(ponto.id, item)
                              }
                            >
                              <i className="fa-solid fa-location-dot" />
                              <span>{nome}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <input
                    className="rotas-numero"
                    type="text"
                    inputMode="numeric"
                    value={ponto.numero}
                    placeholder="Nº"
                    aria-label={`Número do endereço: ${ponto.titulo}`}
                    onChange={(e) =>
                      atualizarPonto(
                        ponto.id,
                        "numero",
                        e.target.value
                      )
                    }
                  />

                  {indice === 0 && (
                    <button
                      type="button"
                      className="rotas-gps-button"
                      onClick={usarGpsNaPartida}
                      title="Usar minha localização"
                    >
                      <i className="fa-solid fa-crosshairs" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              className="rotas-otimizar"
              onClick={processarRotaInteligente}
              disabled={carregando}
            >
              <i
                className={`fa-solid ${
                  carregando
                    ? "fa-spinner fa-spin"
                    : "fa-wand-magic-sparkles"
                }`}
              />

              {carregando
                ? "Calculando rota..."
                : "Gerar rota inteligente"}
            </button>

            {mensagem && (
              <p className="rotas-mensagem" role="alert">
                {mensagem}
              </p>
            )}
          </div>

          <hr className="rotas-divider" />

          <div className="rotas-telemetria">
            <div>
              <span>Distância total</span>
              <strong>
                {distancia == null
                  ? "-"
                  : `${distancia.toFixed(1)} km`}
              </strong>
            </div>

            <div>
              <span>Velocidade (GPS)</span>
              <strong>{velocidade.toFixed(1)} km/h</strong>
            </div>

            <div>
              <span>Paradas</span>
              <strong>{quantidadeParadas} endereços</strong>
            </div>

            <div>
              <span>Coordenadas</span>
              <strong>
                {coordenadas
                  ? `${coordenadas.lat.toFixed(4)}, ${coordenadas.lng.toFixed(4)}`
                  : "-, -"}
              </strong>
            </div>
          </div>

          <hr className="rotas-divider" />

          <h3 className="rotas-timeline-title">
            <i className="fa-solid fa-list-ol" /> Sequência otimizada de embarque
          </h3>

          <div className="rotas-timeline">
            {sequencia.length === 0 ? (
              <p className="rotas-vazio">
                Preencha os endereços acima para calcular a sequência.
              </p>
            ) : (
              sequencia.map((ponto, indice) => (
                <div
                  className="rotas-step"
                  key={`${ponto.id}-${indice}`}
                >
                  <span className="rotas-step-num">{indice + 1}</span>

                  <div>
                    <h4>{ponto.titulo}</h4>
                    <p>{ponto.displayName || ponto.endereco || "-"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}