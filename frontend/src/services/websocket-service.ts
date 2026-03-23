/**
 * WebSocket Service for Real-Time Updates
 * Implements Requirement 12.6: Real-time dashboard updates via WebSocket connections
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Event subscription/unsubscription
 * - Heartbeat monitoring
 */

import { DashboardEvent, isDashboardEvent } from './websocket-events';

/**
 * Connection state enum
 */
export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * WebSocket configuration options
 */
export interface WebSocketConfig {
  /** WebSocket server URL */
  url: string;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Heartbeat timeout in ms (default: 10000) */
  heartbeatTimeout?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Event handler function type
 */
export type WebSocketEventHandler<T extends DashboardEvent = DashboardEvent> = (event: T) => void;

/**
 * Connection state change handler
 */
export type ConnectionStateHandler = (state: ConnectionState, error?: Error) => void;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<WebSocketConfig, 'url'>> = {
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  debug: false,
};

/**
 * WebSocket Service Class
 * Manages WebSocket connections with automatic reconnection and event handling
 */
export class WebSocketService {
  private config: Required<WebSocketConfig>;
  private socket: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeat: Date | null = null;

  // Event handlers
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set();

  constructor(config: WebSocketConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Get time since last heartbeat
   */
  getLastHeartbeat(): Date | null {
    return this.lastHeartbeat;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    if (this.socket?.readyState === WebSocket.CONNECTING) {
      this.log('Connection already in progress');
      return;
    }

    this.setConnectionState('connecting');
    this.log(`Connecting to ${this.config.url}`);

    try {
      this.socket = new WebSocket(this.config.url);
      this.setupSocketHandlers();
    } catch (error) {
      this.log('Failed to create WebSocket', error);
      this.setConnectionState('error', error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.log('Disconnecting');
    this.clearTimers();
    this.reconnectAttempts = 0;

    if (this.socket) {
      // Remove handlers before closing to prevent reconnect
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;

      if (this.socket.readyState === WebSocket.OPEN || 
          this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close(1000, 'Client disconnect');
      }
      this.socket = null;
    }

    this.setConnectionState('disconnected');
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends DashboardEvent>(
    eventType: T['eventType'] | '*',
    handler: WebSocketEventHandler<T>
  ): () => void {
    const key = eventType;
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, new Set());
    }
    this.eventHandlers.get(key)!.add(handler as WebSocketEventHandler);

    this.log(`Subscribed to ${eventType}`);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(eventType, handler);
    };
  }

  /**
   * Unsubscribe from a specific event type
   */
  unsubscribe<T extends DashboardEvent>(
    eventType: T['eventType'] | '*',
    handler: WebSocketEventHandler<T>
  ): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as WebSocketEventHandler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
      this.log(`Unsubscribed from ${eventType}`);
    }
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler);
    // Immediately notify of current state
    handler(this.connectionState);

    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  /**
   * Send a message to the server
   */
  send(message: unknown): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.log('Cannot send message: not connected');
      return false;
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.socket.send(data);
      return true;
    } catch (error) {
      this.log('Failed to send message', error);
      return false;
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.log('Connection established');
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      this.startHeartbeat();
    };

    this.socket.onclose = (event) => {
      this.log(`Connection closed: ${event.code} - ${event.reason}`);
      this.clearTimers();

      if (event.code !== 1000 && this.config.autoReconnect) {
        this.setConnectionState('reconnecting');
        this.scheduleReconnect();
      } else {
        this.setConnectionState('disconnected');
      }
    };

    this.socket.onerror = (event) => {
      this.log('WebSocket error', event);
      // Error will be followed by close event
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const parsed = JSON.parse(data);

      if (!isDashboardEvent(parsed)) {
        this.log('Received invalid event format', parsed);
        return;
      }

      // Handle heartbeat
      if (parsed.eventType === 'HEARTBEAT' || parsed.eventType === 'CONNECTION_ESTABLISHED') {
        this.lastHeartbeat = new Date();
        this.resetHeartbeatTimeout();
      }

      // Notify specific event handlers
      const specificHandlers = this.eventHandlers.get(parsed.eventType);
      if (specificHandlers) {
        specificHandlers.forEach((handler) => {
          try {
            handler(parsed);
          } catch (error) {
            this.log(`Error in event handler for ${parsed.eventType}`, error);
          }
        });
      }

      // Notify wildcard handlers
      const wildcardHandlers = this.eventHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => {
          try {
            handler(parsed);
          } catch (error) {
            this.log('Error in wildcard event handler', error);
          }
        });
      }
    } catch (error) {
      this.log('Failed to parse message', error);
    }
  }

  /**
   * Set connection state and notify handlers
   */
  private setConnectionState(state: ConnectionState, error?: Error): void {
    if (this.connectionState === state) return;

    this.connectionState = state;
    this.connectionStateHandlers.forEach((handler) => {
      try {
        handler(state, error);
      } catch (err) {
        this.log('Error in connection state handler', err);
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (!this.config.autoReconnect) return;

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      this.setConnectionState('error', new Error('Max reconnection attempts reached'));
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelay
    );

    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.clearHeartbeatTimers();

    // Send periodic pings
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING', timestamp: new Date().toISOString() });
        this.startHeartbeatTimeout();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Start heartbeat timeout
   */
  private startHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();

    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.log('Heartbeat timeout - connection may be stale');
      // Force reconnect
      if (this.socket) {
        this.socket.close(4000, 'Heartbeat timeout');
      }
    }, this.config.heartbeatTimeout);
  }

  /**
   * Reset heartbeat timeout (called when heartbeat received)
   */
  private resetHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearHeartbeatTimers();
  }

  /**
   * Clear heartbeat timers
   */
  private clearHeartbeatTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  /**
   * Clear heartbeat timeout
   */
  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Log message if debug enabled
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      if (data !== undefined) {
        console.warn(`[WebSocket] ${message}`, data);
      } else {
        console.warn(`[WebSocket] ${message}`);
      }
    }
  }
}

/**
 * Create a singleton WebSocket service instance
 */
let defaultInstance: WebSocketService | null = null;

export function getWebSocketService(config?: WebSocketConfig): WebSocketService {
  if (!defaultInstance && config) {
    defaultInstance = new WebSocketService(config);
  }
  if (!defaultInstance) {
    throw new Error('WebSocket service not initialized. Call with config first.');
  }
  return defaultInstance;
}

export function resetWebSocketService(): void {
  if (defaultInstance) {
    defaultInstance.disconnect();
    defaultInstance = null;
  }
}
