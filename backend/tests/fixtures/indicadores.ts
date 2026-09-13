export const camaraVotacoesResponseFixture = {
  dados: [
    {
      id: '2633410-8',
      uri: 'https://dadosabertos.camara.leg.br/api/v2/votacoes/2633410-8',
      data: '2026-06-17',
      dataHoraRegistro: '2026-06-17T20:05:07',
      siglaOrgao: 'PLEN',
      uriOrgao: 'https://dadosabertos.camara.leg.br/api/v2/orgaos/180',
      uriEvento: 'https://dadosabertos.camara.leg.br/api/v2/eventos/82555',
      proposicaoObjeto: 'REQ 3557/2026',
      uriProposicaoObjeto:
        'https://dadosabertos.camara.leg.br/api/v2/proposicoes/2633410',
      descricao: 'Aprovado o Requerimento de Urgência. Sim: 273; Não: 160.',
      aprovacao: 1,
    },
  ],
  links: [],
};

export const camaraVotosResponseFixture = {
  dados: [
    {
      tipoVoto: 'Sim',
      dataRegistroVoto: '2026-06-17T20:04:10',
      deputado_: {
        id: 204_379,
        uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/204379',
        nome: 'Deputado Fictício',
        siglaPartido: 'ABC',
        uriPartido: 'https://dadosabertos.camara.leg.br/api/v2/partidos/1',
        siglaUf: 'AC',
      },
    },
    {
      tipoVoto: 'Não',
      dataRegistroVoto: '2026-06-17T20:04:11',
      deputado_: {
        id: 999_001,
        uri: 'https://dadosabertos.camara.leg.br/api/v2/deputados/999001',
        nome: 'Outra Pessoa',
        siglaPartido: 'XYZ',
        uriPartido: 'https://dadosabertos.camara.leg.br/api/v2/partidos/2',
        siglaUf: 'SP',
      },
    },
  ],
  links: [],
};

export const camaraOrgaosResponseFixture = {
  dados: [
    {
      idOrgao: 2003,
      uriOrgao: 'https://dadosabertos.camara.leg.br/api/v2/orgaos/2003',
      siglaOrgao: 'CCJC',
      nomeOrgao: 'Comissão de Constituição e Justiça e de Cidadania',
      nomePublicacao: 'Comissão de Constituição e Justiça e de Cidadania',
      titulo: 'Titular',
      codTitulo: '101',
      dataInicio: '2026-03-05T00:00',
      dataFim: null,
    },
  ],
  links: [],
};

export const senadoVotacoesFixture = [
  {
    ano: 2026,
    casaSessao: 'SF',
    codigoMateria: 175_446,
    codigoSessao: 581_816,
    codigoSessaoVotacao: 7102,
    dataSessao: '2026-08-12',
    descricaoVotacao:
      'Votação nominal do Projeto de Lei Complementar nº 114, de 2026.',
    idProcesso: 9_095_355,
    identificacao: 'PLP 114/2026',
    resultadoVotacao: 'A',
    votacaoSecreta: 'N',
    votos: [
      {
        codigoParlamentar: 5672,
        descricaoVotoParlamentar: null,
        nomeParlamentar: 'Senador Fictício',
        siglaVotoParlamentar: 'Sim',
      },
    ],
  },
];

export const senadoComissoesResponseFixture = {
  MembroComissaoParlamentar: {
    Metadados: { VersaoServico: '5' },
    Parlamentar: {
      Codigo: '5672',
      Nome: 'Senador Fictício',
      MembroComissoes: {
        Comissao: [
          {
            IdentificacaoComissao: {
              CodigoComissao: '38',
              SiglaComissao: 'CAE',
              NomeComissao: 'Comissão de Assuntos Econômicos',
              SiglaCasaComissao: 'SF',
            },
            DescricaoParticipacao: 'Titular',
            DataInicio: '2025-11-26',
          },
        ],
      },
    },
  },
};
