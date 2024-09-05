import { assertInInjectionContext, DestroyRef, inject, Injector, isDevMode, isSignal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { dematerialize, isObservable, materialize, type Observable, of, retry, type RetryConfig, Subject, type Subscription, take, tap } from 'rxjs';

export type CreateEffectOptions = {
  injector?: Injector,
  /**
   * @param retryOnError
   * This param allows your effect keep running on error.
   * When set to `false`, any non-caught error will terminate the effect and consequent calls will be ignored.
   * Otherwise, generated effect will use `retry()`.
   * You can pass `RetryConfig` object here to configure `retry()` operator.
   */
  retryOnError?: boolean | RetryConfig,
};

export type EffectMethods<ObservableType> = {
  next$: Observable<unknown>,
  error$: Observable<unknown>,
  forValue: (observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>) => Observable<unknown>,
};

export type EffectListeners = {
  next?: (v: unknown) => void,
  error?: (v: unknown) => void,
  complete?: () => void,
};

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
      observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>,
      next?: ((v: unknown) => void) | EffectListeners
    ) => Subscription
    : (
      observableOrValue: ObservableType | Observable<ObservableType> | Signal<ObservableType>,
      next?: ((v: unknown) => void) | EffectListeners
    ) => Subscription
>(generator: (origin$: OriginType) => Observable<unknown>, options?: CreateEffectOptions): ReturnType & EffectMethods<ObservableType> {

  if (!options?.injector && isDevMode()) {
    assertInInjectionContext(createEffect);
  }

  const injector = options?.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  const origin$ = new Subject<ObservableType>();
  const retryOnError = options?.retryOnError ?? true;
  const retryConfig = (typeof options?.retryOnError === 'object' && options?.retryOnError) ? options?.retryOnError : {} as RetryConfig;

  const nextValue = new Subject<unknown>();
  const nextError = new Subject<unknown>();
  const complete = new Subject<void>();

  const generated = generator(origin$ as OriginType).pipe(
    materialize(),
    tap((n) => {
      switch (n.kind) {
        case 'E':
          if (nextError.observed) {
            nextError.next(n.error);
          }
          break;
        case 'C':
          if (complete.observed) {
            complete.next();
          }
          break;
        default:
          if (nextValue.observed) {
            nextValue.next(n.value);
          }
      }
    }),
    dematerialize()
  );

  if (retryOnError) {
    generated.pipe(
      retry(retryConfig),
      takeUntilDestroyed(destroyRef)
    ).subscribe();
  } else {
    generated.pipe(
      takeUntilDestroyed(destroyRef)
    ).subscribe();
  }

  const effectFn = ((
    observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>,
    next?: ((v: unknown) => void) | EffectListeners
  ): Subscription => {
    if (next) {
      if (typeof next === 'function') {
        nextValue.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(next);
      } else {
        if (next.next) {
          nextValue.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(next.next);
        }
        if (next.error) {
          nextError.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(next.error);
        }
        if (next.complete) {
          complete.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(next.complete);
        }
      }
    }

    const observable$ = isObservable(observableOrValue)
      ? observableOrValue
      : (isSignal(observableOrValue)
          ? toObservable(observableOrValue, { injector })
          : of(observableOrValue)
      );

    return observable$.pipe(
      takeUntilDestroyed(destroyRef)
    ).subscribe((value) => {
      origin$.next(value as ObservableType);
    });
  }) as ReturnType;

  Object.defineProperty(effectFn, 'next$', {
    get: () => nextValue.asObservable(),
    configurable: false
  });

  Object.defineProperty(effectFn, 'error$', {
    get: () => nextError.asObservable(),
    configurable: false
  });

  Object.defineProperty(effectFn, 'forValue', {
    get: () => (observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>) => () => {
      const observable$ = isObservable(observableOrValue)
        ? observableOrValue
        : (isSignal(observableOrValue)
            ? toObservable(observableOrValue, { injector })
            : of(observableOrValue)
        );
      return generator(observable$ as OriginType);
    },
    configurable: false
  });

  return effectFn as ReturnType & EffectMethods<ObservableType>;
}
