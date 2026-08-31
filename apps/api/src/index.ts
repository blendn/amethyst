import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./database.js";

await migrate();
const app = createApp();
app.listen(config.PORT, () => {
  console.log(`Amethyst API listening on port ${config.PORT}`);
});
