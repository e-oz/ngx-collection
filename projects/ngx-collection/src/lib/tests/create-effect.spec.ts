import { Component, input, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { EMPTY, isObservable, of, Subject, switchMap, take, tap, throwError } from "rxjs";
import { createEffect } from '../create-effect';

// Initialize TestBed environment
if (!TestBed.platform) {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
}

describe('createEffect', () => {
  let effect: ReturnType<typeof createEffect<string>>;
  let lastResult: string | undefined;
  let lastError: string | undefined;
  let handlerCalls: number = 0;

  // Suppress expected console.error messages from error handling tests
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = jest.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    lastResult = undefined;
    handlerCalls = 0;

    TestBed.runInInjectionContext(() => {
      effect = createEffect<string>((_, callbacks) => _.pipe(
        tap((r) => {
          lastResult = r;
          handlerCalls++;
        }),
        switchMap((v) => {
          if (v.startsWith('error')) {
            lastError = v;
            callbacks.error('error:' + v);
            return throwError(() => 'err');
          }
          lastError = undefined;
          callbacks.success('success:' + v);
          return of(v);
        }),
      ));
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('should work', () => {
    effect('a');
    expect(lastResult).toEqual('a');
    effect('b');
    expect(lastResult).toEqual('b');

    effect(of('c'));
    expect(lastResult).toEqual('c');
  });

  it('should keep working when generator throws an error', () => {
    expect(lastError).toEqual(undefined);
    effect('error1');
    expect(lastResult).toEqual('error1');
    expect(lastError).toEqual('error1');

    effect('next');
    expect(lastResult).toEqual('next');
    expect(lastError).toEqual(undefined);
  });

  it('should keep working when value$ throws an error', () => {
    expect(lastError).toEqual(undefined);
    const s = new Subject<string>();
    const m = s.pipe(
      switchMap((v) => {
        if (v === 'error') {
          return throwError(() => 'err');
        }
        if (v === 'empty') {
          return EMPTY;
        }
        return of(v)
      })
    );
    effect(m);
    s.next('a');
    expect(lastResult).toEqual('a');
    s.next('error');
    expect(lastResult).toEqual('a');
    s.next('b');
    // s has error and will not accept emissions anymore.
    // {retryOnError} in effect's config should only affect
    // the effect's event loop, not the observable that is
    // passed as a value - resubscribing to that observable
    // might cause unexpected behavior.
    expect(lastResult).toEqual('a');

    // but the effect's event loop should still work
    effect('next');
    expect(lastResult).toEqual('next');
    expect(lastError).toEqual(undefined);
  });

  it('should keep working when value$ emits EMPTY', () => {
    expect(lastError).toEqual(undefined);
    const s = new Subject<string>();
    const m = s.pipe(
      switchMap((v) => {
        if (v === 'error') {
          return throwError(() => 'err');
        }
        if (v === 'empty') {
          return EMPTY;
        }
        return of(v)
      })
    );
    effect(m);
    s.next('a');
    expect(lastResult).toEqual('a');
    s.next('empty');
    expect(lastResult).toEqual('a');
    s.next('b');
    expect(lastResult).toEqual('b');

    effect('next');
    expect(lastResult).toEqual('next');
    expect(lastError).toEqual(undefined);
  });

  it('should accept signal as an argument', () => {
    const s = signal<string>('a');
    effect(s);
    TestBed.tick();
    expect(lastResult).toEqual('a');
    expect(lastError).toEqual(undefined);

    s.set('b');
    TestBed.tick();
    expect(lastResult).toEqual('b');
    expect(lastError).toEqual(undefined);

    s.set('error');
    s.set('not an error');
    TestBed.tick();
    expect(lastResult).toEqual('not an error');
    expect(lastError).toEqual(undefined);

    s.set('not an error');
    s.set('error');
    TestBed.tick();
    expect(lastError).toEqual('error');

    s.set('c');
    TestBed.tick();
    expect(lastResult).toEqual('c');
    expect(lastError).toEqual(undefined);
  });

  it('should return an observable when getEffectFor() is called', () => {
    const e = effect.asObservable('test');
    expect(isObservable(e)).toEqual(true);
    e.subscribe();
    expect(lastResult).toEqual('test');
  });

  it('should run callbacks', () => {
    let r = '';
    let f = '';
    effect('s', {
      onSuccess: (v) => r = v as string,
      onFinalize: () => f = 'finalized:success',
    });
    expect(r).toEqual('success:s');
    expect(f).toEqual('finalized:success');

    f = '';
    effect('error1', {
      onError: (v) => r = v as string,
      onFinalize: () => f = 'finalized:error',
    });
    expect(r).toEqual('error:error1');
    expect(f).toEqual('finalized:error');
  });

  it('should emit the initial value when a signal is passed', () => {
    expect(handlerCalls).toEqual(0);
    effect(signal('test'));
    expect(lastResult).toEqual('test');
    expect(handlerCalls).toEqual(1);
    TestBed.tick();
    expect(handlerCalls).toEqual(1);
  });

  it('should emit the new value of a signal if it is different from the initial value', () => {
    expect(handlerCalls).toEqual(0);
    const s = signal('test');
    effect(s);
    expect(lastResult).toEqual('test');
    expect(handlerCalls).toEqual(1);
    s.set('test2');
    TestBed.tick();
    expect(lastResult).toEqual('test2');
    expect(handlerCalls).toEqual(2);
  });

  it('should skip the new value of a signal if it is equal to the initial value', () => {
    expect(handlerCalls).toEqual(0);
    const s = signal('test');
    effect(s);
    expect(lastResult).toEqual('test');
    expect(handlerCalls).toEqual(1);
    s.set('test');
    TestBed.tick();
    expect(lastResult).toEqual('test');
    expect(handlerCalls).toEqual(1);
  });

  it('should NOT emit the initial value when a required input without initial value is passed', () => {
    @Component({
      selector: 'required-input-host',
      template: '',
    })
    class RequiredInputHost {
      readonly value = input.required<string>();
    }

    expect(handlerCalls).toEqual(0);
    TestBed.runInInjectionContext(() => {
      const host = new RequiredInputHost();
      effect(host.value);

      expect(lastResult).not.toEqual('test');
      expect(handlerCalls).toEqual(0);
      TestBed.tick();
      expect(handlerCalls).toEqual(0);
    });
  });

  it('should accept Promise as value', async () => {
    expect(handlerCalls).toEqual(0);
    effect(Promise.resolve('test'));
    expect(lastResult).toEqual(undefined);
    expect(handlerCalls).toEqual(0);
    await Promise.resolve();
    expect(lastResult).toEqual('test');
    expect(handlerCalls).toEqual(1);
  });

  it('should accept function listener', () => {
    let value: unknown = undefined;
    effect('listener', (v) => value = v);
    expect(value).toEqual('listener');
  });

  it('should call listener callbacks including complete', () => {
    const calls: string[] = [];
    TestBed.runInInjectionContext(() => {
      const localEffect = createEffect<string>((origin$, callbacks) => origin$.pipe(
        tap((v) => callbacks.success(`success:${v}`)),
        take(1)
      ));
      localEffect('value', {
        next: (v) => calls.push(`next:${String(v)}`),
        onSuccess: (v) => calls.push(`onSuccess:${String(v)}`),
        onFinalize: () => calls.push('onFinalize'),
        complete: () => calls.push('complete'),
      });
    });

    expect(calls).toHaveLength(4);
    expect(calls).toEqual(expect.arrayContaining([
      'next:value',
      'onSuccess:success:value',
      'onFinalize',
      'complete',
    ]));
  });

  it('should stop after error when retryOnError is false', () => {
    const results: string[] = [];
    const errors: unknown[] = [];
    const onErrors: unknown[] = [];
    let finalized = 0;

    TestBed.runInInjectionContext(() => {
      const noRetry = createEffect<string>((origin$, callbacks) => origin$.pipe(
        switchMap((v) => {
          if (v === 'fail') {
            callbacks.error('cb-fail');
            return throwError(() => 'boom');
          }
          callbacks.success(`ok:${v}`);
          return of(v);
        }),
        tap((v) => results.push(v))
      ), { retryOnError: false });

      noRetry('ok');
      noRetry('fail', {
        error: (e) => errors.push(e),
        onError: (e) => onErrors.push(e),
        onFinalize: () => finalized++,
      });
      noRetry('later');
    });

    expect(results).toStrictEqual(['ok']);
    expect(errors).toStrictEqual(['boom']);
    expect(onErrors).toStrictEqual(['cb-fail']);
    expect(finalized).toBe(1);
  });
});
