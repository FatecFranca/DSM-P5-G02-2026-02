export const camaraDeputadoListItemFixture = {
  id: 999_001,
  uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/999001',
  nome: 'Deputada Fictícia',
  siglaPartido: 'ABC',
  uriPartido: 'https://dadosabertos.camara.leg.br/api/v2/partidos/999',
  siglaUf: 'SP',
  idLegislatura: 57,
  urlFoto: 'https://example.test/deputada-ficticia.jpg',
  email: 'deputada.ficticia@example.test',
};

export const camaraDeputadoDetailFixture = {
  id: 999_001,
  uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/999001',
  nomeCivil: 'NOME CIVIL FICTÍCIO',
  ultimoStatus: {
    id: 999_001,
    uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/999001',
    nome: 'Deputada Fictícia',
    siglaPartido: 'ABC',
    uriPartido: 'https://dadosabertos.camara.leg.br/api/v2/partidos/999',
    siglaUf: 'SP',
    idLegislatura: 57,
    urlFoto: 'https://example.test/deputada-ficticia.jpg',
    email: 'deputada.ficticia@example.test',
    data: '2026-01-01',
    nomeEleitoral: 'Deputada Fictícia',
    gabinete: {
      nome: '999',
      predio: '0',
      sala: '0',
      andar: '0',
      telefone: '0000-0000',
      email: 'gabinete.ficticio@example.test',
    },
    situacao: 'Exercício',
    condicaoEleitoral: 'Titular',
    descricaoStatus: '',
  },
  cpf: '00000000000',
  sexo: 'F',
  urlWebsite: null,
  redeSocial: [],
  dataNascimento: '1970-01-01',
  dataFalecimento: null,
  ufNascimento: 'SP',
  municipioNascimento: 'Município Fictício',
  escolaridade: 'Superior',
};

export const camaraListResponseFixture = {
  dados: [camaraDeputadoListItemFixture],
  links: [
    {
      rel: 'self',
      href: 'https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=2&itens=5',
    },
  ],
};

export const camaraDetailResponseFixture = {
  dados: camaraDeputadoDetailFixture,
  links: [
    {
      rel: 'self',
      href: 'https://dadosabertos.camara.leg.br/api/v2/deputados/999001',
    },
  ],
};

export const camaraProposicaoListItemFixture = {
  id: 2_256_735,
  uri: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/2256735',
  siglaTipo: 'PL',
  codTipo: 139,
  numero: 1234,
  ano: 2025,
  ementa: 'Dispõe sobre uma política pública fictícia.',
  dataApresentacao: '2025-03-10T10:30',
};

export const camaraProposicaoDetailFixture = {
  ...camaraProposicaoListItemFixture,
  descricaoTipo: 'Projeto de Lei',
  ementaDetalhada: 'Descrição detalhada fictícia da proposição.',
  statusProposicao: {
    dataHora: '2025-03-11T12:00',
    descricaoSituacao: 'Aguardando Despacho do Presidente da Câmara',
    codSituacao: 100,
  },
  urlInteiroTeor:
    'https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=999',
};

export const camaraProposicaoListResponseFixture = {
  dados: [camaraProposicaoListItemFixture],
  links: [
    {
      rel: 'self',
      href: 'https://dadosabertos.camara.leg.br/api/v2/proposicoes?ano=2025&pagina=1&itens=10',
    },
  ],
};

export const camaraProposicaoDetailResponseFixture = {
  dados: camaraProposicaoDetailFixture,
  links: [],
};

export const camaraProposicaoAutoresResponseFixture = {
  dados: [
    {
      uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/204379',
      nome: 'Deputado Fictício',
      codTipo: 10000,
      tipo: 'Deputado',
      ordemAssinatura: 1,
      proponente: 1,
    },
    {
      uri: null,
      nome: 'Poder Executivo',
      codTipo: 20000,
      tipo: 'Órgão do Poder Executivo',
      ordemAssinatura: 2,
      proponente: 0,
    },
  ],
  links: [],
};

export const camaraProposicaoTemasResponseFixture = {
  dados: [
    { codTema: 40, tema: 'Educação', relevancia: 1 },
    {
      codTema: 62,
      tema: 'Ciência, Tecnologia e Inovação',
      relevancia: 2,
    },
  ],
  links: [],
};
