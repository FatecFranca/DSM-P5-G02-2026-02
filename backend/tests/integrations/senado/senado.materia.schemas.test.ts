import { describe, expect, it } from 'vitest';

import {
  senadoMateriaDetailSchema,
  senadoMateriaListResponseSchema,
} from '../../../src/integrations/senado/senado.schemas.js';
import {
  senadoMateriaDetailFixture,
  senadoMateriaListFixture,
} from '../../fixtures/senado-materias.js';

describe('schemas de matérias do Senado', () => {
  it('aceita listagem válida e normaliza identificadores', () => {
    const result = senadoMateriaListResponseSchema.parse(
      senadoMateriaListFixture,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(9_048_130);
  });

  it('aceita detalhe completo com múltiplos autores e temas', () => {
    const result = senadoMateriaDetailSchema.parse(senadoMateriaDetailFixture);

    expect(result.documento.autoria).toHaveLength(2);
    expect(result.classificacoes).toHaveLength(2);
    expect(result.documento.autoria[0]?.codigoParlamentar).toBe(5672);
  });

  it('aceita campos opcionais, autoria e temas ausentes', () => {
    const result = senadoMateriaDetailSchema.parse({
      id: '9048130',
      sigla: 'INS',
      numero: '15',
      ano: '2026',
      conteudo: {},
      documento: {},
    });

    expect(result.id).toBe(9_048_130);
    expect(result.numero).toBe(15);
    expect(result.ano).toBe(2026);
    expect(result.documento.autoria).toEqual([]);
    expect(result.classificacoes).toEqual([]);
  });

  it('aceita autoria da iniciativa quando fornecida separadamente', () => {
    const result = senadoMateriaDetailSchema.parse({
      ...senadoMateriaDetailFixture,
      autoriaIniciativa: [senadoMateriaDetailFixture.documento.autoria[0]],
    });

    expect(result.autoriaIniciativa).toHaveLength(1);
    expect(result.autoriaIniciativa[0]?.codigoParlamentar).toBe(5672);
  });

  it.each([
    [{ id: 'inválido' }],
    [{ ...senadoMateriaDetailFixture, numero: 'não-numérico' }],
    [
      {
        ...senadoMateriaDetailFixture,
        documento: {
          ...senadoMateriaDetailFixture.documento,
          autoria: [{ autor: '', siglaTipo: 'SENADOR' }],
        },
      },
    ],
    [
      {
        ...senadoMateriaDetailFixture,
        classificacoes: [{ codigo: 'inválido', descricao: 'Tema' }],
      },
    ],
  ])('rejeita estrutura inválida %#', (payload) => {
    const schema = Array.isArray(payload)
      ? senadoMateriaListResponseSchema
      : senadoMateriaDetailSchema;
    expect(schema.safeParse(payload).success).toBe(false);
  });
});
