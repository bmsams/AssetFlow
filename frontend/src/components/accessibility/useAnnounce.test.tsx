import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAnnounce } from './useAnnounce';

describe('useAnnounce', () => {
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchEventSpy.mockRestore();
  });

  it('dispatches announce event with polite politeness by default', () => {
    const { result } = renderHook(() => useAnnounce());

    act(() => {
      result.current.announce('Test message');
    });

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('announce');
    expect(event.detail).toEqual({
      message: 'Test message',
      politeness: 'polite',
    });
  });

  it('dispatches announce event with specified politeness', () => {
    const { result } = renderHook(() => useAnnounce());

    act(() => {
      result.current.announce('Urgent message', 'assertive');
    });

    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      message: 'Urgent message',
      politeness: 'assertive',
    });
  });

  it('announcePolite dispatches polite event', () => {
    const { result } = renderHook(() => useAnnounce());

    act(() => {
      result.current.announcePolite('Polite message');
    });

    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      message: 'Polite message',
      politeness: 'polite',
    });
  });

  it('announceAssertive dispatches assertive event', () => {
    const { result } = renderHook(() => useAnnounce());

    act(() => {
      result.current.announceAssertive('Assertive message');
    });

    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      message: 'Assertive message',
      politeness: 'assertive',
    });
  });

  it('returns stable function references', () => {
    const { result, rerender } = renderHook(() => useAnnounce());

    const firstAnnounce = result.current.announce;
    const firstAnnouncePolite = result.current.announcePolite;
    const firstAnnounceAssertive = result.current.announceAssertive;

    rerender();

    expect(result.current.announce).toBe(firstAnnounce);
    expect(result.current.announcePolite).toBe(firstAnnouncePolite);
    expect(result.current.announceAssertive).toBe(firstAnnounceAssertive);
  });

  it('can be called multiple times', () => {
    const { result } = renderHook(() => useAnnounce());

    act(() => {
      result.current.announce('First message');
      result.current.announce('Second message');
      result.current.announceAssertive('Third message');
    });

    expect(dispatchEventSpy).toHaveBeenCalledTimes(3);
  });
});
