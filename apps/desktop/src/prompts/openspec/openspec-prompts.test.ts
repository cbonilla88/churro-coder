import { describe, expect, test } from 'vitest';
import { BUILTIN_PROMPTS } from '../index';

describe('OpenSpec built-in prompt registry', () => {
  test('includes the supported OpenSpec prompts and excludes continue', () => {
    expect(
      Object.keys(BUILTIN_PROMPTS)
        .filter((key) => key.startsWith('openspec/'))
        .sort()
    ).toEqual(['openspec/apply', 'openspec/archive', 'openspec/propose', 'openspec/system', 'openspec/verify']);
    expect(BUILTIN_PROMPTS['openspec/continue']).toBeUndefined();
  });

  test('keeps apply task scoping local modification visible', () => {
    expect(BUILTIN_PROMPTS['openspec/apply']).toContain('LOCAL:');
    expect(BUILTIN_PROMPTS['openspec/apply']).toContain('{# /LOCAL #}');
    expect(BUILTIN_PROMPTS['openspec/apply']).toContain('section');
    expect(BUILTIN_PROMPTS['openspec/apply']).toContain('specific task');
    expect(BUILTIN_PROMPTS['openspec/apply']).toContain('$ARGUMENTS');
  });
});
