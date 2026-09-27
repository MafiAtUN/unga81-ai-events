import type { APIRoute } from 'astro';
import { events, debate, meta } from '../../lib/load';
import { allConstellations } from '../../lib/layout';

// Data for the interactive stage, with the constellation grids precomputed for 360, 768 and 1280.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ events, debate, meta, constellation: allConstellations(events, meta) }), {
    headers: { 'content-type': 'application/json' },
  });
