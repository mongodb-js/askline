import askline from '..';
import assert from 'assert';
import { Readable } from 'stream';

function mustNotCall () {
  const { stack } = new Error();
  return () => assert.fail(`Unexpected call to function\n${stack}`);
}

describe('on regular streams', () => {
  it('lets the user enter a line', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana\n'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Banana'));
  });

  it('lets the user enter a line, string version', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.setEncoding('utf8');
    stream.push(Buffer.from('Banana\n'));
    assert.deepStrictEqual(await linePromise, 'Banana');
  });

  it('lets the user enter a line, no newline but EOS', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.setEncoding('utf8');
    stream.push(Buffer.from('Banana'));
    stream.push(null);
    assert.deepStrictEqual(await linePromise, 'Banana');
  });

  it('does not call other "data" listeners', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    stream.on('data', mustNotCall());
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana\n'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Banana'));
  });

  it('does not call other "readable" listeners', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    stream.on('readable', mustNotCall());
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana\n'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Banana'));
  });

  it('does call other "data" listeners if partial data is available', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    let extra = null;
    stream.on('data', (chunk) => { extra = chunk; });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana\nPhone'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Banana'));
    assert.deepStrictEqual(extra, Buffer.from('Phone'));
  });

  it('does call other "readable" listeners if partial data is available', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    let extra = null;
    stream.on('readable', () => { extra = stream.read(); });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana\nPhone'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Banana'));
    assert.deepStrictEqual(extra, Buffer.from('Phone'));
  });

  it('rejects when the stream is destroyed while reading', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana'));
    setImmediate(() => stream.destroy());
    await assert.rejects(linePromise, /Stream closed before data could be read/);
  });

  it('rejects when the stream errors out while reading', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana'));
    setImmediate(() => stream.destroy(new Error('some-error')));
    await assert.rejects(linePromise, /some-error/);
  });

  it('keeps a stream paused if it was before', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    stream.pause();
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana\r'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Banana'));
    assert.strictEqual(stream.readableFlowing, false);
  });

  it('resumes if a new "data" handler is called', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Banana\r'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Banana'));
    assert.strictEqual(stream.readableFlowing, false);
    stream.on('data', mustNotCall());
    assert.strictEqual(stream.readableFlowing, true);
  });

  it('accepts both \\r and \\n as line delimiters, \\r first', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Apple\rBanana\nOrange'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Apple'));
  });

  it('accepts both \\r and \\n as line delimiters, \\n first', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    const linePromise = askline(stream);
    stream.push(Buffer.from('Apple\nBanana\rOrange'));
    assert.deepStrictEqual(await linePromise, Buffer.from('Apple'));
  });

  it('respects Ctrl+C as a way of aborting', async () => {
    const stream = new Readable({ read () { /* ignore */ } });
    Object.assign(stream, {
      isTTY: true,
      isRaw: false,
      setRawMode () { return false; }
    });
    stream.on('data', mustNotCall());
    const linePromise = askline(stream);
    stream.push(Buffer.from('Apple\u0003'));
    let error;
    try {
      await linePromise;
    } catch (err) {
      error = err;
    }
    assert.strictEqual(error.code, 'ECANCELED');
  });

  for (const bs of ['\u007f', '\u0008']) {
    describe(`backspaces (ASCII ${bs.codePointAt(0)})`, () => {
      it('handles backspaces properly', async () => {
        const stream = new Readable({ read () { /* ignore */ } });
        const linePromise = askline(stream);
        stream.push(Buffer.from(`Banana${bs}\n`));
        assert.deepStrictEqual(await linePromise, Buffer.from('Banan'));
      });

      it('ignores backspaces at string start', async () => {
        const stream = new Readable({ read () { /* ignore */ } });
        const linePromise = askline(stream);
        stream.push(Buffer.from(`${bs}Banana${bs}\n`));
        assert.deepStrictEqual(await linePromise, Buffer.from('Banan'));
      });

      it('handles UTF-8 input properly', async () => {
        const stream = new Readable({ read () { /* ignore */ } });
        const linePromise = askline(stream);
        stream.push(Buffer.from(`Bananä${bs}\n`));
        assert.deepStrictEqual(await linePromise, Buffer.from('Banan'));
      });

      it('handles emoji input properly', async () => {
        const stream = new Readable({ read () { /* ignore */ } });
        const linePromise = askline(stream);
        stream.push(Buffer.from(`Banan🎉${bs}\n`));
        assert.deepStrictEqual(await linePromise, Buffer.from('Banan'));
      });

      it('handles UTF-8 input properly (string version)', async () => {
        const stream = new Readable({ read () { /* ignore */ } });
        stream.setEncoding('utf8');
        const linePromise = askline(stream);
        stream.push(`Bananä${bs}\n`);
        assert.deepStrictEqual(await linePromise, 'Banan');
      });

      it('handles emoji input properly (string version)', async () => {
        const stream = new Readable({ read () { /* ignore */ } });
        stream.setEncoding('utf8');
        const linePromise = askline(stream);
        stream.push(`Banan🎉${bs}\n`);
        assert.deepStrictEqual(await linePromise, 'Banan');
      });
    });
  }
});
