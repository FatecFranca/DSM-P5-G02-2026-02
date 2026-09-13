export const senadoMateriaListItemFixture = {
  id: 9_048_130,
  codigoMateria: 174_162,
  identificacao: 'INS 15/2026',
  ementa:
    'Sugere medidas relativas ao provimento de vagas de concurso público.',
  dataApresentacao: '2026-05-14',
  situacaoAtual: 'INDICAÇÃO ENCAMINHADA',
  autoria: 'Senador Fictício (ABC/AC)',
  urlDocumento:
    'https://legis.senado.gov.br/sdleg-getter/documento?dm=10223126',
};

export const senadoMateriaListFixture = [
  senadoMateriaListItemFixture,
  {
    ...senadoMateriaListItemFixture,
    id: 9_085_481,
    codigoMateria: 175_185,
    identificacao: 'INS 24/2026',
    dataApresentacao: '2026-07-15',
  },
];

export const senadoMateriaDetailFixture = {
  id: 9_048_130,
  codigoMateria: 174_162,
  identificacao: 'INS 15/2026',
  sigla: 'INS',
  descricaoSigla: 'Indicação',
  numero: '15',
  ano: 2026,
  conteudo: {
    id: 7_657_553,
    siglaTipo: 'INDICACAO_RISF',
    tipo: 'Indicação nos termos do art. 224 do RISF',
    ementa:
      'Sugere medidas relativas ao provimento de vagas de concurso público.',
    explicacaoEmenta: 'Explicação oficial fictícia para teste.',
  },
  documento: {
    id: 10_223_126,
    siglaTipo: 'INDICACAO',
    tipo: 'Indicação',
    dataApresentacao: '2026-05-14',
    url: 'https://legis.senado.gov.br/sdleg-getter/documento?dm=10223126',
    autoria: [
      {
        autor: 'Senador Fictício',
        siglaTipo: 'SENADOR',
        descricaoTipo: 'SENADOR',
        ordem: 1,
        codigoParlamentar: 5672,
        idEnte: 1,
      },
      {
        autor: 'Presidência da República',
        siglaTipo: 'PRESIDENTE_REPUBLICA',
        descricaoTipo: 'PRESIDENTE_REPUBLICA',
        ordem: 2,
        idEnte: 55_126,
      },
    ],
  },
  tramitando: 'Não',
  situacaoAtual: 'INDICAÇÃO ENCAMINHADA',
  siglaSituacaoAtual: 'INDENCAM',
  classificacoes: [
    {
      codigo: 33_808_942,
      descricao: 'Saúde',
      descricaoHierarquia: 'Política Social / Saúde',
    },
    {
      codigo: 33_809_423,
      descricao: 'Pessoas com Deficiência',
      descricaoHierarquia: 'Política Social / Pessoas com Deficiência',
    },
  ],
};

export const senadoMateriaWithoutThemesFixture = {
  ...senadoMateriaDetailFixture,
  id: 9_085_481,
  codigoMateria: 175_185,
  identificacao: 'INS 24/2026',
  numero: '24',
  documento: {
    ...senadoMateriaDetailFixture.documento,
    id: 10_278_323,
    dataApresentacao: '2026-07-15',
    autoria: [senadoMateriaDetailFixture.documento.autoria[0]],
  },
  classificacoes: [],
};
