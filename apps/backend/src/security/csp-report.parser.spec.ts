import { Body, Controller, HttpCode, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { registerCspReportParser } from './csp-report.parser';

// Stands in for any ordinary JSON endpoint (login, register, ...).
@Controller('probe')
class ProbeController {
  @Post()
  @HttpCode(200)
  echo(@Body() body: unknown): { body: unknown } {
    return { body };
  }
}

@Controller('security')
class ReportProbeController {
  @Post('csp-report')
  @HttpCode(200)
  echo(@Body() body: unknown): { body: unknown } {
    return { body };
  }
}

describe('registerCspReportParser', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController, ReportProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    registerCspReportParser(app);
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Regression: registering express.json() bare returns a middleware named
  // `jsonParser`, which makes Nest skip its own body parser and leaves every
  // ordinary JSON body unparsed. That took down login/register in production.
  it('leaves the default JSON body parser intact for normal endpoints', async () => {
    const payload = { email: 'user@example.com', password: 'correct-horse' };

    const res = await request(app.getHttpServer())
      .post('/api/probe')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);

    expect(res.body.body).toEqual(payload);
  });

  it('parses legacy application/csp-report bodies', async () => {
    const payload = { 'csp-report': { 'document-uri': 'https://example.com/' } };

    const res = await request(app.getHttpServer())
      .post('/api/security/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(JSON.stringify(payload))
      .expect(200);

    expect(res.body.body).toEqual(payload);
  });

  it('parses Reporting API application/reports+json bodies', async () => {
    const payload = [{ type: 'csp-violation', body: { effectiveDirective: 'script-src' } }];

    const res = await request(app.getHttpServer())
      .post('/api/security/csp-report')
      .set('Content-Type', 'application/reports+json')
      .send(JSON.stringify(payload))
      .expect(200);

    expect(res.body.body).toEqual(payload);
  });
});
