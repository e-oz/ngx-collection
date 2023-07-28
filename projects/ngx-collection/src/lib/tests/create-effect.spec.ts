import { createEffect } from '../create-effect';
import { EMPTY, of, Subject, switchMap, tap, throwError } from "rxjs";
import { TestBed } from "@angular/core/testing";

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
          if (v === 'error') {
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
    effect('error');
    expect(lastResult).toEqual('error');
    expect(lastError).toEqual('error');

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
    expect(lastResult).toEqual('b');

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
});