import { describe, it } from 'mocha'
import { expect } from 'chai'
import z from 'zod'
import { invertible, invert } from '../src/index'

function testcase<T extends z.ZodTypeAny>(
  description: string,
  schema: T,
  ...inputs: z.input<T>[]
) {
  it(description, async function () {
    for (const input of inputs) {
      const output = schema.parse(input)
      expect(await invert(schema).parseAsync(output)).to.deep.equal(await input)
    }
  })
}

const ParseFloatSchema = invertible(
  z.string(),
  (s, ctx) => {
    const result = parseFloat(s)
    if (isNaN(result)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalid float',
      })
    }
    return result
  },
  z.number(),
  (n) => String(n)
)

describe(`invertible`, function () {
  testcase(
    'works on object',
    z.object({
      foo: ParseFloatSchema,
    }),
    { foo: '5.3' }
  )
  testcase('works on array', z.array(ParseFloatSchema), ['5', '10.3'])
  testcase(
    'works on union',
    z.union([ParseFloatSchema, z.boolean()]),
    '10.3',
    true
  )
  testcase(
    'works on discriminated union',
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('a'),
        value: ParseFloatSchema,
      }),
      z.object({
        type: z.literal('b'),
        value: z.boolean(),
      }),
    ]),
    { type: 'a', value: '3.5' },
    { type: 'b', value: true }
  )
  testcase(
    'works on intersection',
    z.intersection(
      z.object({ a: ParseFloatSchema }),
      z.object({ b: ParseFloatSchema.optional() })
    ),
    { a: '3.5' },
    { a: '3.5', b: '7.8' }
  )
  testcase(
    'works on tuple',
    z.tuple([ParseFloatSchema, z.number()]).rest(ParseFloatSchema),
    ['3', 4, '5', '6']
  )
  testcase('works on record', z.record(ParseFloatSchema), {
    a: '3.5',
    b: '3.6',
  })
  testcase(
    'works on map',
    z.map(z.string(), ParseFloatSchema),
    new Map([
      ['a', '22.8'],
      ['b', '317'],
    ])
  )
  testcase('works on set', z.set(ParseFloatSchema), new Set(['3', '4.5']))
  testcase(
    'works on lazy',
    z.lazy(() => ParseFloatSchema),
    '3',
    '4.5'
  )
  testcase(
    'works on refine',
    ParseFloatSchema.refine((n) => n % 2),
    '3',
    '5',
    '7.1'
  )
  testcase('works on optional', ParseFloatSchema.optional(), undefined, '3.5')
  testcase('works on nullable', ParseFloatSchema.nullable(), null, '3.5')
  testcase('works on default', ParseFloatSchema.default('13'), '3.5')
  testcase('works on catch', ParseFloatSchema.catch(18), '3.5')
  testcase(
    'works on promise',
    ParseFloatSchema.promise(),
    Promise.resolve('3.5')
  )
  testcase('works on branded', ParseFloatSchema.brand('test'), '3.5')
  testcase(
    'works on pipeline',
    ParseFloatSchema.pipe(z.number().negative()),
    '-3.5'
  )
  testcase('works on readonly', z.object({ a: ParseFloatSchema }).readonly(), {
    a: '3.5',
  })
})
