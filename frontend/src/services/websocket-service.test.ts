/**
 * Tests for WebSocket Service
 * Implements Requirement 12.6: Real-time dashboard updates via WebSocket connections
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketService, ConnectionState } from './websocket-service';
import type { DashboardEvent, AssetCreatedEvent } from './websocket-events';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code ?? 1000, reason: reason ?? '' } as CloseEvent);
    }
  });

  // Helper to simulate connection open
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  // Helper to simulate message
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  // Helper to simulate close
  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason } as CloseEvent);
    }
  }

  // Helper to simulate error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Store mock instances for testing
let mockWebSocketInstance: MockWebSocket | null = null;

// Mock global WebSocket
vi.stubGlobal('WebSocket', class extends MockWebSocket {
  constructor(url: string) {
    super(url);
    mockWebSocketInstance = this;
  }
});

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWebSocketInstance = null;
    service = new WebSocketService({
      url: 'wss://test.example.com/ws',
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      debug: false,
    });
  });

  afterEach(() => {
    service.disconnect();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should start in disconnected state', () => {
      expect(service.getConnectionState()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
    });

    it('should transition to connecting state when connect is called', () => {
      service.connect();
      expect(service.getConnectionState()).toBe('connecting');
    });

    it('should transition to connected state when WebSocket opens', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();
      expect(service.getConnectionState()).toBe('connected');
      expect(service.isConnected()).toBe(true);
    });

    it('should transition to disconnected state when disconnect is called', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();
      service.disconnect();
      expect(service.getConnectionState()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
    });

    it('should not create multiple connections if already connecting', () => {
      service.connect();
      const firstInstance = mockWebSocketInstance;
      service.connect();
      expect(mockWebSocketInstance).toBe(firstInstance);
    });

    it('should not create multiple connections if already connected', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();
      const firstInstance = mockWebSocketInstance;
      service.connect();
      expect(mockWebSocketInstance).toBe(firstInstance);
    });
  });

  describe('Connection State Handlers', () => {
    it('should notify handlers of connection state changes', () => {
      const handler = vi.fn();
      service.onConnectionStateChange(handler);

      // Should be called immediately with current state
      expect(handler).toHaveBeenCalledWith('disconnected');

      handler.mockClear();
      service.connect();
      // Check that connecting was called (may have undefined as second arg)
      expect(handler).toHaveBeenCalledWith('connecting', undefined);

      handler.mockClear();
      mockWebSocketInstance?.simulateOpen();
      expect(handler).toHaveBeenCalledWith('connected', undefined);
    });

    it('should allow unsubscribing from state changes', () => {
      const handler = vi.fn();
      const unsubscribe = service.onConnectionStateChange(handler);

      handler.mockClear();
      unsubscribe();

      service.connect();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should notify with error when connection fails', () => {
      const handler = vi.fn();
      service.onConnectionStateChange(handler);

      service.connect();
      handler.mockClear();
      mockWebSocketInstance?.simulateClose(1006, 'Connection failed');

      // Should transition to reconnecting
      expect(handler).toHaveBeenCalledWith('reconnecting', undefined);
    });
  });

  describe('Automatic Reconnection', () => {
    it('should attempt to reconnect after connection closes unexpectedly', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateClose(1006, 'Connection lost');

      expect(service.getConnectionState()).toBe('reconnecting');

      // Advance timer to trigger reconnect
      vi.advanceTimersByTime(1000);

      expect(service.getConnectionState()).toBe('connecting');
    });

    it('should use exponential backoff for reconnection attempts', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      // First disconnect
      mockWebSocketInstance?.simulateClose(1006, 'Connection lost');
      vi.advanceTimersByTime(1000); // First attempt after 1s

      // Second disconnect
      mockWebSocketInstance?.simulateClose(1006, 'Connection lost');
      vi.advanceTimersByTime(1000); // Should not reconnect yet (2s delay)
      expect(service.getConnectionState()).toBe('reconnecting');

      vi.advanceTimersByTime(1000); // Now should reconnect (2s total)
      expect(service.getConnectionState()).toBe('connecting');
    });

    it('should stop reconnecting after max attempts', () => {
      const handler = vi.fn();
      service.onConnectionStateChange(handler);

      service.connect();
      mockWebSocketInstance?.simulateOpen();

      // Exhaust all reconnection attempts
      for (let i = 0; i < 3; i++) {
        mockWebSocketInstance?.simulateClose(1006, 'Connection lost');
        vi.advanceTimersByTime(30000); // Advance past max delay
      }

      // After max attempts, should be in error state
      mockWebSocketInstance?.simulateClose(1006, 'Connection lost');
      vi.advanceTimersByTime(30000);

      expect(handler).toHaveBeenCalledWith('error', expect.any(Error));
    });

    it('should not reconnect on clean disconnect', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();
      service.disconnect();

      vi.advanceTimersByTime(10000);
      expect(service.getConnectionState()).toBe('disconnected');
    });
  });

  describe('Event Subscription', () => {
    it('should deliver events to subscribed handlers', () => {
      const handler = vi.fn();
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      service.subscribe('ASSET_CREATED', handler);

      const event: AssetCreatedEvent = {
        eventType: 'ASSET_CREATED',
        timestamp: new Date().toISOString(),
        correlationId: 'test-123',
        payload: {
          assetId: 'asset-1',
          assetTag: 'AMS-HW-20250101-ABC123',
          assetType: 'HARDWARE',
          displayName: 'Test Laptop',
          status: 'IN_STOCK',
          createdBy: 'user-1',
        },
      };

      mockWebSocketInstance?.simulateMessage(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should support wildcard subscriptions', () => {
      const handler = vi.fn();
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      service.subscribe('*', handler);

      const event: DashboardEvent = {
        eventType: 'ASSET_UPDATED',
        timestamp: new Date().toISOString(),
        correlationId: 'test-456',
        payload: {
          assetId: 'asset-1',
          assetTag: 'AMS-HW-20250101-ABC123',
          assetType: 'HARDWARE',
          changes: { status: { old: 'IN_STOCK', new: 'DEPLOYED' } },
          updatedBy: 'user-1',
        },
      };

      mockWebSocketInstance?.simulateMessage(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn();
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      const unsubscribe = service.subscribe('ASSET_CREATED', handler);
      unsubscribe();

      const event: AssetCreatedEvent = {
        eventType: 'ASSET_CREATED',
        timestamp: new Date().toISOString(),
        correlationId: 'test-789',
        payload: {
          assetId: 'asset-2',
          assetTag: 'AMS-HW-20250101-DEF456',
          assetType: 'HARDWARE',
          displayName: 'Test Desktop',
          status: 'IN_STOCK',
          createdBy: 'user-1',
        },
      };

      mockWebSocketInstance?.simulateMessage(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers for same event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      service.subscribe('ASSET_CREATED', handler1);
      service.subscribe('ASSET_CREATED', handler2);

      const event: AssetCreatedEvent = {
        eventType: 'ASSET_CREATED',
        timestamp: new Date().toISOString(),
        correlationId: 'test-multi',
        payload: {
          assetId: 'asset-3',
          assetTag: 'AMS-HW-20250101-GHI789',
          assetType: 'HARDWARE',
          displayName: 'Test Server',
          status: 'IN_STOCK',
          createdBy: 'user-1',
        },
      };

      mockWebSocketInstance?.simulateMessage(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should ignore invalid event messages', () => {
      const handler = vi.fn();
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      service.subscribe('*', handler);

      // Send invalid message
      mockWebSocketInstance?.simulateMessage({ invalid: 'data' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    it('should send messages when connected', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      const result = service.send({ type: 'TEST', data: 'hello' });

      expect(result).toBe(true);
      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'TEST', data: 'hello' })
      );
    });

    it('should return false when not connected', () => {
      const result = service.send({ type: 'TEST' });
      expect(result).toBe(false);
    });

    it('should handle string messages', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      const result = service.send('raw string message');

      expect(result).toBe(true);
      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith('raw string message');
    });
  });

  describe('Heartbeat', () => {
    it('should update last heartbeat on heartbeat event', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      expect(service.getLastHeartbeat()).toBeNull();

      const heartbeatEvent: DashboardEvent = {
        eventType: 'HEARTBEAT',
        timestamp: new Date().toISOString(),
        correlationId: 'heartbeat-1',
        payload: {
          serverTime: new Date().toISOString(),
        },
      };

      mockWebSocketInstance?.simulateMessage(heartbeatEvent);

      expect(service.getLastHeartbeat()).toBeInstanceOf(Date);
    });

    it('should update last heartbeat on connection established event', () => {
      service.connect();
      mockWebSocketInstance?.simulateOpen();

      const connectionEvent: DashboardEvent = {
        eventType: 'CONNECTION_ESTABLISHED',
        timestamp: new Date().toISOString(),
        correlationId: 'conn-1',
        payload: {
          connectionId: 'ws-123',
          serverTime: new Date().toISOString(),
        },
      };

      mockWebSocketInstance?.simulateMessage(connectionEvent);

      expect(service.getLastHeartbeat()).toBeInstanceOf(Date);
    });
  });
});
