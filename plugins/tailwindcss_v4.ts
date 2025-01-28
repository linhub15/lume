import { dirname } from "jsr:@std/path";
import type Site from "../core/site.ts";
import { merge } from "../core/utils/object.ts";
import { compile, Scanner } from "../deps/tailwindcss.ts";

export interface Options {
  /** CSS file that imports Tailwind CSS
   * @default "./styles.css"
   */
  input?: string;
}

export const defaults: Options = {
  input: "./styles.css",
};

/**
 * A plugin to extract the utility classes from HTML pages and apply TailwindCSS v4
 *
 * @requires `npm:tailwindcss@4.0.0`
 *
 * @requires `nodeModulesDir: "auto"`
 *
 * @example
 * ```ts
 * import lume from "lume/mod.ts";
 * import tailwindcss from "lume/plugins/tailwindcss_v4.ts";
 *
 * const site = lume();
 * site.use(tailwindcss({ input: "./styles.css"}));
 *
 * export default site;
 * ```
 *
 * @see https://lume.land/plugins/tailwindcss/
 */
export function tailwindCSSV4(userOptions?: Options) {
  // Implementation adapted from
  // https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/%40tailwindcss-cli/src/commands/build/index.ts#L152

  const options = merge(defaults, userOptions);

  if (!options.input.endsWith(".css")) {
    throw new Error(
      "The input file must be a CSS file. Use the `@config` directive to load a legacy JavaScript-based configuration file. https://tailwindcss.com/docs/functions-and-directives#compatibility",
    );
  }

  return (site: Site) => {
    // Load input file
    site.loadAssets([".css"]);

    site.process([".css"], async (pages) => {
      const input = await Deno.readTextFile(options.input);
      const inputFilePath = await Deno.realPath(options.input);
      const inputBasePath = options.input ? dirname(inputFilePath) : Deno.cwd();
      const fullRebuildPaths: string[] = inputFilePath ? [inputFilePath] : [];

      const createCompiler = async (css: string) => {
        const compiler = await compile(css, {
          base: inputBasePath,
          onDependency: (path) => {
            fullRebuildPaths.push(path);
          },
        });

        const sources = (() => {
          // Disable auto source detection
          if (compiler.root === "none") {
            return [];
          }

          // No root specified, use the base directory
          if (compiler.root === null) {
            return [{ base: inputBasePath, pattern: "**/*" }];
          }

          // Use the specified root
          return [compiler.root];
        })().concat(compiler.globs);

        const scanner = new Scanner({ sources });

        return [compiler, scanner] as const;
      };

      for (const cssFile of pages) {
        // Only process the specified input file
        if (cssFile.src.entry?.src !== inputFilePath) {
          continue;
        }

        const [compiler, scanner] = await createCompiler(input);
        const candidates = scanner.scan();
        const compiledCss = compiler.build(candidates);

        cssFile.content = compiledCss;
      }
    });
  };
}

export default tailwindCSSV4;
