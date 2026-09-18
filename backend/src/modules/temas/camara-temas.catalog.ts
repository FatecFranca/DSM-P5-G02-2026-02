export interface CamaraTheme {
  code: number;
  name: string;
  description: string;
  examples: readonly [string, string, string];
}

// Catálogo oficial observado na API de Dados Abertos da Câmara.
// As descrições e os exemplos são conteúdo editorial do projeto em linguagem cidadã.
export const CAMARA_THEMES: readonly CamaraTheme[] = Object.freeze([
  {
    code: 34,
    name: 'Administração Pública',
    description:
      'Trata de como o Estado se organiza, presta serviços à população, administra seus órgãos e define regras para servidores e gestores públicos.',
    examples: [
      'Concursos e carreiras de servidores',
      'Transparência e acesso à informação',
      'Organização de ministérios e autarquias',
    ],
  },
  {
    code: 35,
    name: 'Arte, Cultura e Religião',
    description:
      'Abrange políticas de incentivo à cultura, proteção do patrimônio histórico, produção artística e garantia da liberdade de crença e culto.',
    examples: [
      'Financiamento de projetos culturais',
      'Proteção do patrimônio histórico',
      'Liberdade religiosa e locais de culto',
    ],
  },
  {
    code: 37,
    name: 'Comunicações',
    description:
      'Reúne regras e políticas para televisão, rádio, internet, telefonia, serviços postais e outros meios usados para transmitir informações.',
    examples: [
      'Concessões de rádio e televisão',
      'Acesso à internet e telefonia',
      'Regras para serviços postais',
    ],
  },
  {
    code: 39,
    name: 'Esporte e Lazer',
    description:
      'Trata do acesso ao esporte e ao lazer, do apoio a atletas e entidades esportivas e da organização de competições e espaços recreativos.',
    examples: [
      'Incentivo ao esporte de base',
      'Direitos e apoio a atletas',
      'Construção de espaços de lazer',
    ],
  },
  {
    code: 40,
    name: 'Economia',
    description:
      'Abrange medidas que afetam produção, preços, crédito, concorrência e desenvolvimento econômico, influenciando empresas e famílias.',
    examples: [
      'Acesso ao crédito e financiamento',
      'Defesa da concorrência econômica',
      'Programas de desenvolvimento regional',
    ],
  },
  {
    code: 41,
    name: 'Cidades e Desenvolvimento Urbano',
    description:
      'Trata do planejamento das cidades e das condições de vida urbana, incluindo moradia, saneamento, uso do solo e infraestrutura local.',
    examples: [
      'Habitação e regularização urbana',
      'Saneamento básico nas cidades',
      'Planejamento e uso do solo urbano',
    ],
  },
  {
    code: 42,
    name: 'Direito Civil e Processual Civil',
    description:
      'Reúne regras sobre relações privadas entre pessoas e empresas e sobre como conflitos civis são analisados e decididos pela Justiça.',
    examples: [
      'Contratos, dívidas e indenizações',
      'Família, herança e propriedade',
      'Prazos e procedimentos de processos civis',
    ],
  },
  {
    code: 43,
    name: 'Direito Penal e Processual Penal',
    description:
      'Trata da definição de crimes e penas e das regras para investigação, acusação, defesa, julgamento e cumprimento das decisões penais.',
    examples: [
      'Criação ou alteração de crimes e penas',
      'Regras de investigação criminal',
      'Julgamento e execução de penas',
    ],
  },
  {
    code: 44,
    name: 'Direitos Humanos e Minorias',
    description:
      'Abrange a proteção da dignidade, da igualdade e das liberdades, com atenção a grupos sujeitos a discriminação, violência ou exclusão.',
    examples: [
      'Combate à discriminação e à violência',
      'Direitos das pessoas com deficiência',
      'Proteção de povos e comunidades tradicionais',
    ],
  },
  {
    code: 46,
    name: 'Educação',
    description:
      'Trata das políticas públicas de ensino, formação profissional e acesso à aprendizagem, da educação básica ao ensino superior.',
    examples: [
      'Financiamento de escolas e universidades',
      'Formação e carreira de professores',
      'Acesso e permanência de estudantes',
    ],
  },
  {
    code: 48,
    name: 'Meio Ambiente e Desenvolvimento Sustentável',
    description:
      'Reúne medidas para proteger a natureza, controlar impactos ambientais e conciliar atividades econômicas com o uso responsável dos recursos.',
    examples: [
      'Proteção de florestas e biodiversidade',
      'Licenciamento e fiscalização ambiental',
      'Mudanças climáticas e redução de emissões',
    ],
  },
  {
    code: 51,
    name: 'Estrutura Fundiária',
    description:
      'Trata da posse, propriedade, distribuição e regularização de terras rurais, incluindo conflitos no campo e políticas de reforma agrária.',
    examples: [
      'Reforma agrária e assentamentos rurais',
      'Regularização de propriedades no campo',
      'Mediação de conflitos por terra',
    ],
  },
  {
    code: 52,
    name: 'Previdência e Assistência Social',
    description:
      'Abrange aposentadorias, pensões, benefícios e serviços destinados a proteger a renda e apoiar pessoas e famílias em situação de vulnerabilidade.',
    examples: [
      'Aposentadorias e pensões públicas',
      'Benefício de prestação continuada',
      'Serviços de assistência a famílias vulneráveis',
    ],
  },
  {
    code: 53,
    name: 'Processo Legislativo e Atuação Parlamentar',
    description:
      'Trata das regras de funcionamento do Congresso, da tramitação de propostas e dos direitos, deveres e instrumentos de atuação parlamentar.',
    examples: [
      'Tramitação e votação de projetos',
      'Funcionamento de comissões parlamentares',
      'Regras para mandatos e atividade legislativa',
    ],
  },
  {
    code: 54,
    name: 'Energia, Recursos Hídricos e Minerais',
    description:
      'Reúne políticas para produção e distribuição de energia, gestão das águas e exploração de petróleo, gás e recursos minerais.',
    examples: [
      'Tarifas e geração de energia elétrica',
      'Gestão de rios e reservatórios',
      'Mineração e exploração de petróleo e gás',
    ],
  },
  {
    code: 55,
    name: 'Relações Internacionais e Comércio Exterior',
    description:
      'Trata das relações do Brasil com outros países e organizações, incluindo acordos diplomáticos, importações, exportações e cooperação internacional.',
    examples: [
      'Tratados e acordos internacionais',
      'Regras de importação e exportação',
      'Cooperação diplomática entre países',
    ],
  },
  {
    code: 56,
    name: 'Saúde',
    description:
      'Abrange políticas de prevenção, atendimento e tratamento de doenças, organização do SUS, medicamentos e vigilância sanitária.',
    examples: [
      'Financiamento e atendimento pelo SUS',
      'Acesso a medicamentos e vacinas',
      'Prevenção e vigilância de doenças',
    ],
  },
  {
    code: 57,
    name: 'Defesa e Segurança',
    description:
      'Trata da defesa nacional, das Forças Armadas e das políticas de segurança pública, prevenção da violência e atuação das instituições policiais.',
    examples: [
      'Organização das Forças Armadas',
      'Políticas de segurança pública',
      'Prevenção da violência e do crime',
    ],
  },
  {
    code: 58,
    name: 'Trabalho e Emprego',
    description:
      'Reúne direitos e deveres nas relações de trabalho, políticas de geração de emprego, qualificação profissional e proteção de trabalhadores.',
    examples: [
      'Jornada, salário e condições de trabalho',
      'Geração de emprego e qualificação',
      'Proteção social de trabalhadores',
    ],
  },
  {
    code: 60,
    name: 'Turismo',
    description:
      'Trata de políticas para desenvolver destinos turísticos, apoiar o setor, qualificar serviços e preservar atrações culturais e naturais.',
    examples: [
      'Infraestrutura de destinos turísticos',
      'Regulação de serviços de turismo',
      'Promoção do turismo nacional',
    ],
  },
  {
    code: 61,
    name: 'Viação, Transporte e Mobilidade',
    description:
      'Abrange o deslocamento de pessoas e cargas por estradas, ferrovias, portos, aeroportos e sistemas de transporte público urbano.',
    examples: [
      'Transporte público e mobilidade urbana',
      'Rodovias, ferrovias, portos e aeroportos',
      'Segurança e fiscalização no trânsito',
    ],
  },
  {
    code: 62,
    name: 'Ciência, Tecnologia e Inovação',
    description:
      'Trata do apoio à pesquisa, desenvolvimento de novas tecnologias, transformação digital e regras para inovação científica e empresarial.',
    examples: [
      'Financiamento de pesquisa científica',
      'Inteligência artificial e transformação digital',
      'Incentivos a empresas inovadoras',
    ],
  },
  {
    code: 64,
    name: 'Agricultura, Pecuária, Pesca e Extrativismo',
    description:
      'Reúne políticas para produção rural, criação de animais, pesca e extração de recursos naturais, incluindo crédito, fiscalização e abastecimento.',
    examples: [
      'Crédito e seguro para produtores rurais',
      'Sanidade animal e vegetal',
      'Regras para pesca e extrativismo',
    ],
  },
  {
    code: 66,
    name: 'Indústria, Comércio e Serviços',
    description:
      'Trata das regras e incentivos para empresas que produzem bens, vendem produtos ou prestam serviços, incluindo competitividade e formalização.',
    examples: [
      'Incentivos à produção industrial',
      'Regras para comércio e prestação de serviços',
      'Apoio a pequenos negócios',
    ],
  },
  {
    code: 67,
    name: 'Direito e Defesa do Consumidor',
    description:
      'Abrange os direitos de quem compra produtos ou contrata serviços e as responsabilidades de fornecedores nas relações de consumo.',
    examples: [
      'Cobranças, contratos e cancelamentos',
      'Segurança e qualidade de produtos',
      'Fiscalização e reparação ao consumidor',
    ],
  },
  {
    code: 68,
    name: 'Direito Constitucional',
    description:
      'Trata das regras fundamentais do país, da organização dos poderes, do funcionamento da federação e dos direitos previstos na Constituição.',
    examples: [
      'Propostas de emenda à Constituição',
      'Competências da União, estados e municípios',
      'Direitos e garantias constitucionais',
    ],
  },
  {
    code: 70,
    name: 'Finanças Públicas e Orçamento',
    description:
      'Reúne decisões sobre como o governo arrecada, planeja, distribui e controla recursos públicos, além de regras fiscais e endividamento.',
    examples: [
      'Orçamento anual da União',
      'Controle de gastos e dívida pública',
      'Destinação de recursos para políticas públicas',
    ],
  },
  {
    code: 72,
    name: 'Homenagens e Datas Comemorativas',
    description:
      'Trata da criação de datas oficiais, títulos, nomes de espaços públicos e outras formas de reconhecimento de pessoas, fatos e causas.',
    examples: [
      'Criação de dias e semanas nacionais',
      'Concessão de títulos e homenagens',
      'Denominação de rodovias e prédios públicos',
    ],
  },
  {
    code: 74,
    name: 'Política, Partidos e Eleições',
    description:
      'Abrange as regras de eleições, partidos, campanhas, representação política e participação da população nas decisões democráticas.',
    examples: [
      'Financiamento e propaganda eleitoral',
      'Organização e funcionamento dos partidos',
      'Regras de votação e representação política',
    ],
  },
  {
    code: 76,
    name: 'Direito e Justiça',
    description:
      'Trata do funcionamento das instituições de Justiça, do acesso da população a seus direitos e da organização de carreiras e serviços jurídicos.',
    examples: [
      'Organização do Judiciário e do Ministério Público',
      'Acesso à Justiça e assistência jurídica',
      'Serviços de cartórios e profissões jurídicas',
    ],
  },
  {
    code: 85,
    name: 'Ciências Exatas e da Terra',
    description:
      'Reúne propostas relacionadas ao desenvolvimento, ensino e aplicação de áreas como matemática, física, química, geologia e ciências da Terra.',
    examples: [
      'Pesquisa em matemática, física e química',
      'Estudos geológicos e meteorológicos',
      'Formação e exercício de profissões científicas',
    ],
  },
  {
    code: 86,
    name: 'Ciências Sociais e Humanas',
    description:
      'Abrange propostas ligadas ao estudo da sociedade, da história, do comportamento e da cultura, além da formação e atuação nessas áreas.',
    examples: [
      'Pesquisa em história, sociologia e filosofia',
      'Formação em ciências humanas',
      'Regulação de profissões da área social',
    ],
  },
]);

const themesByCode = new Map(CAMARA_THEMES.map((theme) => [theme.code, theme]));

export function getCamaraTheme(code: number): CamaraTheme | undefined {
  return themesByCode.get(code);
}

export function isCamaraThemeCode(code: number): boolean {
  return themesByCode.has(code);
}
