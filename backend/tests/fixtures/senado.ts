export const senadoCurrentSenatorFixture = {
  IdentificacaoParlamentar: {
    CodigoParlamentar: '5672',
    CodigoPublicoNaLegAtual: '800',
    NomeParlamentar: 'Senadora Fictícia',
    NomeCompletoParlamentar: 'NOME COMPLETO FICTÍCIO',
    UrlFotoParlamentar:
      'http://www.senado.leg.br/senadores/img/fotos-oficiais/senador5672.jpg',
    SiglaPartidoParlamentar: 'ABC',
    UfParlamentar: 'AC',
  },
  Mandato: {
    CodigoMandato: '596',
    UfParlamentar: 'AC',
    DescricaoParticipacao: 'Titular',
    Exercicios: {
      Exercicio: [{ CodigoExercicio: '3028', DataInicio: '2023-02-01' }],
    },
  },
};

export const senadoCurrentSenatorsResponseFixture = {
  ListaParlamentarEmExercicio: {
    Metadados: {
      Versao: '06/09/2026 20:03:16',
      VersaoServico: '4',
      DataVersaoServico: '2020-07-15',
    },
    Parlamentares: {
      Parlamentar: [senadoCurrentSenatorFixture],
    },
  },
};
