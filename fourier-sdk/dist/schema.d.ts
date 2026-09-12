import type { ReactNode } from "react";
import { SDK_SCHEMA_FIELD_PACKAGE, SDK_SCHEMA_VERSION } from "@fourier-video/core/protocol";
export { SDK_SCHEMA_FIELD_PACKAGE, SDK_SCHEMA_VERSION };
export interface TimeValue {
    source: string;
    frames: number;
    seconds: number;
}
export type FieldKind = "string" | "number" | "boolean" | "color" | "time" | "enum" | "asset" | "node";
export interface FieldDefinition<Value = unknown, Input = Value, HasDefault extends boolean = boolean> {
    readonly package: typeof SDK_SCHEMA_FIELD_PACKAGE;
    readonly schemaVersion: typeof SDK_SCHEMA_VERSION;
    readonly kind: FieldKind;
    readonly hasDefault: HasDefault;
    readonly defaultValue?: Input;
    readonly label?: string;
    readonly description?: string;
    readonly min?: number;
    readonly max?: number;
    readonly integer?: boolean;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly values?: readonly string[];
    readonly accept?: readonly string[];
    /** Type-only markers; field() does not emit them at runtime. */
    readonly "~value"?: Value;
    readonly "~input"?: Input;
}
export type AnyFieldDefinition = FieldDefinition<any, any, boolean>;
export type FieldsSchema = Readonly<Record<string, AnyFieldDefinition>>;
type ValueOf<Field> = Field extends FieldDefinition<infer Value, any, any> ? Value : never;
type InputOf<Field> = Field extends FieldDefinition<any, infer Input, any> ? Input : never;
type DefaultKeys<Schema extends FieldsSchema> = {
    [Key in keyof Schema]-?: Schema[Key] extends FieldDefinition<any, any, true> ? Key : never;
}[keyof Schema];
type RequiredKeys<Schema extends FieldsSchema> = Exclude<keyof Schema, DefaultKeys<Schema>>;
export type InferFields<Schema extends FieldsSchema> = {
    readonly [Key in keyof Schema]: ValueOf<Schema[Key]>;
};
export type InferFieldInputs<Schema extends FieldsSchema> = {
    readonly [Key in RequiredKeys<Schema>]: InputOf<Schema[Key]>;
} & {
    readonly [Key in DefaultKeys<Schema>]?: InputOf<Schema[Key]>;
};
interface CommonOptions {
    label?: string;
    description?: string;
}
interface StringOptions extends CommonOptions {
    minLength?: number;
    maxLength?: number;
}
interface NumberOptions extends CommonOptions {
    min?: number;
    max?: number;
    integer?: boolean;
}
interface AssetOptions extends CommonOptions {
    accept?: readonly string[];
}
type WithDefault<Options, Value> = Options & {
    default: Value;
};
interface StringFieldFactory {
    (): FieldDefinition<string, string, false>;
    (options: WithDefault<StringOptions, string>): FieldDefinition<string, string, true>;
    (options: StringOptions): FieldDefinition<string, string, false>;
}
interface NumberFieldFactory {
    (): FieldDefinition<number, number, false>;
    (options: WithDefault<NumberOptions, number>): FieldDefinition<number, number, true>;
    (options: NumberOptions): FieldDefinition<number, number, false>;
}
interface BooleanFieldFactory {
    (): FieldDefinition<boolean, boolean, false>;
    (options: WithDefault<CommonOptions, boolean>): FieldDefinition<boolean, boolean, true>;
    (options: CommonOptions): FieldDefinition<boolean, boolean, false>;
}
interface ColorFieldFactory {
    (): FieldDefinition<string, string, false>;
    (options: WithDefault<CommonOptions, string>): FieldDefinition<string, string, true>;
    (options: CommonOptions): FieldDefinition<string, string, false>;
}
interface TimeFieldFactory {
    (): FieldDefinition<TimeValue, string | TimeValue, false>;
    (options: WithDefault<CommonOptions, string | TimeValue>): FieldDefinition<TimeValue, string | TimeValue, true>;
    (options: CommonOptions): FieldDefinition<TimeValue, string | TimeValue, false>;
}
interface AssetFieldFactory {
    (): FieldDefinition<string, string, false>;
    (options: WithDefault<AssetOptions, string>): FieldDefinition<string, string, true>;
    (options: AssetOptions): FieldDefinition<string, string, false>;
}
interface NodeFieldFactory {
    (options?: CommonOptions): FieldDefinition<Exclude<ReactNode, undefined>, Exclude<ReactNode, undefined>, false>;
}
declare function enumField<const Values extends readonly [string, ...string[]]>(values: Values): FieldDefinition<Values[number], Values[number], false>;
declare function enumField<const Values extends readonly [string, ...string[]]>(values: Values, options: WithDefault<CommonOptions, Values[number]>): FieldDefinition<Values[number], Values[number], true>;
declare function enumField<const Values extends readonly [string, ...string[]]>(values: Values, options: CommonOptions): FieldDefinition<Values[number], Values[number], false>;
export declare const field: Readonly<{
    string: StringFieldFactory;
    number: NumberFieldFactory;
    boolean: BooleanFieldFactory;
    color: ColorFieldFactory;
    time: TimeFieldFactory;
    enum: typeof enumField;
    asset: AssetFieldFactory;
    node: NodeFieldFactory;
}>;
export declare function defineSchema<const Schema extends FieldsSchema>(input: Schema): Readonly<Schema>;
export declare function bindSchemaProps<Schema extends FieldsSchema>(schema: Schema, input: InferFieldInputs<Schema> | Readonly<Record<string, unknown>>, options: {
    fps: number;
}): Readonly<InferFields<Schema>>;
//# sourceMappingURL=schema.d.ts.map