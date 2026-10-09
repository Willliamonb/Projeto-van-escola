
const NOMINATIM = "https://nominatim.openstreetmap.org";
const VIACEP = "https://viacep.com.br/ws";
const OSRM = "https://router.project-osrm.org";

export async function buscarCep(cep) {
  const limpo = cep.replace(/\D/g, "");

  if (limpo.length !== 8) {
    throw new Error("Digite um CEP válido com 8 números.");
  }

  const resposta = await fetch(`${VIACEP}/${limpo}/json/`);
  if (!resposta.ok) throw new Error("Erro ao consultar o ViaCEP.");

  const dados = await resposta.json();
  if (dados.erro) throw new Error("CEP não encontrado.");

  return {
    endereco: [dados.logradouro, dados.bairro, dados.localidade, dados.uf]
      .filter(Boolean)
      .join(", "),
    cidade: dados.localidade,
    estado: dados.uf,
    bairro: dados.bairro,
    logradouro: dados.logradouro,
  };
}

export async function localizarEndereco(endereco, numero = "") {
  const termo = endereco.trim();
  if (!termo) throw new Error("Preencha um endereço.");

  const somenteNumeros = termo.replace(/\D/g, "");
  let consulta = termo;

  // Se o campo contiver um CEP, converte para endereço.
  if (somenteNumeros.length === 8) {
    const dadosCep = await buscarCep(somenteNumeros);
    consulta = dadosCep.endereco;
  }

  const consultas = [
    numero ? `${consulta}, ${numero}, Brasil` : `${consulta}, Brasil`,
    `${consulta}, Brasil`,
  ];

  for (const q of consultas) {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", q);
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("limit", "1");

    const resposta = await fetch(url);
    if (!resposta.ok) continue;

    const dados = await resposta.json();

    if (dados.length > 0) {
      return {
        lat: Number(dados[0].lat),
        lng: Number(dados[0].lon),
        displayName: dados[0].display_name,
      };
    }
  }

  throw new Error(`Endereço não localizado: ${termo}`);
}

export async function buscarSugestoes(endereco) {
  const termo = endereco.trim();
  if (termo.length < 3) return [];

  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", termo);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "5");

  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Erro ao buscar sugestões.");

  return resposta.json();
}

export async function buscarEnderecoPorCoordenadas(lat, lng) {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lng);

  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Não foi possível obter o endereço do GPS.");

  const dados = await resposta.json();
  return dados.display_name || `${lat}, ${lng}`;
}

export async function calcularRota(pontos) {
  if (pontos.length < 2) {
    throw new Error("Informe a partida e pelo menos um destino.");
  }

  const coordenadas = pontos
    .map((ponto) => `${ponto.lng},${ponto.lat}`)
    .join(";");

  const url =
    `${OSRM}/trip/v1/driving/${coordenadas}` +
    "?overview=full&geometries=geojson&source=first&roundtrip=false";

  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error("Não foi possível calcular a rota. Tente novamente.");
  }

  const dados = await resposta.json();

  if (dados.code !== "Ok" || !dados.trips?.length) {
    throw new Error("Não foi possível traçar a rota para esses endereços.");
  }

  // O OSRM informa a posição otimizada de cada ponto.
  const sequencia = dados.waypoints
    .map((waypoint, indiceOriginal) => ({
      ...pontos[indiceOriginal],
      ordem: waypoint.waypoint_index,
    }))
    .sort((a, b) => a.ordem - b.ordem);

  return {
    geometria: dados.trips[0].geometry,
    distanciaKm: dados.trips[0].distance / 1000,
    duracaoMin: dados.trips[0].duration / 60,
    sequencia,
  };
}