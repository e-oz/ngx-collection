import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { EMPTY, of, Subject, switchMap, tap, throwError } from "rxjs";
import { createEffect } from '../create-effect';

describe('createEffect', () => {
  let effect: ReturnType<typeof createEffect<string>>;
  let lastResult: string | undefined;
  let lastError: string | undefined;


  beforeEach(() => {
    lastResult = undefined;

    TestBed.runInInjectionContext(() => {
      effect = createEffect<string>(_ => _.pipe(
        tap((r) => lastResult = r),
        switchMap((v) => {
          if (v.startsWith('error')) {
            lastError = v;
            return throwError(() => 'err');
          }
          lastError = undefined;
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
    TestBed.flushEffects();
    expect(lastResult).toEqual('a');
    expect(lastError).toEqual(undefined);

    s.set('b');
    TestBed.flushEffects();
    expect(lastResult).toEqual('b');
    expect(lastError).toEqual(undefined);

    s.set('error');
    s.set('not an error');
    TestBed.flushEffects();
    expect(lastResult).toEqual('not an error');
    expect(lastError).toEqual(undefined);

    s.set('not an error');
    s.set('error');
    TestBed.flushEffects();
    expect(lastError).toEqual('error');

    s.set('c');
    TestBed.flushEffects();
    expect(lastResult).toEqual('c');
    expect(lastError).toEqual(undefined);
  })
});