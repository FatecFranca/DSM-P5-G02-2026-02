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

  it('preserva a taxonomia oficial sem confundir Economia e Educação', () => {
    expect(getCamaraTheme(40)).toEqual({ code: 40, name: 'Economia' });
    expect(getCamaraTheme(46)).toEqual({ code: 46, name: 'Educação' });
    expect(getCamaraTheme(999)).toBeUndefined();
  });
});
