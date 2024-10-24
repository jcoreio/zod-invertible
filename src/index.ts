import z from 'zod'

export interface ZodInvertibleDef<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny
> extends z.ZodPipelineDef<z.ZodEffects<I, z.input<O>>, O> {
  inputSchema: I
  outputSchema: O
  parse: (
    value: z.output<I>,
    ctx: z.RefinementCtx
  ) => z.input<O> | Promise<z.input<O>>
  format: (
    value: z.output<O>,
    ctx: z.RefinementCtx
  ) => z.output<I> | Promise<z.output<I>>
}

export class ZodInvertible<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny
> extends z.ZodPipeline<z.ZodEffects<I, z.input<O>>, O> {
  declare _def: ZodInvertibleDef<I, O>

  constructor(
    inputSchema: I,
    parse: (
      out: z.output<I>,
      ctx: z.RefinementCtx
    ) => z.input<O> | Promise<z.input<O>>,
    outputSchema: O,
    format: (
      out: z.output<O>,
      ctx: z.RefinementCtx
    ) => z.output<I> | Promise<z.output<I>>
  ) {
    super({
      ...inputSchema.transform(parse).pipe(outputSchema)._def,
      inputSchema,
      outputSchema,
      parse,
      format,
    } as ZodInvertibleDef<I, O>)
  }
}

export function invertible<T extends z.ZodTypeAny, U extends z.ZodTypeAny>(
  schema: T,
  parse: (
    value: z.output<T>,
    ctx: z.RefinementCtx
  ) => z.input<U> | Promise<z.input<U>>,
  outSchema: U,
  format: (
    value: z.output<U>,
    ctx: z.RefinementCtx
  ) => z.output<T> | Promise<z.output<T>>
) {
  return new ZodInvertible(schema, parse, outSchema, format)
}

export const IgnoreEffect = Symbol('IgnoreEffect')

export function ignoreEffect<T extends z.ZodEffects<any, any, any>>(
  schema: T
): T {
  ;(schema as any)[IgnoreEffect] = true
  return schema
}

export function invert<T extends z.ZodTypeAny>(
  schema: T
): z.ZodType<z.input<T>, any, z.output<T>> {
  switch (schema._def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodArray:
      return z.array(invert((schema as any as z.ZodArray<any>).element))
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const { shape, _def } = schema as any as z.AnyZodObject
      const invertedShape = Object.fromEntries(
        Object.entries(shape).map(([key, value]) => [key, invert(value as any)])
      )
      return new z.ZodObject({
        ..._def,
        catchall: invert(_def.catchall),
        shape: () => invertedShape,
      })
    }
    case z.ZodFirstPartyTypeKind.ZodUnion:
      return z.union((schema as any as z.ZodUnion<any>).options.map(invert))
    case z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion: {
      const { discriminator, options } =
        schema as any as z.ZodDiscriminatedUnion<any, any>
      return z.discriminatedUnion(discriminator, options.map(invert))
    }
    case z.ZodFirstPartyTypeKind.ZodIntersection: {
      const { left, right } = (schema as any as z.ZodIntersection<any, any>)
        ._def
      return z.intersection(invert(left), invert(right))
    }
    case z.ZodFirstPartyTypeKind.ZodTuple: {
      const {
        items,
        _def: { rest },
      } = schema as any as z.ZodTuple<any, any>
      const result = z.tuple(items.map(invert))
      return rest ? result.rest(invert(rest)) : result
    }
    case z.ZodFirstPartyTypeKind.ZodRecord: {
      const { keySchema, valueSchema } = schema as any as z.ZodRecord<any, any>
      return z.record(invert(keySchema), invert(valueSchema))
    }
    case z.ZodFirstPartyTypeKind.ZodMap: {
      const { keySchema, valueSchema } = schema as any as z.ZodMap<any, any>
      return z.map(invert(keySchema), invert(valueSchema))
    }
    case z.ZodFirstPartyTypeKind.ZodSet:
      return z.set(invert((schema as any as z.ZodSet<any>)._def.valueType))
    case z.ZodFirstPartyTypeKind.ZodFunction: {
      const {
        _def: { args, returns },
      } = schema as any as z.ZodFunction<any, any>
      return z.function(args.map(invert), invert(returns))
    }
    case z.ZodFirstPartyTypeKind.ZodLazy:
      return z.lazy(() => invert((schema as any as z.ZodLazy<any>).schema))
    case z.ZodFirstPartyTypeKind.ZodEffects: {
      const {
        _def: { effect, schema: innerType },
      } = schema as any as z.ZodEffects<any>
      switch (effect.type) {
        case 'refinement': {
          const { refinement } = effect
          return z.any().superRefine(refinement).pipe(invert(innerType))
        }
        case 'preprocess':
        case 'transform':
          if ((schema as any)[IgnoreEffect]) {
            return invert(innerType)
          }
          throw new Error(`effect not supported: ${effect.type}`)
      }
      break
    }
    case z.ZodFirstPartyTypeKind.ZodOptional:
      return invert((schema as any as z.ZodOptional<any>).unwrap()).optional()
    case z.ZodFirstPartyTypeKind.ZodNullable:
      return invert((schema as any as z.ZodNullable<any>).unwrap()).nullable()
    case z.ZodFirstPartyTypeKind.ZodDefault:
      return invert((schema as any as z.ZodDefault<any>).removeDefault())
    case z.ZodFirstPartyTypeKind.ZodCatch:
      return invert((schema as any as z.ZodCatch<any>).removeCatch())
    case z.ZodFirstPartyTypeKind.ZodPromise:
      return z.promise(invert((schema as any as z.ZodPromise<any>)._def.type))
    case z.ZodFirstPartyTypeKind.ZodBranded:
      return invert((schema as any as z.ZodBranded<any, any>)._def.type)
    case z.ZodFirstPartyTypeKind.ZodPipeline: {
      if (schema instanceof ZodInvertible) {
        const {
          _def: { inputSchema, outputSchema, parse, format },
        } = schema
        return invertible(
          invert(outputSchema),
          format,
          invert(inputSchema),
          parse
        )
      }
      const { _def } = schema as any as z.ZodPipeline<any, any>
      return invert(_def.out).pipe(invert(_def.in))
    }
    case z.ZodFirstPartyTypeKind.ZodReadonly:
      return invert(
        (schema as any as z.ZodReadonly<any>)._def.innerType
      ).readonly()
  }
  return schema
}
