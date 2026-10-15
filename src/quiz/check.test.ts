import { describe, expect, it } from 'vitest';
import { checkAnswer } from './check';
import { isNumberAnswer, parseNumberAnswer } from './text';

describe('checkAnswer: words', () => {
  it('ignores case, punctuation, quotes and a leading article', () => {
    expect(checkAnswer('CARBON MONOXIDE', 'carbon monoxide').correct).toBe(true);
    expect(checkAnswer('  the fresh-air base. ', 'fresh air base').correct).toBe(true);
    expect(checkAnswer('“Class C”', 'Class C').correct).toBe(true);
    expect(checkAnswer('class-c', 'Class C').correct).toBe(true);
  });
  it('forgives small typos in longer words and flags them', () => {
    const r = checkAnswer('methene', 'methane');
    expect(r).toEqual({ correct: true, typo: true });
    expect(checkAnswer('hydrogen sulfde', 'hydrogen sulfide').correct).toBe(true);
    expect(checkAnswer('brattise', 'brattice').correct).toBe(true);
  });
  it('rejects real mistakes and short-word typos', () => {
    expect(checkAnswer('hydrogen', 'nitrogen').correct).toBe(false);
    expect(checkAnswer('ribs', 'roof').correct).toBe(false);
    expect(checkAnswer('TWA', 'TLV').correct).toBe(false); // 3 letters: exact only
    expect(checkAnswer('', 'oxygen').correct).toBe(false);
    expect(checkAnswer('   ', 'oxygen').correct).toBe(false);
  });
  it('requires digits inside word answers to match exactly', () => {
    expect(checkAnswer('CH3', 'CH4').correct).toBe(false);
    expect(checkAnswer('ch4', 'CH4').correct).toBe(true);
  });
  it('accepts listed alternatives', () => {
    expect(checkAnswer('FAB', 'fresh air base', ['FAB']).correct).toBe(true);
  });
});

describe('checkAnswer: numbers', () => {
  it('matches numbers exactly regardless of formatting', () => {
    expect(checkAnswer('1000', '1,000').correct).toBe(true);
    expect(checkAnswer('1,000 feet', '1,000').correct).toBe(true);
    expect(checkAnswer('19.5', '19.5').correct).toBe(true);
    expect(checkAnswer('4', '4.0').correct).toBe(true);
    expect(checkAnswer('20%', '20').correct).toBe(true);
  });
  it('has no typo tolerance for numbers', () => {
    expect(checkAnswer('100', '1,000').correct).toBe(false);
    expect(checkAnswer('0.5546', '0.5545').correct).toBe(false);
    expect(checkAnswer('19', '18').correct).toBe(false);
    expect(checkAnswer('12 to 18', '18').correct).toBe(false);
    expect(checkAnswer('ten', '18').correct).toBe(false);
  });
  it('treats number words and digits as equal', () => {
    expect(checkAnswer('3', 'Three').correct).toBe(true);
    expect(checkAnswer('three', '3').correct).toBe(true);
    expect(checkAnswer('2nd', 'second').correct).toBe(true);
    expect(checkAnswer('Second', 'second').correct).toBe(true);
    expect(checkAnswer('third', 'second').correct).toBe(false);
  });
  it('parses and classifies numbers', () => {
    expect(parseNumberAnswer('40,000 ppm')).toBe(40000);
    expect(parseNumberAnswer('abc')).toBeNull();
    expect(parseNumberAnswer('10-20')).toBeNull();
    expect(isNumberAnswer('1,000')).toBe(true);
    expect(isNumberAnswer('12.5%')).toBe(true);
    expect(isNumberAnswer('Class C')).toBe(false);
  });
});

describe('checkAnswer: review regressions', () => {
  it('does not accept a sibling term as a typo', () => {
    expect(checkAnswer('Class B', 'Class C').correct).toBe(false);
    expect(checkAnswer('Class D', 'Class A').correct).toBe(false);
    expect(checkAnswer('Clas C', 'Class C')).toEqual({ correct: true, typo: true });
  });
});

describe('typo tolerance does not accept different words', () => {
  it('rejects prefix antonyms and different first letters', () => {
    for (const [i, e] of [['unconscious', 'conscious'], ['decrease', 'increase'], ['impermissible', 'permissible'], ['unresponsive', 'responsive'], ['ethane', 'methane']])
      expect(checkAnswer(i, e).correct).toBe(false);
  });
  it('accepts a swapped pair of letters as one typo', () => {
    expect(checkAnswer('recieve', 'receive')).toEqual({ correct: true, typo: true });
    expect(checkAnswer('metahne', 'methane')).toEqual({ correct: true, typo: true });
  });
});
