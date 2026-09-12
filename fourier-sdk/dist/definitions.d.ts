import { type FieldsSchema } from "./schema.ts";
import { type DomMotionArtifact, type DomMotionDefinition, type DomFfmpegVideoMotionArtifact, type DomFfmpegVideoMotionDefinition, type DomReactArtifact, type DomReactDefinition, type DomShaderArtifact, type DomShaderDefinition } from "./types.ts";
import { type FourierShaderUniformLayout } from "./webgl.ts";
export declare function defineReact<const Schema extends FieldsSchema>(definition: DomReactDefinition<Schema>): DomReactArtifact<Schema>;
export declare function defineMotion<const Schema extends FieldsSchema>(definition: DomMotionDefinition<Schema>): DomMotionArtifact<Schema>;
export declare function defineMotion<const Schema extends FieldsSchema>(definition: DomFfmpegVideoMotionDefinition<Schema>): DomFfmpegVideoMotionArtifact<Schema>;
export declare function defineShader<const Schema extends FieldsSchema, const Layout extends FourierShaderUniformLayout>(definition: DomShaderDefinition<Schema, Layout>): DomShaderArtifact<Schema, Layout>;
//# sourceMappingURL=definitions.d.ts.map