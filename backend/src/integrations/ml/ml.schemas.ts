import { z } from 'zod';

export const mlHealthSchema = z
  .object({
    status: z.literal('ok'),
    modelLoaded: z.literal(true),
    modelName: z.string().min(1),
    modelVersion: z.string().min(1),
    classes: z.number().int().positive(),
  })
  .passthrough();

export const mlPredictionLabelSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1),
    decisionScore: z.number(),
  })
  .passthrough();

export const mlPredictionSchema = z
  .object({
    labels: z.array(mlPredictionLabelSchema),
    labelCount: z.number().int().nonnegative(),
    model: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1),
        source: z.literal('CAMARA'),
        years: z.array(z.number().int()).min(1),
      })
      .passthrough(),
  })
  .refine((payload) => payload.labelCount === payload.labels.length, {
    message: 'labelCount diverge da quantidade de labels.',
    path: ['labelCount'],
  });
