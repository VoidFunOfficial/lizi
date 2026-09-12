export interface LoadFontOptions {
    /** CSS font weight represented by this font file. Defaults to 400. */
    readonly weight?: number | "normal" | "bold";
    /** CSS font style represented by this font file. Defaults to normal. */
    readonly style?: "normal" | "italic" | "oblique";
}
/**
 * Registers a bundled browser font and returns its generated CSS family.
 * Pass a local `.otf`, `.ttf`, `.woff`, or `.woff2` import (or a data URI).
 */
export declare function loadFont(source: string, options?: LoadFontOptions): string;
//# sourceMappingURL=font.d.ts.map