export interface CamaraTheme {
  code: number;
  name: string;
}

// Catálogo oficial observado na API de Dados Abertos da Câmara.
export const CAMARA_THEMES: readonly CamaraTheme[] = Object.freeze([
  { code: 34, name: 'Administração Pública' },
  { code: 35, name: 'Arte, Cultura e Religião' },
  { code: 37, name: 'Comunicações' },
  { code: 39, name: 'Esporte e Lazer' },
  { code: 40, name: 'Economia' },
  { code: 41, name: 'Cidades e Desenvolvimento Urbano' },
  { code: 42, name: 'Direito Civil e Processual Civil' },
  { code: 43, name: 'Direito Penal e Processual Penal' },
  { code: 44, name: 'Direitos Humanos e Minorias' },
  { code: 46, name: 'Educação' },
  { code: 48, name: 'Meio Ambiente e Desenvolvimento Sustentável' },
  { code: 51, name: 'Estrutura Fundiária' },
  { code: 52, name: 'Previdência e Assistência Social' },
  { code: 53, name: 'Processo Legislativo e Atuação Parlamentar' },
  { code: 54, name: 'Energia, Recursos Hídricos e Minerais' },
  { code: 55, name: 'Relações Internacionais e Comércio Exterior' },
  { code: 56, name: 'Saúde' },
  { code: 57, name: 'Defesa e Segurança' },
  { code: 58, name: 'Trabalho e Emprego' },
  { code: 60, name: 'Turismo' },
  { code: 61, name: 'Viação, Transporte e Mobilidade' },
  { code: 62, name: 'Ciência, Tecnologia e Inovação' },
  { code: 64, name: 'Agricultura, Pecuária, Pesca e Extrativismo' },
  { code: 66, name: 'Indústria, Comércio e Serviços' },
  { code: 67, name: 'Direito e Defesa do Consumidor' },
  { code: 68, name: 'Direito Constitucional' },
  { code: 70, name: 'Finanças Públicas e Orçamento' },
  { code: 72, name: 'Homenagens e Datas Comemorativas' },
  { code: 74, name: 'Política, Partidos e Eleições' },
  { code: 76, name: 'Direito e Justiça' },
  { code: 85, name: 'Ciências Exatas e da Terra' },
  { code: 86, name: 'Ciências Sociais e Humanas' },
]);

const themesByCode = new Map(CAMARA_THEMES.map((theme) => [theme.code, theme]));

export function getCamaraTheme(code: number): CamaraTheme | undefined {
  return themesByCode.get(code);
}

export function isCamaraThemeCode(code: number): boolean {
  return themesByCode.has(code);
}
