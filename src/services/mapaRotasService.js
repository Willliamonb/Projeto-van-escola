
const NOMINATIM = "https://nominatim.openstreetmap.org";
const VIACEP = "https://viacep.com.br/ws";
const OSRM = "https://router.project-osrm.org";

// Faz requisições e identifica qual serviço apresentou erro.
async function fetchSeguro(url, servico) {
  let resposta;

  try {
    resposta = await fetch(url);
  } catch (erro) {
    console.error(`Falha de conexão com ${servico}:`, erro);

    throw new Error(
      `Não foi possível conectar ao ${servico}. Verifique sua conexão e tente novamente.`
    );
  }

  if (!resposta.ok) {
    console.error(
      `Erro HTTP no ${servico}:`,
      resposta.status,
      resposta.statusText
    );

    throw new Error(
      `${servico} retornou um erro (${resposta.status}). Tente novamente mais tarde.`
    );
  }

  return resposta;
}

// Consulta o endereço pelo CEP.
export async function buscarCep(cep) {
  const limpo = String(cep ?? "").replace(/\D/g, "");

  if (limpo.length !== 8) {
    throw new Error("Digite um CEP válido com 8 números.");
  }

  const url = `${VIACEP}/${limpo}/json/`;
  const resposta = await fetchSeguro(url, "ViaCEP");
  const dados = await resposta.json();

  if (dados.erro) {
    throw new Error("CEP não encontrado.");
  }

  return {
    endereco: [
      dados.logradouro,
      dados.bairro,
      dados.localidade,
      dados.uf,
    ]
      .filter(Boolean)
      .join(", "),
    cidade: dados.localidade,
    estado: dados.uf,
    bairro: dados.bairro,
    logradouro: dados.logradouro,
  };
}

// Pesquisa um endereço no Nominatim.
async function pesquisarEndereco(consulta, limite = 1) {
  const url = new URL(`${NOMINATIM}/search`);

  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", consulta);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", String(limite));

  const resposta = await fetchSeguro(url.toString(), "Nominatim");
  return resposta.json();
}

// Localiza um endereço ou CEP e retorna latitude e longitude.
export async function localizarEndereco(endereco, numero = "") {
  const termo = String(endereco ?? "").trim();

  if (!termo) {
    throw new Error("Preencha um endereço.");
  }

  const somenteNumeros = termo.replace(/\D/g, "");
  let consulta = termo;

  // Se o campo for um CEP, converte para endereço.
  if (somenteNumeros.length === 8) {
    const dadosCep = await buscarCep(somenteNumeros);

    consulta = dadosCep.endereco;

    if (!consulta) {
      throw new Error("Não foi possível obter o endereço desse CEP.");
    }
  }

  const consultas = [
    numero ? `${consulta}, ${numero}, Brasil` : `${consulta}, Brasil`,
  ];

  // Só tenta novamente sem o número se ele tiver sido informado.
  if (numero) {
    consultas.push(`${consulta}, Brasil`);
  }

  for (const busca of consultas) {
    const dados = await pesquisarEndereco(busca, 1);

    if (Array.isArray(dados) && dados.length > 0) {
      const lat = Number(dados[0].lat);
      const lng = Number(dados[0].lon);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          lat,
          lng,
          displayName: dados[0].display_name,
        };
      }
    }
  }

  throw new Error(`Endereço não localizado: ${termo}`);
}

// Busca sugestões de endereço para o autocomplete.
export async function buscarSugestoes(endereco) {
  const termo = String(endereco ?? "").trim();

  if (termo.length < 3) {
    return [];
  }

  const dados = await pesquisarEndereco(`${termo}, Brasil`, 5);

  if (!Array.isArray(dados)) {
    return [];
  }

  return dados;
}

// Converte as coordenadas do GPS em um endereço legível.
export async function buscarEnderecoPorCoordenadas(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    throw new Error("Coordenadas inválidas.");
  }

  const url = new URL(`${NOMINATIM}/reverse`);

  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));

  const resposta = await fetchSeguro(url.toString(), "Nominatim");
  const dados = await resposta.json();

  return dados.display_name || `${lat}, ${lng}`;
}

// Calcula a rota otimizada entre os pontos informados.
export async function calcularRota(pontos) {
  if (!Array.isArray(pontos) || pontos.length < 2) {
    throw new Error("Informe a partida e pelo menos um destino.");
  }

  // Valida as coordenadas antes de chamar o OSRM.
  for (const ponto of pontos) {
    if (
      !Number.isFinite(Number(ponto.lat)) ||
      !Number.isFinite(Number(ponto.lng))
    ) {
      throw new Error(
        `Coordenadas inválidas para o ponto: ${ponto.titulo || "sem nome"}.`
      );
    }
  }

  // O OSRM espera longitude,latitude.
  const coordenadas = pontos
    .map((ponto) => `${Number(ponto.lng)},${Number(ponto.lat)}`)
    .join(";");

  const url = new URL(
    `${OSRM}/trip/v1/driving/${coordenadas}`
  );

  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("source", "first");
  url.searchParams.set("roundtrip", "false");

  const resposta = await fetchSeguro(url.toString(), "OSRM");
  const dados = await resposta.json();

  if (dados.code !== "Ok" || !dados.trips?.length) {
    console.error("Resposta do OSRM:", dados);

    throw new Error(
      dados.message ||
        "Não foi possível traçar uma rota para esses endereços."
    );
  }

  // Reorganiza os pontos conforme a ordem otimizada pelo OSRM.
  const sequencia = (dados.waypoints || [])
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