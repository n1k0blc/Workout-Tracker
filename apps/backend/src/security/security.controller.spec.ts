import { Logger } from '@nestjs/common';
import { SecurityController, normalizeCspReports } from './security.controller';

describe('normalizeCspReports', () => {
  it('parses the legacy application/csp-report shape', () => {
    const out = normalizeCspReports({
      'csp-report': {
        'document-uri': 'https://workout.nikobjelic.com/dashboard',
        'blocked-uri': 'inline',
        'violated-directive': 'script-src-elem',
        'effective-directive': 'script-src-elem',
        'script-sample': 'alert(1)',
      },
    });
    expect(out).toEqual([
      {
        documentUri: 'https://workout.nikobjelic.com/dashboard',
        blockedUri: 'inline',
        directive: 'script-src-elem',
        sample: 'alert(1)',
      },
    ]);
  });

  it('parses the Reporting API application/reports+json array', () => {
    const out = normalizeCspReports([
      {
        type: 'csp-violation',
        body: {
          documentURL: 'https://workout.nikobjelic.com/workout',
          blockedURL: 'https://evil.example/x.js',
          effectiveDirective: 'script-src',
        },
      },
      { type: 'deprecation', body: { id: 'ignored' } },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].blockedUri).toBe('https://evil.example/x.js');
    expect(out[0].directive).toBe('script-src');
  });

  it('returns nothing for an unrecognised body', () => {
    expect(normalizeCspReports({ hello: 'world' })).toEqual([]);
    expect(normalizeCspReports(null)).toEqual([]);
    expect(normalizeCspReports('nope')).toEqual([]);
  });

  it('caps overlong fields', () => {
    const [r] = normalizeCspReports({ 'csp-report': { 'script-sample': 'x'.repeat(5000) } });
    expect(r.sample.length).toBe(300);
  });
});

describe('SecurityController', () => {
  it('logs one warning per violation', () => {
    const controller = new SecurityController();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      controller.ingest([
        { type: 'csp-violation', body: { effectiveDirective: 'img-src', blockedURL: 'data:' } },
        { type: 'csp-violation', body: { effectiveDirective: 'connect-src', blockedURL: 'wss://x' } },
      ]);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0][0]).toContain('violated=img-src');
    } finally {
      warn.mockRestore();
    }
  });

  it('logs once when the shape is unrecognised', () => {
    const controller = new SecurityController();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      controller.ingest({ garbage: true });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('unrecognised');
    } finally {
      warn.mockRestore();
    }
  });
});
