import { BreachedPasswordService } from './breached-password.service';

// SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD_PREFIX = '5BAA6';
const PASSWORD_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

function makeService(config: Record<string, unknown> = {}) {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as any;
  return new BreachedPasswordService(configService);
}

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const fn = jest.fn(impl as any);
  global.fetch = fn as any;
  return fn;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response;
}

describe('BreachedPasswordService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reports a breached password and only sends the 5-char hash prefix', async () => {
    const fetchMock = mockFetch(() =>
      textResponse(`00000000000000000000000000000000000:5\n${PASSWORD_SUFFIX}:9999999`),
    );
    const service = makeService();

    await expect(service.isBreached('password')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe(`https://api.pwnedpasswords.com/range/${PASSWORD_PREFIX}`);
    expect(calledUrl).not.toContain(PASSWORD_SUFFIX);
  });

  it('matches the suffix case-insensitively', async () => {
    mockFetch(() => textResponse(`${PASSWORD_SUFFIX.toLowerCase()}:42`));
    await expect(makeService().isBreached('password')).resolves.toBe(true);
  });

  it('accepts a password whose suffix is absent from the range', async () => {
    mockFetch(() => textResponse('00000000000000000000000000000000000:5\nABCDEF0123456789ABCDEF0123456789ABCD:1'));
    await expect(makeService().isBreached('a-strong-unique-passphrase')).resolves.toBe(false);
  });

  it('ignores a zero-count padding decoy that matches the suffix', async () => {
    mockFetch(() => textResponse(`${PASSWORD_SUFFIX}:0`));
    await expect(makeService().isBreached('password')).resolves.toBe(false);
  });

  it('fails open when the API returns a non-200', async () => {
    mockFetch(() => textResponse('error', 503));
    await expect(makeService().isBreached('password')).resolves.toBe(false);
  });

  it('fails open when the request throws (network error / timeout)', async () => {
    mockFetch(() => {
      throw new Error('network down');
    });
    await expect(makeService().isBreached('password')).resolves.toBe(false);
  });

  it('aborts the request after the configured timeout and fails open', async () => {
    jest.useFakeTimers();
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const service = makeService({ PWNED_PASSWORDS_TIMEOUT_MS: 1000 });

    const result = service.isBreached('password');
    await jest.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBe(false);
    jest.useRealTimers();
  });

  it('honours a configured API base URL', async () => {
    const fetchMock = mockFetch(() => textResponse(''));
    await makeService({ PWNED_PASSWORDS_API_URL: 'https://hibp.internal/range/' }).isBreached('x');
    expect(fetchMock.mock.calls[0][0]).toBe('https://hibp.internal/range/11F6A');
  });
});
