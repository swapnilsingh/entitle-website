import { defineCollection, z } from 'astro:content';

const ddd = defineCollection({
  schema: z.object({
    title: z.string(),
  }),
});
const technical = defineCollection({
  schema: z.object({
    title: z.string(),
  }),
});
const sales = defineCollection({
  schema: z.object({
    title: z.string(),
  }),
});
const future = defineCollection({
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = {
  ddd,
  technical,
  sales,
  future,
};
