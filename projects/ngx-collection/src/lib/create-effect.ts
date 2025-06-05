import { assertInInjectionContext, DestroyRef, inject, Injector, isDevMode, isSignal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, from, isObservable, type Observable, of, retry, type RetryConfig, skipWhile, Subject, type Subscription, take, throwError } from 'rxjs';
import type { CreateEffectOptions, EffectCallbacks, EffectListeners, EffectMethods } from './types';

/**
 * This code is copied from NgRx ComponentStore and edited.
 * Credits: NgRx Team
 * https://ngrx.io/
 * Source: https://github.com/ngrx/platform/blob/main/modules/component-store/src/component-store.ts#L382
 * Docs:
 * https://ngrx.io/guide/component-store/effect#effect-method
 */
export function createEffect<
  ProvidedType = void,
  OriginType extends | Observable<ProvidedType> | unknown = Observable<ProvidedType>,
  ObservableType = OriginType extends Observable<infer A> ? A : never,
  ReturnType = ProvidedType | ObservableType extends void
    ? (
      observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType> | Promise<ObservableType>,
      next?: ((v: unknown) => void) | EffectListeners
    ) => Subscription
    : (
      observableOrValue: ObservableType | Observable<ObservableType> | Signal<ObservableType> | Promise<ObservableType>,
      next?: ((v: unknown) => void) | EffectListeners
    ) => Subscription
>(generator: (origin$: OriginType, callbacks: EffectCallbacks) => Observable<unknown>, options?: CreateEffectOptions): ReturnType & EffectMethods<ObservableType> {

  if (!options?.injector && isDevMode()) {
    assertInInjectionContext(createEffect);
  }

  const injector = options?.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  const origin$ = new Subject<ObservableType>();
  const retryOnError = options?.retryOnError ?? true;
  const retryConfig = (typeof options?.retryOnError === 'object' && options?.retryOnError) ? options?.retryOnError : {} as RetryConfig;

  const nextValue = new Subject<unknown>();
  const onSuccess = new Subject<unknown>();
  const nextError = new Subject<unknown>();
  const onError = new Subject<unknown>();
  const complete = new Subject<void>();
  const onFinalize = new Subject<void>();

  const callbacks: EffectCallbacks = {
    success: (v) => {
      onSuccess.next(v);
      onFinalize.next();
    },
    error: (e) => {
      onError.next(e);
      onFinalize.next();
    }
  };

  const generated = generator(origin$ as OriginType, callbacks);

  (retryOnError ? generated.pipe(
    catchError((e) => {
      if (isDevMode()) {
        console.error(e);
      }
      onError.next(e);
      onFinalize.next();
      return throwError(() => e);
    }),
    retry(retryConfig),
    takeUntilDestroyed(destroyRef)
  ) : generated.pipe(
    takeUntilDestroyed(destroyRef)
  )).subscribe({
    next: (v) => nextValue.next(v),
    error: (e) => nextError.next(e),
    complete: () => complete.next(),
  });

  const effectFn = ((
    value?: ObservableType | Observable<ObservableType> | Signal<ObservableType> | Promise<ObservableType>,
    next?: ((v: unknown) => void) | EffectListeners
  ): Subscription => {
    if (next) {
      if (typeof next === 'function') {
        nextValue.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe((v) => next(v));
      } else {
        if (next.next && typeof next.next === 'function') {
          nextValue.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe((v) => next.next?.(v));
        }
        if (next.onSuccess && typeof next.onSuccess === 'function') {
          onSuccess.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe((v) => next.onSuccess?.(v));
        }
        if (next.error && typeof next.error === 'function') {
          nextError.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe((e) => next.error?.(e));
        }
        if (next.onError && typeof next.onError === 'function') {
          onError.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe((e) => next.onError?.(e));
        }
        if (next.complete && typeof next.complete === 'function') {
          complete.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(() => next.complete?.());
        }
        if (next.onFinalize && typeof next.onFinalize === 'function') {
          onFinalize.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(() => next.onFinalize?.());
        }
      }
    }

    let firstSignalValue = undefined;
    try {
      if (isSignal(value)) {
        firstSignalValue = value();
        origin$.next(firstSignalValue);
      }
    } catch (_) {
      // Angular's `input.required()` will throw an error when a signal's
      // value is requested before the input's value is set.
    }

    const observable$ = isObservable(value)
      ? value
      : (isSignal(value)
          ? toObservable(value, { injector }).pipe(skipWhile((v) => v === firstSignalValue))
          : isPromise(value) ? from(value) : of(value)
      );

    return observable$.pipe(
      takeUntilDestroyed(destroyRef)
    ).subscribe((value) => {
      origin$.next(value as ObservableType);
    });
  }) as ReturnType;

  Object.defineProperty(effectFn, 'asObservable', {
    get: () => (value?: ObservableType | Observable<ObservableType> | Signal<ObservableType> | Promise<ObservableType>) => {

      let firstSignalValue = undefined;
      try {
        if (isSignal(value)) {
          firstSignalValue = value();
          origin$.next(firstSignalValue);
        }
      } catch (_) {
        // Angular's `input.required()` will throw an error when a signal's
        // value is requested before the input's value is set.
      }

      const observable$ = isObservable(value)
        ? value
        : (isSignal(value)
            ? toObservable(value, { injector }).pipe(skipWhile((v) => v === firstSignalValue))
            : isPromise(value) ? from(value) : of(value)
        );
      return generator(observable$ as OriginType, callbacks);
    },
    configurable: false
  });

  return effectFn as ReturnType & EffectMethods<ObservableType>;
}

function isPromise<T = unknown>(obj: unknown): obj is Promise<T> {
  return !!obj && typeof obj === 'object' && ('then' in obj) && typeof obj.then === 'function';
}
