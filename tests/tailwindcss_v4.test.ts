import { assertSiteSnapshot, build, getSite } from "./utils.ts";
import tailwindcss from "../plugins/tailwindcss_v4.ts";

Deno.test("tailwindcss_v4 plugin", async (t) => {
  // todo: find a way to do this without node_modules
  const site = getSite({
    src: "tailwindcss_v4",
    cwd: "./tests/assets/tailwindcss_v4",
  });

  site.use(tailwindcss({ input: "./tests/assets/tailwindcss_v4/styles.css" }));
  
  await build(site);
  // todo: assert 
  // await assertSiteSnapshot(t, site);
});
