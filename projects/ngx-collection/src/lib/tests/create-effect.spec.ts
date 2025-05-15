import { input, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { EMPTY, isObservable, of, Subject, switchMap, tap, throwError } from "rxjs";
import { createEffect } from '../create-effect';

describe('createEffect', () => {
  let effect: ReturnType<typeof createEffect<string>>;
  let lastResult: string | undefined;
  let lastError: string | undefined;
  let handlerCalls: number = 0;


  beforeEach(() => {
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
  })

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
    expect(handlerCalls).toEqual(2);
  });

  it('should NOT emit the initial value when a required input without initial value is passed', () => {
    expect(handlerCalls).toEqual(0);
    TestBed.runInInjectionContext(() => {
      effect(input.required());
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
});
