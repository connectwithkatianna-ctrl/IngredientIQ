import 'dotenv/config';
import { createApp } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const app = createApp();

app.listen(PORT, () => {
  console.log(`IngredientIQ API listening on http://localhost:${PORT}`);
});
