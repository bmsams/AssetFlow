/**
 * WebSocket Hooks for Real-Time Updates
 * Implements Requirement 12.6: Real-time dashboard updates via WebSocket connections
 * 
 * Provides React hooks for:
 * - WebSocket connection management
 * - Event subscription
 * - Connection state monitoring
 * - Dashboard data refresh on events
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WebSocketService,
  WebSocketConfig,
  ConnectionState,
  WebSocketEventHandler,
} from '../services/websocket-service';
import {
  DashboardEvent,
  DashboardEventType,
} from '../services/websocket-events';

/**
 * Hook options for useWebSocket
 */
export interface UseWebSocketOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Callback when connection state changes */
  onConnectionChange?: (state: ConnectionState, error?: Error) => void;
}

/**
 * Return type for useWebSocket hook
 */
export interface UseWebSocketResult {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether currently connected */
  isConnected: boolean;
  /** Connect to WebSocket server */
  connect: () => void;
  /** Disconnect from WebSocket server */
  disconnect: () => void;
  /** Subscribe to events */
  subscribe: <T extends DashboardEvent>(
    eventType: T['eventType'] | '*',
    handler: WebSocketEventHandler<T>
  ) => () => void;
  /** Send message to server */
  send: (message: unknown) => boolean;
  /** Last heartbeat time */
  lastHeartbeat: Date | null;
  /** Connection error if any */
  error: Error | null;
}

/**
 * Hook for managing WebSocket connection
 * 
 * @param config - WebSocket configuration
 * @param options - Hook options
 * @returns WebSocket connection state and controls
 * 
 * @example
 * ```tsx
 * const { connectionState, isConnected, subscribe } = useWebSocket({
 *   url: 'wss://api.example.com/ws',
 * });
 * 
 * useEffect(() => {
 *   return subscribe('ASSET_CREATED', (event) => {
 *     console.log('Asset created:', event.payload);
 *   });
 * }, [subscribe]);
 * ```
 */
export function useWebSocket(
  config: WebSocketConfig,
  options: UseWebSocketOptions = {}
): UseWebSocketResult {
  const { autoConnect = true, onConnectionChange } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to maintain stable service instance
  const serviceRef = useRef<WebSocketService | null>(null);

  // Initialize service
  useEffect(() => {
    serviceRef.current = new WebSocketService(config);

    // Subscribe to connection state changes
    const unsubscribe = serviceRef.current.onConnectionStateChange((state, err) => {
      setConnectionState(state);
      setError(err ?? null);
      onConnectionChange?.(state, err);

      // Update last heartbeat when connected
      if (state === 'connected') {
        setLastHeartbeat(new Date());
      }
    });

    // Auto-connect if enabled
    if (autoConnect) {
      serviceRef.current.connect();
    }

    // Cleanup on unmount
    return () => {
      unsubscribe();
      serviceRef.current?.disconnect();
      serviceRef.current = null;
    };
  }, [config.url]); // Only recreate on URL change

  // Connect function
  const connect = useCallback(() => {
    serviceRef.current?.connect();
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
  }, []);

  // Subscribe function
  const subscribe = useCallback(<T extends DashboardEvent>(
    eventType: T['eventType'] | '*',
    handler: WebSocketEventHandler<T>
  ): (() => void) => {
    if (!serviceRef.current) {
      return () => {};
    }
    return serviceRef.current.subscribe(eventType, handler);
  }, []);

  // Send function
  const send = useCallback((message: unknown): boolean => {
    return serviceRef.current?.send(message) ?? false;
  }, []);

  // Update last heartbeat periodically
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const interval = setInterval(() => {
      const heartbeat = serviceRef.current?.getLastHeartbeat();
      if (heartbeat) {
        setLastHeartbeat(heartbeat);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [connectionState]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    subscribe,
    send,
    lastHeartbeat,
    error,
  };
}

/**
 * Hook for subscribing to specific WebSocket events
 * 
 * @param eventType - Event type to subscribe to
 * @param handler - Event handler function
 * @param deps - Dependencies for handler (like useCallback deps)
 * 
 * @example
 * ```tsx
 * useWebSocketEvent('ASSET_CREATED', (event) => {
 *   setAssets(prev => [...prev, event.payload]);
 * }, []);
 * ```
 */
export function useWebSocketEvent<T extends DashboardEvent>(
  subscribe: UseWebSocketResult['subscribe'],
  eventType: T['eventType'] | '*',
  handler: WebSocketEventHandler<T>,
  deps: React.DependencyList = []
): void {
  // Memoize handler to prevent unnecessary resubscriptions
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler: WebSocketEventHandler<T> = (event) => {
      handlerRef.current(event);
    };

    return subscribe(eventType, wrappedHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, eventType, ...deps]);
}

/**
 * Hook for dashboard data refresh on real-time events
 * 
 * @param subscribe - Subscribe function from useWebSocket
 * @param refreshFn - Function to refresh dashboard data
 * @param eventTypes - Event types that should trigger refresh
 * 
 * @example
 * ```tsx
 * const { subscribe } = useWebSocket(config);
 * 
 * useDashboardRefresh(subscribe, fetchDashboardData, [
 *   'ASSET_CREATED',
 *   'ASSET_UPDATED',
 *   'INVENTORY_CHANGED',
 * ]);
 * ```
 */
export function useDashboardRefresh(
  subscribe: UseWebSocketResult['subscribe'],
  refreshFn: () => void | Promise<void>,
  eventTypes: DashboardEventType[]
): void {
  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;

  // Debounce refresh to prevent rapid successive calls
  const lastRefreshRef = useRef<number>(0);
  const debounceMs = 500;

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    const handleEvent = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current >= debounceMs) {
        lastRefreshRef.current = now;
        refreshRef.current();
      }
    };

    eventTypes.forEach((eventType) => {
      const unsubscribe = subscribe(eventType, handleEvent);
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [subscribe, eventTypes.join(',')]);
}

/**
 * Hook for connection recovery handling
 * Automatically refreshes data when connection is restored
 * 
 * @param connectionState - Current connection state
 * @param refreshFn - Function to refresh data on reconnection
 * 
 * @example
 * ```tsx
 * const { connectionState } = useWebSocket(config);
 * 
 * useConnectionRecovery(connectionState, () => {
 *   fetchDashboardData();
 * });
 * ```
 */
export function useConnectionRecovery(
  connectionState: ConnectionState,
  refreshFn: () => void | Promise<void>
): void {
  const previousStateRef = useRef<ConnectionState>(connectionState);
  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;

  useEffect(() => {
    const previousState = previousStateRef.current;
    previousStateRef.current = connectionState;

    // Refresh when transitioning from reconnecting/error to connected
    if (
      connectionState === 'connected' &&
      (previousState === 'reconnecting' || previousState === 'error')
    ) {
      refreshRef.current();
    }
  }, [connectionState]);
}

/**
 * Combined hook for real-time dashboard updates
 * Provides all functionality needed for real-time dashboard updates
 * 
 * @param config - WebSocket configuration
 * @param refreshFn - Function to refresh dashboard data
 * @param eventTypes - Event types that should trigger refresh
 * 
 * @example
 * ```tsx
 * const { connectionState, isConnected, error } = useRealTimeUpdates(
 *   { url: 'wss://api.example.com/ws' },
 *   fetchDashboardData,
 *   ['ASSET_CREATED', 'ASSET_UPDATED', 'INVENTORY_CHANGED']
 * );
 * ```
 */
export function useRealTimeUpdates(
  config: WebSocketConfig,
  refreshFn: () => void | Promise<void>,
  eventTypes: DashboardEventType[]
): UseWebSocketResult {
  const wsResult = useWebSocket(config);

  // Set up dashboard refresh on events
  useDashboardRefresh(wsResult.subscribe, refreshFn, eventTypes);

  // Set up connection recovery
  useConnectionRecovery(wsResult.connectionState, refreshFn);

  return wsResult;
}
