/**
 * Tests for WebSocket Hooks
 * Implements Requirement 12.6: Real-time dashboard updates via WebSocket connections
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useWebSocket,
  useDashboardRefresh,
  useConnectionRecovery,
} from './useWebSocket';
import type { AssetCreatedEvent } from '../services/websocket-events';

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
    mockInstances.push(this);
  }

  send = vi.fn();
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code ?? 1000, reason: reason ?? '' } as CloseEvent);
    }
  });

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason } as CloseEvent);
    }
  }
}

let mockInstances: MockWebSocket[] = [];

vi.stubGlobal('WebSocket', MockWebSocket);

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInstances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize with disconnected state when autoConnect is false', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' }, { autoConnect: false })
    );

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
  });

  it('should auto-connect by default', () => {
    renderHook(() => useWebSocket({ url: 'wss://test.example.com/ws' }));

    expect(mockInstances.length).toBe(1);
  });

  it('should not auto-connect when autoConnect is false', () => {
    renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' }, { autoConnect: false })
    );

    expect(mockInstances.length).toBe(0);
  });

  it('should update connection state when connected', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' })
    );

    // Initially connecting
    expect(result.current.connectionState).toBe('connecting');

    // Simulate connection open
    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  it('should call onConnectionChange callback', () => {
    const onConnectionChange = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' }, { onConnectionChange })
    );

    // Should be called with connecting state
    expect(onConnectionChange).toHaveBeenCalledWith('connecting', undefined);

    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    expect(onConnectionChange).toHaveBeenCalledWith('connected', undefined);
  });

  it('should provide connect and disconnect functions', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' }, { autoConnect: false })
    );

    expect(result.current.isConnected).toBe(false);

    act(() => {
      result.current.connect();
    });

    expect(mockInstances.length).toBe(1);

    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should provide subscribe function that receives events', () => {
    const handler = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' })
    );

    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);

    // Subscribe to events
    let unsubscribe: () => void;
    act(() => {
      unsubscribe = result.current.subscribe('ASSET_CREATED', handler);
    });

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

    act(() => {
      mockInstances[0]?.simulateMessage(event);
    });

    expect(handler).toHaveBeenCalledWith(event);

    // Unsubscribe and verify no more calls
    act(() => {
      unsubscribe();
    });
    handler.mockClear();

    act(() => {
      mockInstances[0]?.simulateMessage(event);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should provide send function', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' })
    );

    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);

    let success: boolean;
    act(() => {
      success = result.current.send({ type: 'TEST' });
    });

    expect(success!).toBe(true);
    expect(mockInstances[0]?.send).toHaveBeenCalled();
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' })
    );

    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    unmount();

    expect(mockInstances[0]?.close).toHaveBeenCalled();
  });
});

describe('useDashboardRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInstances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should call refresh function when subscribed events occur', () => {
    const refreshFn = vi.fn();

    const { result: wsResult } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' })
    );

    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    expect(wsResult.current.isConnected).toBe(true);

    renderHook(() =>
      useDashboardRefresh(wsResult.current.subscribe, refreshFn, [
        'ASSET_CREATED',
        'ASSET_UPDATED',
      ])
    );

    const event: AssetCreatedEvent = {
      eventType: 'ASSET_CREATED',
      timestamp: new Date().toISOString(),
      correlationId: 'test-refresh',
      payload: {
        assetId: 'asset-1',
        assetTag: 'AMS-HW-20250101-ABC123',
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
        status: 'IN_STOCK',
        createdBy: 'user-1',
      },
    };

    act(() => {
      mockInstances[0]?.simulateMessage(event);
    });

    expect(refreshFn).toHaveBeenCalled();
  });

  it('should debounce rapid refresh calls', () => {
    const refreshFn = vi.fn();

    const { result: wsResult } = renderHook(() =>
      useWebSocket({ url: 'wss://test.example.com/ws' })
    );

    act(() => {
      mockInstances[0]?.simulateOpen();
    });

    expect(wsResult.current.isConnected).toBe(true);

    renderHook(() =>
      useDashboardRefresh(wsResult.current.subscribe, refreshFn, ['ASSET_CREATED'])
    );

    const createEvent = (id: string): AssetCreatedEvent => ({
      eventType: 'ASSET_CREATED',
      timestamp: new Date().toISOString(),
      correlationId: id,
      payload: {
        assetId: id,
        assetTag: `AMS-HW-20250101-${id}`,
        assetType: 'HARDWARE',
        displayName: 'Test',
        status: 'IN_STOCK',
        createdBy: 'user-1',
      },
    });

    // Send multiple events rapidly
    act(() => {
      mockInstances[0]?.simulateMessage(createEvent('1'));
      mockInstances[0]?.simulateMessage(createEvent('2'));
      mockInstances[0]?.simulateMessage(createEvent('3'));
    });

    // Should only call refresh once due to debouncing
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });
});

describe('useConnectionRecovery', () => {
  it('should call refresh when connection recovers from reconnecting', () => {
    const refreshFn = vi.fn();

    const { rerender } = renderHook(
      ({ state }) => useConnectionRecovery(state, refreshFn),
      { initialProps: { state: 'reconnecting' as const } }
    );

    // Transition to connected
    rerender({ state: 'connected' as const });

    expect(refreshFn).toHaveBeenCalled();
  });

  it('should call refresh when connection recovers from error', () => {
    const refreshFn = vi.fn();

    const { rerender } = renderHook(
      ({ state }) => useConnectionRecovery(state, refreshFn),
      { initialProps: { state: 'error' as const } }
    );

    // Transition to connected
    rerender({ state: 'connected' as const });

    expect(refreshFn).toHaveBeenCalled();
  });

  it('should not call refresh on initial connection', () => {
    const refreshFn = vi.fn();

    const { rerender } = renderHook(
      ({ state }) => useConnectionRecovery(state, refreshFn),
      { initialProps: { state: 'connecting' as const } }
    );

    // Transition to connected (initial connection, not recovery)
    rerender({ state: 'connected' as const });

    expect(refreshFn).not.toHaveBeenCalled();
  });
});
