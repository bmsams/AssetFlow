import type { APIGatewayProxyEvent } from 'aws-lambda';
import { API_ERROR_CODES } from '@ams/types';

jest.mock('../asset-reports/asset-report-repository', () => ({
  getAssetSummaryData: jest.fn(),
  getAssetAgingData: jest.fn(),
  getAssetsByLocationData: jest.fn(),
  getAssetsByDepartmentData: jest.fn(),
}));

jest.mock('../financial/financial-report-repository', () => ({
  getBudgetUtilizationData: jest.fn(),
  getProcurementSpendingSummary: jest.fn(),
}));

jest.mock('../operational-reports/operational-report-repository', () => ({
  getWorkOrderSummarySummary: jest.fn(),
  getMaintenanceComplianceSummary: jest.fn(),
  getMaintenanceComplianceData: jest.fn(),
}));

import { handler } from '../handlers/report-handlers';
import * as assetReportRepository from '../asset-reports/asset-report-repository';

function makeEvent(path: string, query: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    resource: '',
    path,
    httpMethod: 'GET',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: Object.keys(query).length ? query : null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '',
      apiId: '',
      authorizer: { claims: { sub: '00000000-0000-0000-0000-000000000000' } },
      protocol: '',
      httpMethod: 'GET',
      identity: {} as never,
      path,
      requestId: 'req-1',
      requestTimeEpoch: Date.now(),
      resourceId: '',
      resourcePath: '',
      stage: 'test',
    },
    body: null,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEvent;
}

describe('report-handlers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 200 and expected shape for asset-summary', async () => {
    jest.mocked(assetReportRepository.getAssetSummaryData).mockResolvedValue({
      totalAssets: 10,
      byType: [{ category: 'HARDWARE', count: 7, percentage: 70 }],
      byStatus: [{ category: 'DEPLOYED', count: 3, percentage: 30 }],
      byLocation: [{ category: 'HQ', count: 10 }],
    } as never);

    const res = await handler(makeEvent('/v1/reports/asset-summary'));
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body) as { data: unknown };
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('totalAssets', 10);
    expect(body.data).toHaveProperty('byType');
    expect(body.data).toHaveProperty('byStatus');
    expect(body.data).toHaveProperty('byLocation');
  });

  it('returns 500 structured error when repository throws', async () => {
    jest.mocked(assetReportRepository.getAssetSummaryData).mockRejectedValue(new Error('db down'));

    const res = await handler(makeEvent('/v1/reports/asset-summary'));
    expect(res.statusCode).toBe(500);

    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
    expect(body.error.message).toMatch(/asset summary/i);
  });

  it('returns CSV for export route', async () => {
    jest.mocked(assetReportRepository.getAssetSummaryData).mockResolvedValue({
      totalAssets: 2,
      byType: [{ category: 'HARDWARE', count: 2, percentage: 100 }],
      byStatus: [],
      byLocation: [],
    } as never);

    const res = await handler(makeEvent('/v1/reports/asset-summary/export'));
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['Content-Type']).toBe('text/csv');
    expect(res.body).toContain('category,name,count,percentage');
    expect(res.body).toContain('Type,HARDWARE,2,100');
  });
});

