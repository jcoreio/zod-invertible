# zod-invertible

declare zod schemas that can be inverted to format from output to input

[![CircleCI](https://circleci.com/gh/jcoreio/zod-invertible.svg?style=svg)](https://circleci.com/gh/jcoreio/zod-invertible)
[![Coverage Status](https://codecov.io/gh/jcoreio/zod-invertible/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/zod-invertible)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/zod-invertible.svg)](https://badge.fury.io/js/zod-invertible)

# Example

```sh
npm i zod-invertible
# OR
pnpm i zod-invertible
```

```ts
import z from 'zod'
import { invertible, invert } from 'zod-intertible'

const StringToNumber = invertible(
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

StringToNumber.parse('3.5') // 3.5

const NumberToString = invert(StringToNumber)

NumberToString.parse(3.5) // '3.5'

const obj = z.object({ foo: StringToNumber })
obj.parse({ foo: '3.5' }) // { foo: 3.5 }
// invert works deeply:
invert(obj).parse({ foo: 3.5 }) // { foo: '3.5' }
```

## `invertible(inputSchema, parse, outputSchema, format)`

Creates an invertible schema that transforms from an input type to a different output type.

### `inputSchema`

The `ZodType` for validating the input value

### `parse`

The function for transforming the input value into the output value. It is called with two arguments:

- `value`: the output of `inputSchema`
- `ctx`: the zod `RefinementCtx`

`parse` may be `async`.

### `outputSchema`

The `ZodType` for validating the output

### `format`

The function for converting from the output value back into the input value. It is called with two arguments:

- `value`: the input of `outputSchema`
- `ctx`: the zod `RefinementCtx`

`format` may be `async`.

## `invert(schema)`

Deeply inverts a zod schema, inverting any `ZodInvertible` schemas inside it, and otherwise preserving the structure of
objects, arrays, etc.

If the zod schema parses input type `I` into output type `O`, the inverted schema will parse input type `O` into output type `I`.
