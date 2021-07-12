# askline

A single-line prompt that allows reading data from user input.

```js
import askline from 'askline';

console.log('Please enter a something:');
const result = await askline({ input: process.stdin, output: process.stdout });
console.log('You entered the following password:', result.toString());
```

The stream passed to `askline` can be any kind of `Readable` stream.
If it is a TTY, `askline` will temporarily remove all other `'data'` and
`'readable'` listeners from it, and set the TTY into raw mode if it has not
been in raw mode to begin with.

## Why not use [`read`](https://www.npmjs.com/package/read) instead?

Because `read `does not work inside a Node.js REPL.

## LICENSE

Apache-2.0
