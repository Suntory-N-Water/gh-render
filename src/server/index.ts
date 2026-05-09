import { Hono } from 'hono';
import router from './router';
import scheduler from './schedule';

const app = new Hono<{ Bindings: CloudflareBindings }>();
const routes = app.route('/', router);

export type AppType = typeof routes;

export default {
  fetch: app.fetch,
  scheduled: scheduler.scheduled,
} satisfies ExportedHandler<CloudflareBindings>;
