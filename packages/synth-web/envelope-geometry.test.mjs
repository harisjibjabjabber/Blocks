import {test} from 'node:test';
import assert from 'node:assert/strict';
import {envelopeGeometry} from './envelope-geometry.js';

const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('1ms attack stays at the left edge rather than occupying a fixed stage slot', () => {
  const g = envelopeGeometry({attack:.001, decay:.7, sustain:.72, release:.8});
  assert(g.a > g.x0);
  assert((g.a - g.x0) / (g.x1 - g.x0) < .01);
  assert(g.a < g.d && g.d < g.releaseStart && g.releaseStart < g.r && g.r < g.x1);
});

test('all stages share one proportional elapsed-time axis', () => {
  const g = envelopeGeometry({attack:.1, decay:.4, sustain:.5, release:.8, hold:.2});
  close((g.d - g.a) / (g.a - g.x0), 4);
  close((g.r - g.releaseStart) / (g.d - g.a), 2);
  close((g.releaseStart - g.d) / (g.a - g.x0), 2);
  close(g.span, 1.5 * 1.05);
});

test('explicit span freezes pixels per second while durations change', () => {
  const before = envelopeGeometry({attack:.1, decay:.4, release:.8, sustain:.5});
  const after = envelopeGeometry({attack:.2, decay:.4, release:.8, sustain:.5, span:before.span});
  close(after.span, before.span);
  close(after.a - before.a, after.d - before.d);
  close(after.d - before.d, after.r - before.r);
  // A deliberately short frozen view clips, rather than falsifying timing.
  const clipped = envelopeGeometry({attack:1, decay:1, release:1, span:.5});
  assert(clipped.a > clipped.x1);
  close(clipped.a - clipped.x0, clipped.d - clipped.a);
});

test('sustain endpoints and responsive footer obey graph geometry', () => {
  const low = envelopeGeometry({sustain:0, height:170, footerHeight:66});
  const high = envelopeGeometry({sustain:1, height:170, footerHeight:66});
  close(low.sy, low.yBottom); close(high.sy, high.yTop);
  close(low.footerTop, 104); close(low.yBottom, 96);
  close(envelopeGeometry({sustain:-1}).sy, envelopeGeometry({sustain:0}).sy);
  close(envelopeGeometry({sustain:2}).sy, envelopeGeometry({sustain:1}).sy);
});

test('zero or invalid durations have finite coincident endpoints, not artificial minimum widths', () => {
  for(const durations of [{attack:0,decay:0,release:0,hold:0},{attack:-1,decay:NaN,release:Infinity,hold:0}]) {
    const g = envelopeGeometry({...durations,span:0});
    for(const value of Object.values(g)) assert(Number.isFinite(value));
    assert.equal(g.span,.08);
    for(const point of [g.a,g.d,g.releaseStart,g.r]) assert.equal(point,g.x0);
  }
  const noStage = envelopeGeometry({attack:0,decay:0,release:0});
  assert.equal(noStage.hold,.25);
  assert.equal(noStage.a,noStage.x0); assert.equal(noStage.d,noStage.x0);
  assert.equal(noStage.r,noStage.releaseStart);
});
