/**
 * Request Service Unit Tests
 *
 * Tests for Request Service:
 * - Request submission (Requirement 6.1)
 * - Capture requester, items, quantities, justification (Requirement 6B.3)
 * - Request status tracking (Requirement 6B.8)
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) => fn({
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

// Mock the repository
jest.mock('../request/request-repository');

import * as requestService from '../request/request-service';
import * as requestRepository from '../request/request-repository';
import { publishEvent } from '@ams/events';

const mockRequestRepository = requestRepository as jest.Mocked<typeof requestRepository>;
const mockPublishEvent = publishEvent as jest.Mock;

describe('Request Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitRequest', () => {
    const mockRequest = {
      requestId: '123e4567-e89b-12d3-a456-426614174001',
      requestNumber: 'REQ-ABC123-XYZ',
      requesterId: '123e4567-e89b-12d3-a456-426614174000',
      requesterName: 'John Doe',
      requesterEmail: 'john.doe@example.com',
      requesterDepartment: 'IT',
      status: 'DRAFT' as const,
      priority: 'NORMAL' as const,
      requestType: 'STANDARD',
      justification: 'Need new laptop for development work',
      deliveryLocation: 'Building A, Floor 2',
      totalLineCount: 1,
      totalQuantity: 1,
      fulfilledQuantity: 0,
      estimatedCost: 1500,
      approvalLevel: 0,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    const mockLines = [
      {
        lineId: '123e4567-e89b-12d3-a456-426614174002',
        requestId: mockRequest.requestId,
        lineNumber: 1,
        productName: 'MacBook Pro 16"',
        productType: 'LAPTOP',
        quantity: 1,
        fulfilledQuantity: 0,
        unitPrice: 1500,
        totalPrice: 1500,
        status: 'PENDING' as const,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
    ];

    it('should submit a request successfully', async () => {
      mockRequestRepository.createRequest.mockResolvedValue({
        request: mockRequest as any,
        lines: mockLines as any,
      });

      mockRequestRepository.updateRequestStatus
        .mockResolvedValueOnce({
          ...mockRequest,
          status: 'SUBMITTED',
          submittedDate: '2024-01-15T10:00:00.000Z',
        } as any)
        .mockResolvedValueOnce({
          ...mockRequest,
          status: 'PENDING_APPROVAL',
          submittedDate: '2024-01-15T10:00:00.000Z',
          approvalWorkflowId: 'WF-ABC123',
          approvalLevel: 1,
        } as any);

      const input = {
        requesterId: mockRequest.requesterId,
        requesterName: 'John Doe',
        requesterEmail: 'john.doe@example.com',
        requesterDepartment: 'IT',
        justification: 'Need new laptop for development work',
        deliveryLocation: 'Building A, Floor 2',
        items: [
          {
            productName: 'MacBook Pro 16"',
            productType: 'LAPTOP',
            quantity: 1,
            unitPrice: 1500,
          },
        ],
      };

      const result = await requestService.submitRequest(input);

      expect(result.request.status).toBe('PENDING_APPROVAL');
      expect(result.request.approvalWorkflowId).toBeDefined();
      expect(result.lines.length).toBe(1);
      expect(mockPublishEvent).toHaveBeenCalledWith('REQUEST_SUBMITTED', expect.any(Object));
      expect(mockPublishEvent).toHaveBeenCalledWith('APPROVAL_WORKFLOW_INITIATED', expect.any(Object));
    });

    it('should throw error when items is empty', async () => {
      const input = {
        requesterId: mockRequest.requesterId,
        justification: 'Need new laptop',
        deliveryLocation: 'Building A',
        items: [],
      };

      await expect(requestService.submitRequest(input)).rejects.toThrow(
        'Request must have at least one item'
      );
    });

    it('should throw error when justification is missing', async () => {
      const input = {
        requesterId: mockRequest.requesterId,
        justification: '',
        deliveryLocation: 'Building A',
        items: [{ productName: 'Laptop', quantity: 1 }],
      };

      await expect(requestService.submitRequest(input)).rejects.toThrow(
        'Justification is required'
      );
    });

    it('should throw error when deliveryLocation is missing', async () => {
      const input = {
        requesterId: mockRequest.requesterId,
        justification: 'Need new laptop',
        deliveryLocation: '',
        items: [{ productName: 'Laptop', quantity: 1 }],
      };

      await expect(requestService.submitRequest(input)).rejects.toThrow(
        'Delivery location is required'
      );
    });

    it('should throw error when item has invalid quantity', async () => {
      const input = {
        requesterId: mockRequest.requesterId,
        justification: 'Need new laptop',
        deliveryLocation: 'Building A',
        items: [{ productName: 'Laptop', quantity: 0 }],
      };

      await expect(requestService.submitRequest(input)).rejects.toThrow(
        'Item 1: Quantity must be greater than 0'
      );
    });

    it('should throw error when item has non-integer quantity', async () => {
      const input = {
        requesterId: mockRequest.requesterId,
        justification: 'Need new laptop',
        deliveryLocation: 'Building A',
        items: [{ productName: 'Laptop', quantity: 1.5 }],
      };

      await expect(requestService.submitRequest(input)).rejects.toThrow(
        'Item 1: Quantity must be an integer'
      );
    });

    it('should throw error when item has missing productName', async () => {
      const input = {
        requesterId: mockRequest.requesterId,
        justification: 'Need new laptop',
        deliveryLocation: 'Building A',
        items: [{ productName: '', quantity: 1 }],
      };

      await expect(requestService.submitRequest(input)).rejects.toThrow(
        'Item 1: Product name is required'
      );
    });
  });

  describe('getRequestStatus', () => {
    const mockRequest = {
      requestId: '123e4567-e89b-12d3-a456-426614174001',
      requestNumber: 'REQ-ABC123-XYZ',
      requesterId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'PENDING_APPROVAL' as const,
      priority: 'NORMAL' as const,
      approvalWorkflowId: 'WF-ABC123',
      approvalLevel: 1,
      submittedDate: '2024-01-15T10:00:00.000Z',
      createdAt: '2024-01-15T09:00:00.000Z',
      createdBy: '123e4567-e89b-12d3-a456-426614174000',
    };

    const mockLines = [
      {
        lineId: '123e4567-e89b-12d3-a456-426614174002',
        requestId: mockRequest.requestId,
        lineNumber: 1,
        productName: 'MacBook Pro 16"',
        quantity: 1,
        status: 'PENDING' as const,
      },
    ];

    it('should return request status with history', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue(mockRequest as any);
      mockRequestRepository.getRequestLines.mockResolvedValue(mockLines as any);

      const result = await requestService.getRequestStatus(mockRequest.requestId);

      expect(result).not.toBeNull();
      expect(result?.request.requestId).toBe(mockRequest.requestId);
      expect(result?.request.status).toBe('PENDING_APPROVAL');
      expect(result?.lines.length).toBe(1);
      expect(result?.statusHistory.length).toBeGreaterThan(0);
      expect(result?.canCancel).toBe(true);
      expect(result?.canModify).toBe(false);
    });

    it('should return null when request not found', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue(null);

      const result = await requestService.getRequestStatus('non-existent-id');

      expect(result).toBeNull();
    });

    it('should indicate canCancel=false for fulfilled requests', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue({
        ...mockRequest,
        status: 'FULFILLED',
        fulfilledDate: '2024-01-16T10:00:00.000Z',
      } as any);
      mockRequestRepository.getRequestLines.mockResolvedValue(mockLines as any);

      const result = await requestService.getRequestStatus(mockRequest.requestId);

      expect(result?.canCancel).toBe(false);
    });

    it('should indicate canModify=true for draft requests', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue({
        ...mockRequest,
        status: 'DRAFT',
        submittedDate: null,
        approvalWorkflowId: null,
      } as any);
      mockRequestRepository.getRequestLines.mockResolvedValue(mockLines as any);

      const result = await requestService.getRequestStatus(mockRequest.requestId);

      expect(result?.canModify).toBe(true);
    });
  });

  describe('cancelRequest', () => {
    const mockRequest = {
      requestId: '123e4567-e89b-12d3-a456-426614174001',
      requestNumber: 'REQ-ABC123-XYZ',
      requesterId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'PENDING_APPROVAL' as const,
    };

    it('should cancel a request successfully', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue(mockRequest as any);
      mockRequestRepository.updateRequestStatus.mockResolvedValue({
        ...mockRequest,
        status: 'CANCELLED',
        cancelledDate: '2024-01-15T10:00:00.000Z',
        cancellationReason: 'No longer needed',
      } as any);
      mockRequestRepository.getRequestLines.mockResolvedValue([]);

      const result = await requestService.cancelRequest(
        mockRequest.requestId,
        '123e4567-e89b-12d3-a456-426614174000',
        'No longer needed'
      );

      expect(result.status).toBe('CANCELLED');
      expect(mockPublishEvent).toHaveBeenCalledWith('REQUEST_CANCELLED', expect.any(Object));
    });

    it('should throw error when request not found', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue(null);

      await expect(
        requestService.cancelRequest(
          'non-existent-id',
          '123e4567-e89b-12d3-a456-426614174000',
          'Test reason'
        )
      ).rejects.toThrow('Request not found');
    });

    it('should throw error when request is already fulfilled', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue({
        ...mockRequest,
        status: 'FULFILLED',
      } as any);

      await expect(
        requestService.cancelRequest(
          mockRequest.requestId,
          '123e4567-e89b-12d3-a456-426614174000',
          'Test reason'
        )
      ).rejects.toThrow('Cannot cancel request in status: FULFILLED');
    });

    it('should throw error when request is already cancelled', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue({
        ...mockRequest,
        status: 'CANCELLED',
      } as any);

      await expect(
        requestService.cancelRequest(
          mockRequest.requestId,
          '123e4567-e89b-12d3-a456-426614174000',
          'Test reason'
        )
      ).rejects.toThrow('Cannot cancel request in status: CANCELLED');
    });
  });

  describe('getRequest', () => {
    it('should return request with lines', async () => {
      const mockRequest = {
        requestId: '123e4567-e89b-12d3-a456-426614174001',
        requestNumber: 'REQ-ABC123-XYZ',
        status: 'PENDING_APPROVAL',
      };

      const mockLines = [
        { lineId: 'line-1', quantity: 1 },
      ];

      mockRequestRepository.getRequestById.mockResolvedValue(mockRequest as any);
      mockRequestRepository.getRequestLines.mockResolvedValue(mockLines as any);

      const result = await requestService.getRequest(mockRequest.requestId);

      expect(result).not.toBeNull();
      expect(result?.request.requestId).toBe(mockRequest.requestId);
      expect(result?.lines.length).toBe(1);
    });

    it('should return null when request not found', async () => {
      mockRequestRepository.getRequestById.mockResolvedValue(null);

      const result = await requestService.getRequest('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getRequesterRequests', () => {
    it('should return paginated requests for requester', async () => {
      const mockRequests = [
        { requestId: 'req-1', requestNumber: 'REQ-001', status: 'PENDING_APPROVAL' },
        { requestId: 'req-2', requestNumber: 'REQ-002', status: 'FULFILLED' },
      ];

      mockRequestRepository.getRequestsByRequester.mockResolvedValue({
        items: mockRequests as any,
        total: 2,
        page: 1,
        limit: 50,
        hasMore: false,
      });

      const result = await requestService.getRequesterRequests(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockRequestRepository.getRequestsByRequester.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      });

      await requestService.getRequesterRequests(
        '123e4567-e89b-12d3-a456-426614174000',
        { page: 1, limit: 50 },
        ['PENDING_APPROVAL']
      );

      expect(mockRequestRepository.getRequestsByRequester).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { page: 1, limit: 50 },
        ['PENDING_APPROVAL']
      );
    });
  });
});
