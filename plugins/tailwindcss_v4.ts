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
 * @see https://lume.land/plugins/tailwindcss/
 */
export function tailwindCSSV4(userOptions?: Options) {
  const options = merge(defaults, userOptions);

  return (site: Site) => {
    // Load Tailwind v4 input file
    site.loadAssets([".css"]);

    site.process([".css"], async (pages) => {
      console.log(pages);

      /**
       * Naive implementation of Tailwind V4
       * Tailwind V4 uses a CSS file as "input" and configuration.
       * 1. create the compiler with the css input file.
       * 2. scan the sources
       * 3. build the css from the scanned candidates
       * 4. write the file out
       *
       * This requires consumers of the plugin to
       * - include `npm:tailwindcss@4.0.0` in the `deno.json` as an import
       * - and set "nodeModulesDir": "auto" in the `deno.json`
       */

      // Adapted from https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/%40tailwindcss-cli/src/commands/build/index.ts#L152
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
