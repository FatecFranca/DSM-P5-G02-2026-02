import { describe, expect, it } from 'vitest';

import {
  CAMARA_THEMES,
  getCamaraTheme,
} from '../../../src/modules/temas/camara-temas.catalog.js';

describe('catálogo temático da Câmara', () => {
  it('expõe os 32 temas oficiais com códigos e nomes únicos', () => {
    expect(CAMARA_THEMES).toHaveLength(32);
    expect(new Set(CAMARA_THEMES.map(({ code }) => code)).size).toBe(32);
    expect(new Set(CAMARA_THEMES.map(({ name }) => name)).size).toBe(32);
    expect(
      CAMARA_THEMES.every(({ code, name }) => code > 0 && name.length > 0),
    ).toBe(true);
  });

  it('explica todos os temas em linguagem cidadã com exemplos concretos', () => {
    expect(
      CAMARA_THEMES.every(
        ({ description, examples }) =>
          description.length >= 60 &&
          examples.length === 3 &&
          examples.every((example) => example.length >= 12),
      ),
    ).toBe(true);
  });

  it('preserva a taxonomia oficial sem confundir Economia e Educação', () => {
    expect(getCamaraTheme(40)).toMatchObject({ code: 40, name: 'Economia' });
    const education = getCamaraTheme(46);
    expect(education?.code).toBe(46);
    expect(education?.name).toBe('Educação');
    expect(education?.examples).toContain(
      'Financiamento de escolas e universidades',
    );
    expect(getCamaraTheme(999)).toBeUndefined();
  });
});
